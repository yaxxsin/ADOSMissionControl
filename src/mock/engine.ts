/**
 * MockFlightEngine — Core simulation loop for demo mode.
 *
 * Writes directly to Zustand stores at configurable tick rate.
 * Components consume store data identically whether mock or real.
 *
 * Also creates a MockProtocol + MockTransport per flying drone and
 * registers them in DroneManager via addDrone(). This enables the
 * Configure tab, Flight Logs, SensorHealthBar, and all panels that
 * depend on getSelectedProtocol() returning a real protocol.
 */

import { DEMO_DRONES, configToFleetDrone, type DemoDroneConfig } from "./drones";
import { FLIGHT_PATHS, interpolatePath } from "./flight-paths";
import { generateAlert, batteryAlert } from "./alerts";
import { MockProtocol } from "./mock-protocol";
import { MockTransport } from "./mock-transport";
import { BOOT_MESSAGES, generateStatusMessage } from "./status-messages";
import { useFleetStore } from "@/stores/fleet-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useHistoryStore } from "@/stores/history-store";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import { haversineDistance } from "@/lib/telemetry-utils";
import { randomId } from "@/lib/utils";
import type { FleetDrone, FlightRecord } from "@/lib/types";
import type { UnifiedFlightMode } from "@/lib/protocol/types";

interface DroneSimState {
  config: DemoDroneConfig;
  pathProgress: number;       // 0-1 progress between current and next waypoint
  currentWaypointIdx: number;
  battery: number;            // current percentage
  tickCount: number;
  lastAlertTick: number;
  batteryAlertSent: boolean;
  protocol: MockProtocol;
  transport: MockTransport;
  bootMessageIndex: number;
  statusMessageTick: number;
  segmentDistances: number[]; // pre-computed haversine distances per segment
  // Loop tracking for flight recording
  loopStartTick: number;
  loopMaxAlt: number;
  loopMaxSpeed: number;
  loopDistance: number;
  loopBatteryStart: number;
  loopTrail: [number, number][];
  loopCount: number; // track completed loops — skip the first partial one
}

/** Core sensor bitmask: gyro | accel | compass | baro | GPS | motors | RC | AHRS | battery */
const SENSOR_MASK = (1 << 0) | (1 << 1) | (1 << 2) | (1 << 3) | (1 << 5)
  | (1 << 15) | (1 << 16) | (1 << 21) | (1 << 25);

class MockFlightEngine {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private states: DroneSimState[] = [];
  private tickRate = 200; // ms
  private running = false;

  constructor() {
    this.states = DEMO_DRONES.map((cfg) => {
      // Pre-compute segment distances so haversine isn't called every tick
      const path = cfg.pathIndex >= 0 ? FLIGHT_PATHS[cfg.pathIndex] : null;
      const segmentDistances: number[] = [];
      if (path && path.length >= 2) {
        for (let i = 0; i < path.length; i++) {
          const next = (i + 1) % path.length;
          segmentDistances.push(haversineDistance(path[i].lat, path[i].lon, path[next].lat, path[next].lon));
        }
      }
      return {
        config: cfg,
        pathProgress: 0,
        currentWaypointIdx: 0,
        battery: cfg.batteryStart,
        tickCount: 0,
        lastAlertTick: 0,
        batteryAlertSent: false,
        protocol: new MockProtocol(cfg.id === 'delta' ? 'px4' : 'ardupilot-copter'),
        transport: new MockTransport(),
        bootMessageIndex: 0,
        statusMessageTick: 0,
        segmentDistances,
        loopStartTick: 0,
        loopMaxAlt: 0,
        loopMaxSpeed: 0,
        loopDistance: 0,
        loopBatteryStart: cfg.batteryStart,
        loopTrail: [],
        loopCount: 0,
      };
    });
  }

  start(intervalMs = 200): void {
    if (this.running) return;
    this.tickRate = intervalMs;
    this.running = true;

    // Initialize fleet store with demo drones
    const initialDrones = DEMO_DRONES.map(configToFleetDrone);
    useFleetStore.getState().setDrones(initialDrones);

    // Seed metadata profiles for demo drones (idempotent — won't overwrite user edits)
    const metadataStore = useDroneMetadataStore.getState();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    for (const cfg of DEMO_DRONES) {
      metadataStore.ensureProfile(cfg.id, {
        displayName: cfg.name,
        serial: `ALT-${cfg.id.toUpperCase()}`,
        computeModule: "RPi CM4",
        weightClass: "Micro",
        suiteType: cfg.suiteType ?? null,
        totalFlights: cfg.pathIndex >= 0 ? 47 : 12,
        totalHours: cfg.pathIndex >= 0 ? 23.4 : 5.1,
        enrolledAt: thirtyDaysAgo,
      });
    }

    // Select first drone by default
    useDroneStore.getState().selectDrone("alpha-1");

    // Register flying drones in DroneManager
    const droneManager = useDroneManager.getState();
    for (const state of this.states) {
      const cfg = state.config;
      if (cfg.pathIndex < 0 && cfg.id !== 'delta') continue; // skip grounded drones except delta (PX4 demo)

      const vehicleInfo = state.protocol.getVehicleInfo();
      droneManager.addDrone(
        cfg.id,
        cfg.name,
        state.protocol,
        state.transport,
        vehicleInfo,
        { type: "websocket", url: "mock://demo" },
      );
    }

    // Select first drone in manager too
    droneManager.selectDrone("alpha-1");

    // Emit boot messages for the selected drone
    const selectedState = this.states.find((s) => s.config.id === "alpha-1");
    if (selectedState) {
      for (const msg of BOOT_MESSAGES) {
        selectedState.protocol.emitStatusText(msg.severity, msg.text);
      }
      selectedState.bootMessageIndex = BOOT_MESSAGES.length;
    }

    this.intervalId = setInterval(() => this.tick(), this.tickRate);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.running = false;
  }

  tick(): void {
    const fleetStore = useFleetStore.getState();
    const telemetryStore = useTelemetryStore.getState();
    const selectedId = useDroneStore.getState().selectedId;
    const now = Date.now();

    for (const state of this.states) {
      state.tickCount++;
      const cfg = state.config;

      // Skip non-flying drones
      if (cfg.pathIndex < 0) continue;

      const path = FLIGHT_PATHS[cfg.pathIndex];
      if (!path || path.length < 2) continue;

      // Advance along path
      const wp = path[state.currentWaypointIdx];
      const nextIdx = (state.currentWaypointIdx + 1) % path.length;
      const nextWp = path[nextIdx];

      // Speed-based progress increment (use pre-computed distance)
      const segmentDist = state.segmentDistances[state.currentWaypointIdx] ?? 0;
      const stepDist = (wp.speed * this.tickRate) / 1000; // meters per tick
      const progressStep = segmentDist > 0 ? stepDist / segmentDist : 0.01;
      state.pathProgress += progressStep;

      // Move to next waypoint when segment complete
      if (state.pathProgress >= 1) {
        state.pathProgress = 0;

        // Detect loop completion: wrapping from last WP to first
        if (nextIdx === 0 && state.currentWaypointIdx > 0) {
          state.loopCount++;
          // Only record after the first full traversal (skip partial first loop)
          if (state.loopCount >= 2) {
            const duration = Math.round(
              (state.tickCount - state.loopStartTick) * this.tickRate / 1000,
            );
            const record: FlightRecord = {
              id: randomId(),
              droneId: cfg.id,
              droneName: cfg.name,
              suiteType: cfg.suiteType,
              date: Date.now(),
              duration,
              distance: Math.round(state.loopDistance),
              maxAlt: Math.round(state.loopMaxAlt),
              maxSpeed: Math.round(state.loopMaxSpeed * 10) / 10,
              batteryUsed: Math.round(state.loopBatteryStart - state.battery),
              waypointCount: path.length,
              status: "completed",
              path: state.loopTrail.length > 0 ? [...state.loopTrail] : undefined,
            };
            useHistoryStore.getState().addRecord(record);
          }
          // Reset loop trackers
          state.loopStartTick = state.tickCount;
          state.loopMaxAlt = 0;
          state.loopMaxSpeed = 0;
          state.loopDistance = 0;
          state.loopBatteryStart = state.battery;
          state.loopTrail = [];
        }

        // Accumulate distance for current segment
        state.loopDistance += state.segmentDistances[state.currentWaypointIdx] ?? 0;

        state.currentWaypointIdx = nextIdx;
      }

      // Interpolate position
      const pos = interpolatePath(wp, nextWp, state.pathProgress);

      // Accumulate loop metrics
      if (pos.alt > state.loopMaxAlt) state.loopMaxAlt = pos.alt;
      if (wp.speed > state.loopMaxSpeed) state.loopMaxSpeed = wp.speed;
      // Record trail point every 10 ticks (~2s at 200ms tick)
      if (state.tickCount % 10 === 0) {
        state.loopTrail.push([pos.lat, pos.lon]);
      }

      // GPS jitter
      const jitterLat = (Math.random() - 0.5) * 0.00002;
      const jitterLon = (Math.random() - 0.5) * 0.00002;

      // Battery drain: ~80% over 30 min = ~0.044% per second
      state.battery = Math.max(5, state.battery - (0.044 * this.tickRate) / 1000);

      // Attitude: bank into turns
      const headingDelta = pos.heading - (fleetStore.drones.find(d => d.id === cfg.id)?.position?.heading ?? pos.heading);
      const roll = Math.max(-30, Math.min(30, headingDelta * 0.5));
      const pitch = (nextWp.alt - wp.alt) > 0 ? -5 : (nextWp.alt - wp.alt) < 0 ? 5 : -2;

      // Update fleet store
      const droneUpdate: Partial<FleetDrone> = {
        lastHeartbeat: now,
        position: {
          timestamp: now,
          lat: pos.lat + jitterLat,
          lon: pos.lon + jitterLon,
          alt: pos.alt,
          relativeAlt: pos.alt,
          heading: pos.heading,
          groundSpeed: wp.speed,
          airSpeed: wp.speed * 1.05,
          climbRate: (nextWp.alt - wp.alt) * progressStep,
        },
        battery: {
          timestamp: now,
          voltage: 22.2 * (state.battery / 100),
          current: 10 + Math.random() * 5,
          remaining: state.battery,
          consumed: (100 - state.battery) * 22,
        },
        gps: {
          timestamp: now,
          fixType: 3,
          satellites: 14 + Math.floor(Math.random() * 6),
          hdop: 0.8 + Math.random() * 0.4,
          lat: pos.lat + jitterLat,
          lon: pos.lon + jitterLon,
          alt: 920 + pos.alt,
        },
      };
      fleetStore.updateDrone(cfg.id, droneUpdate);

      // Push telemetry to ring buffers for selected drone (batched — single store notification)
      if (cfg.id === selectedId) {
        // Cycle CH5 through 6 mode zones so each slot activates in demo
        const modePhase = Math.floor(state.tickCount / 25) % 6;
        const modePwmTable = [1000, 1295, 1425, 1555, 1685, 1875];
        const ch5Pwm = modePwmTable[modePhase];

        telemetryStore.pushBatch({
          attitude: {
            timestamp: now,
            roll,
            pitch,
            yaw: pos.heading,
            rollSpeed: roll * 0.1,
            pitchSpeed: pitch * 0.05,
            yawSpeed: headingDelta * 0.02,
          },
          position: droneUpdate.position!,
          // Push battery at 2Hz (every 2.5 ticks at 5Hz)
          ...(state.tickCount % 3 === 0 ? { battery: droneUpdate.battery! } : {}),
          gps: droneUpdate.gps!,
          vfr: {
            timestamp: now,
            airspeed: wp.speed * 1.05,
            groundspeed: wp.speed,
            heading: pos.heading,
            throttle: 45 + Math.random() * 15,
            alt: pos.alt,
            climb: (nextWp.alt - wp.alt) * progressStep,
          },
          rc: {
            timestamp: now,
            channels: [1500, 1538, 1500, 1500, ch5Pwm, 1000, 1000, 1000, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500],
            rssi: 200 + Math.floor(Math.random() * 55),
          },
        });

        // Feed RC channel values to protocol for pre-arm checks
        state.protocol.setRcChannelValues([1500, 1538, 1500, 1500, ch5Pwm, 1000, 1000, 1000, 1500, 1500, 1500, 1500, 1500, 1500, 1500, 1500]);

        // ── Protocol-emitted telemetry (via callbacks → bridgeTelemetry) ──

        // SysStatus at 1Hz (every 5 ticks at 5Hz tick rate)
        if (state.tickCount % 5 === 0) {
          state.protocol.emitSysStatus({
            timestamp: now,
            cpuLoad: 150 + Math.floor(Math.random() * 50), // 15-20% in 0.1% units
            sensorsPresent: SENSOR_MASK,
            sensorsEnabled: SENSOR_MASK,
            sensorsHealthy: SENSOR_MASK,
            voltageMv: Math.round(droneUpdate.battery!.voltage * 1000),
            currentCa: Math.round(droneUpdate.battery!.current * 100),
            batteryRemaining: Math.round(state.battery),
            dropRateComm: 0,
            errorsComm: 0,
          });
        }

        // Radio at ~2Hz (every 3 ticks)
        if (state.tickCount % 3 === 0) {
          state.protocol.emitRadio({
            timestamp: now,
            rssi: 180 + Math.floor(Math.random() * 40),
            remrssi: 170 + Math.floor(Math.random() * 40),
            txbuf: 95 + Math.floor(Math.random() * 5),
            noise: 30 + Math.floor(Math.random() * 10),
            remnoise: 32 + Math.floor(Math.random() * 10),
            rxerrors: 0,
            fixed: 0,
          });
        }

        // EKF at 1Hz
        if (state.tickCount % 5 === 0) {
          state.protocol.emitEkf({
            timestamp: now,
            velocityVariance: 0.01 + Math.random() * 0.03,
            posHorizVariance: 0.02 + Math.random() * 0.04,
            posVertVariance: 0.01 + Math.random() * 0.02,
            compassVariance: 0.01 + Math.random() * 0.06,
            terrainAltVariance: 0.01 + Math.random() * 0.02,
            flags: 0x1FF, // all good
          });
        }

        // Vibration at ~2Hz
        if (state.tickCount % 3 === 0) {
          state.protocol.emitVibration({
            timestamp: now,
            vibrationX: 5 + Math.random() * 10,
            vibrationY: 5 + Math.random() * 10,
            vibrationZ: 8 + Math.random() * 15,
            clipping0: 0,
            clipping1: 0,
            clipping2: 0,
          });
        }

        // Servo output at ~2Hz (every 3 ticks)
        if (state.tickCount % 3 === 0) {
          const throttle = 45 + Math.random() * 15;
          const motorPwm = 1000 + Math.round(throttle * 10); // ~1450-1600 range
          state.protocol.emitServoOutput({
            timestamp: now,
            port: 0,
            servos: [
              motorPwm + Math.round((Math.random() - 0.5) * 20), // Motor 1
              motorPwm + Math.round((Math.random() - 0.5) * 20), // Motor 2
              motorPwm + Math.round((Math.random() - 0.5) * 20), // Motor 3
              motorPwm + Math.round((Math.random() - 0.5) * 20), // Motor 4
              0, 0, 0, 0,  // Outputs 5-8 disabled
            ],
          });
          state.protocol.emitServoOutput({
            timestamp: now,
            port: 1,
            servos: [0, 0, 0, 0, 0, 0, 0, 0], // Outputs 9-16 disabled
          });
        }

        // Heartbeat at 1Hz
        if (state.tickCount % 5 === 0) {
          state.protocol.emitHeartbeat(
            cfg.status === "in_mission",
            cfg.flightMode as UnifiedFlightMode,
          );
        }

        // StatusText ~every 10-30s
        state.statusMessageTick++;
        const msg = generateStatusMessage({
          waypointIndex: state.currentWaypointIdx,
          battery: state.battery,
          tickCount: state.statusMessageTick,
        });
        if (msg) {
          state.protocol.emitStatusText(msg.severity, msg.text);
        }
      }

      // Alerts
      if (state.battery <= 30 && !state.batteryAlertSent) {
        fleetStore.addAlert(batteryAlert(cfg.id, cfg.name, state.battery));
        state.batteryAlertSent = true;
      }

      // Random alerts every ~60s per drone
      if (state.tickCount - state.lastAlertTick > 300 && Math.random() < 0.02) {
        fleetStore.addAlert(generateAlert(cfg.id, cfg.name));
        state.lastAlertTick = state.tickCount;
      }
    }

    fleetStore.touch();
  }

  isRunning(): boolean {
    return this.running;
  }
}

/** Singleton mock engine instance. */
export const mockEngine = new MockFlightEngine();
