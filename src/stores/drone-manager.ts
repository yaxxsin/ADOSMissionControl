import { create } from "zustand";
import type {
  DroneProtocol,
  Transport,
  VehicleInfo,
} from "@/lib/protocol/types";
import { useTelemetryStore } from "./telemetry-store";
import { useDroneStore } from "./drone-store";
import { useFleetStore } from "./fleet-store";
import { useSettingsStore } from "./settings-store";
import { useTrailStore } from "./trail-store";
import { audioEngine } from "@/lib/audio-engine";
import type { FlightMode } from "@/lib/types";

export interface ConnectionMeta {
  type: "serial" | "websocket";
  baudRate?: number;
  url?: string;
  portVendorId?: number;
  portProductId?: number;
  presetId?: string;
}

export interface ManagedDrone {
  id: string;
  name: string;
  protocol: DroneProtocol;
  transport: Transport;
  vehicleInfo: VehicleInfo;
  unsubscribers: (() => void)[];
  connectedAt: number;
  connectionMeta?: ConnectionMeta;
  /** Why the drone was disconnected. `null` while connected. */
  _disconnectReason: "intentional" | "unexpected" | null;
}

/** Listeners for unexpected disconnect events (used by auto-reconnect). */
type DisconnectListener = (droneId: string, droneName: string, meta: ConnectionMeta | undefined) => void;
const unexpectedDisconnectListeners = new Set<DisconnectListener>();

interface DroneManagerState {
  drones: Map<string, ManagedDrone>;
  selectedDroneId: string | null;

  addDrone: (
    id: string,
    name: string,
    protocol: DroneProtocol,
    transport: Transport,
    vehicleInfo: VehicleInfo,
    connectionMeta?: ConnectionMeta,
  ) => void;
  removeDrone: (id: string) => void;
  /** Intentional disconnect — marks drone as intentional, then removes. */
  disconnectDrone: (id: string) => void;
  selectDrone: (id: string | null) => void;
  getSelectedProtocol: () => DroneProtocol | null;
  getSelectedDrone: () => ManagedDrone | null;
  clear: () => void;
}

/** Known flight modes that map cleanly to the UI FlightMode union. */
const KNOWN_MODES: Set<string> = new Set([
  "STABILIZE", "ALT_HOLD", "LOITER", "GUIDED", "AUTO", "RTL", "LAND",
  "MANUAL", "ACRO",
  // ArduPlane
  "FBWA", "FBWB", "CRUISE", "TRAINING", "CIRCLE", "AUTOTUNE",
  "QSTABILIZE", "QHOVER", "QLOITER", "QLAND", "QRTL",
  // ArduCopter extras
  "POSHOLD", "BRAKE", "SMART_RTL", "DRIFT", "SPORT",
  "AVOID_ADSB", "THERMAL", "QAUTOTUNE", "QACRO", "FLIP", "THROW",
  "FLOWHOLD", "FOLLOW", "ZIGZAG", "SYSTEMID", "HELI_AUTOROTATE", "AUTO_RTL",
  // ArduPlane extras
  "TAKEOFF", "LOITER_TO_QLAND",
]);

/**
 * Bridge protocol telemetry callbacks into the Zustand stores
 * (telemetry, drone, fleet). Returns an array of unsubscribe functions.
 */
function bridgeTelemetry(
  droneId: string,
  protocol: DroneProtocol,
): (() => void)[] {
  const telemetry = useTelemetryStore.getState();
  const fleetStore = useFleetStore.getState();

  return [
    protocol.onAttitude((data) => telemetry.pushAttitude(data)),

    protocol.onPosition((data) => {
      telemetry.pushPosition(data);
      fleetStore.updateDrone(droneId, { position: data });
      useTrailStore.getState().pushPoint(data.lat, data.lon);
    }),

    protocol.onBattery((data) => {
      telemetry.pushBattery(data);
      fleetStore.updateDrone(droneId, { battery: data });
    }),

    protocol.onGps((data) => {
      telemetry.pushGps(data);
      fleetStore.updateDrone(droneId, { gps: data });

      const settings = useSettingsStore.getState();
      if (settings.audioEnabled && settings.alertGpsLost && data.fixType <= 1) {
        audioEngine.play("gps_lost");
      }
    }),

    protocol.onVfr((data) => telemetry.pushVfr(data)),

    protocol.onRc((data) => {
      telemetry.pushRc(data);

      const settings = useSettingsStore.getState();
      if (settings.audioEnabled && settings.alertRcLost && data.rssi === 0) {
        audioEngine.play("rc_lost");
      }
    }),

    protocol.onSysStatus((data) => {
      telemetry.pushSysStatus(data);

      const settings = useSettingsStore.getState();
      if (settings.audioEnabled && settings.alertLowBattery) {
        if (data.batteryRemaining >= 0 && data.batteryRemaining < settings.batteryCriticalPct) {
          audioEngine.play("low_battery");
        }
      }
    }),

    protocol.onRadio((data) => {
      telemetry.pushRadio(data);
    }),

    protocol.onEkf((data) => telemetry.pushEkf(data)),
    protocol.onVibration((data) => telemetry.pushVibration(data)),
    protocol.onServoOutput((data) => telemetry.pushServoOutput(data)),
    protocol.onWind((data) => telemetry.pushWind(data)),
    protocol.onTerrain((data) => telemetry.pushTerrain(data)),

    protocol.onMissionProgress((data) => {
      if (data.reachedSeq !== undefined) {
        const settings = useSettingsStore.getState();
        if (settings.audioEnabled && settings.alertWaypoint) {
          audioEngine.play("waypoint_reached");
        }
      }
    }),

    protocol.onHeartbeat((data) => {
      const droneStore = useDroneStore.getState();

      // Capture arm state before updating for audio edge detection
      const wasArmed = droneStore.armState === "armed";

      // Map UnifiedFlightMode → FlightMode. Fall back to current if unknown.
      const mode = KNOWN_MODES.has(data.mode)
        ? (data.mode as FlightMode)
        : droneStore.flightMode;

      droneStore.setFlightMode(mode);
      droneStore.setArmState(data.armed ? "armed" : "disarmed");
      droneStore.setConnectionState(data.armed ? "armed" : "connected");
      droneStore.heartbeat();

      // Audio triggers for arm/disarm transitions
      const settings = useSettingsStore.getState();
      if (settings.audioEnabled && settings.alertArmDisarm) {
        if (data.armed && !wasArmed) audioEngine.play("arm");
        if (!data.armed && wasArmed) audioEngine.play("disarm");
      }

      droneStore.setSystemStatus(data.systemStatus);

      if (data.vehicleInfo) {
        droneStore.setFirmwareInfo(
          data.vehicleInfo.firmwareVersionString,
          data.vehicleInfo.vehicleClass,
        );
      }

      fleetStore.updateDrone(droneId, {
        status: data.armed ? "in_mission" : "online",
        connectionState: data.armed ? "armed" : "connected",
        flightMode: mode,
        armState: data.armed ? "armed" : "disarmed",
        lastHeartbeat: Date.now(),
      });
    }),
  ];
}

export const useDroneManager = create<DroneManagerState>((set, get) => ({
  drones: new Map(),
  selectedDroneId: null,

  addDrone: (id, name, protocol, transport, vehicleInfo, connectionMeta) => {
    const unsubscribers = bridgeTelemetry(id, protocol);

    const drone: ManagedDrone = {
      id,
      name,
      protocol,
      transport,
      vehicleInfo,
      unsubscribers,
      connectedAt: Date.now(),
      connectionMeta,
      _disconnectReason: null,
    };

    // Listen for transport close to detect unexpected disconnects
    const closeHandler = () => {
      const current = get().drones.get(id);
      if (!current || current._disconnectReason === "intentional") return;
      // Mark as unexpected and trigger listeners
      current._disconnectReason = "unexpected";
      for (const listener of unexpectedDisconnectListeners) {
        listener(id, name, connectionMeta);
      }
      // Clean up the drone from the store
      get().removeDrone(id);
    };
    transport.on("close", closeHandler as (data: void) => void);
    unsubscribers.push(() => transport.off("close", closeHandler as (data: void) => void));

    set((state) => {
      const newMap = new Map(state.drones);
      newMap.set(id, drone);
      return { drones: newMap };
    });

    // Insert into fleet store so the drone appears in Fleet view
    useFleetStore.getState().addDrone({
      id,
      name,
      status: "online",
      connectionState: "connected",
      flightMode: "STABILIZE",
      armState: "disarmed",
      lastHeartbeat: Date.now(),
      healthScore: 100,
      firmwareVersion: vehicleInfo.firmwareVersionString,
      frameType: vehicleInfo.vehicleClass,
    });

    // Auto-select if this is the first drone
    if (get().drones.size === 1) {
      get().selectDrone(id);
    }
  },

  removeDrone: (id) => {
    const drone = get().drones.get(id);
    if (drone) {
      drone.unsubscribers.forEach((unsub) => unsub());
      if (drone.protocol.isConnected) {
        drone.protocol.disconnect();
      }
    }

    // Remove from fleet store
    useFleetStore.getState().removeDrone(id);

    set((state) => {
      const newMap = new Map(state.drones);
      newMap.delete(id);
      const selectedId =
        state.selectedDroneId === id ? null : state.selectedDroneId;
      return { drones: newMap, selectedDroneId: selectedId };
    });

    // If we just deselected, reset downstream stores
    if (get().selectedDroneId === null) {
      useDroneStore.getState().selectDrone(null);
      useDroneStore.getState().setConnectionState("disconnected");
      useTelemetryStore.getState().clear();
    }
  },

  disconnectDrone: (id) => {
    const drone = get().drones.get(id);
    if (drone) {
      drone._disconnectReason = "intentional";
    }
    get().removeDrone(id);
  },

  selectDrone: (id) => {
    set({ selectedDroneId: id });
    if (id) {
      useDroneStore.getState().selectDrone(id);
    }
  },

  getSelectedProtocol: () => {
    const { drones, selectedDroneId } = get();
    if (!selectedDroneId) return null;
    return drones.get(selectedDroneId)?.protocol ?? null;
  },

  getSelectedDrone: () => {
    const { drones, selectedDroneId } = get();
    if (!selectedDroneId) return null;
    return drones.get(selectedDroneId) ?? null;
  },

  clear: () => {
    const { drones } = get();
    drones.forEach((drone) => {
      drone._disconnectReason = "intentional";
      drone.unsubscribers.forEach((unsub) => unsub());
      if (drone.protocol.isConnected) {
        drone.protocol.disconnect();
      }
    });
    set({ drones: new Map(), selectedDroneId: null });
    useDroneStore.getState().setConnectionState("disconnected");
    useTelemetryStore.getState().clear();
  },
}));

/** Subscribe to unexpected disconnect events. Returns unsubscribe function. */
export function onUnexpectedDisconnect(listener: DisconnectListener): () => void {
  unexpectedDisconnectListeners.add(listener);
  return () => unexpectedDisconnectListeners.delete(listener);
}
