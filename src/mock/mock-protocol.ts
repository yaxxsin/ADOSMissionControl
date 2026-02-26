/**
 * MockProtocol — Full DroneProtocol implementation for demo mode.
 *
 * Provides in-memory parameter storage, command stubs, and callback
 * arrays so DroneManager's bridgeTelemetry() wires everything into
 * the Zustand stores automatically.
 *
 * The engine calls public emit*() methods to fire telemetry callbacks.
 * Attitude/position/battery/gps/vfr/rc callbacks exist (required by
 * interface) but the engine writes those directly to stores to avoid
 * double-writes — only sysStatus/radio/ekf/vibration/heartbeat/
 * statusText/servoOutput/wind flow through callbacks.
 *
 * @license GPL-3.0-only
 */

import type {
  DroneProtocol,
  Transport,
  VehicleInfo,
  CommandResult,
  ParameterValue,
  ProtocolCapabilities,
  FirmwareHandler,
  MissionItem,
  UnifiedFlightMode,
  LogEntry,
  LogDownloadProgressCallback,
  AttitudeCallback,
  PositionCallback,
  BatteryCallback,
  GpsCallback,
  VfrCallback,
  RcCallback,
  StatusTextCallback,
  HeartbeatCallback,
  ParameterCallback,
  SerialDataCallback,
  SysStatusCallback,
  RadioCallback,
  MissionProgressCallback,
  EkfCallback,
  VibrationCallback,
  ServoOutputCallback,
  WindCallback,
  TerrainCallback,
  MagCalProgressCallback,
  MagCalReportCallback,
  AccelCalPosCallback,
  AccelCalPosition,
  HomePositionCallback,
  AutopilotVersionCallback,
  PowerStatusCallback,
  DistanceSensorCallback,
  FenceStatusCallback,
  NavControllerCallback,
  ScaledImuCallback,
  LinkStateCallback,
} from "@/lib/protocol/types";
import { ArduCopterHandler } from "@/lib/protocol/firmware-ardupilot";
import { MOCK_PARAMS, type MockParam } from "./mock-params";

// ── Helpers ─────────────────────────────────────────────────

function ok(message = "OK"): CommandResult {
  return { success: true, resultCode: 0, message };
}

function sub<T>(arr: T[], cb: T): () => void {
  arr.push(cb);
  return () => {
    const idx = arr.indexOf(cb);
    if (idx >= 0) arr.splice(idx, 1);
  };
}

// ── Vehicle identity ────────────────────────────────────────

const MOCK_VEHICLE_INFO: VehicleInfo = {
  firmwareType: "ardupilot-copter",
  vehicleClass: "copter",
  firmwareVersionString: "ArduCopter V4.5.7",
  systemId: 1,
  componentId: 1,
  autopilotType: 3,  // MAV_AUTOPILOT_ARDUPILOTMEGA
  vehicleType: 2,    // MAV_TYPE_QUADROTOR
};

// ── MockProtocol ────────────────────────────────────────────

export class MockProtocol implements DroneProtocol {
  readonly protocolName = "mock-mavlink";

  private _connected = true;
  private handler = new ArduCopterHandler();
  private params: Map<string, MockParam>;
  private defaults: MockParam[];

  // Callback arrays (same pattern as MAVLinkAdapter)
  private attitudeCbs: AttitudeCallback[] = [];
  private positionCbs: PositionCallback[] = [];
  private batteryCbs: BatteryCallback[] = [];
  private gpsCbs: GpsCallback[] = [];
  private vfrCbs: VfrCallback[] = [];
  private rcCbs: RcCallback[] = [];
  private statusTextCbs: StatusTextCallback[] = [];
  private heartbeatCbs: HeartbeatCallback[] = [];
  private parameterCbs: ParameterCallback[] = [];
  private serialDataCbs: SerialDataCallback[] = [];
  private sysStatusCbs: SysStatusCallback[] = [];
  private radioCbs: RadioCallback[] = [];
  private missionProgressCbs: MissionProgressCallback[] = [];
  private ekfCbs: EkfCallback[] = [];
  private vibrationCbs: VibrationCallback[] = [];
  private servoOutputCbs: ServoOutputCallback[] = [];
  private windCbs: WindCallback[] = [];
  private terrainCbs: TerrainCallback[] = [];
  private magCalProgressCbs: MagCalProgressCallback[] = [];
  private magCalReportCbs: MagCalReportCallback[] = [];
  private accelCalPosCbs: AccelCalPosCallback[] = [];
  private homePositionCbs: HomePositionCallback[] = [];
  private autopilotVersionCbs: AutopilotVersionCallback[] = [];
  private powerStatusCbs: PowerStatusCallback[] = [];
  private distanceSensorCbs: DistanceSensorCallback[] = [];
  private fenceStatusCbs: FenceStatusCallback[] = [];
  private navControllerCbs: NavControllerCallback[] = [];
  private scaledImuCbs: ScaledImuCallback[] = [];
  private linkLostCbs: LinkStateCallback[] = [];
  private linkRestoredCbs: LinkStateCallback[] = [];
  private accelCalTimers: ReturnType<typeof setTimeout>[] = [];
  private compassCalTimers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];

  constructor() {
    this.defaults = MOCK_PARAMS;
    this.params = new Map();
    for (const p of MOCK_PARAMS) {
      this.params.set(p.name, { ...p });
    }
  }

  // ── Public emit methods (called by engine) ──────────────

  emitStatusText(severity: number, text: string): void {
    for (const cb of this.statusTextCbs) cb({ severity, text });
  }

  emitHeartbeat(armed: boolean, mode: UnifiedFlightMode): void {
    for (const cb of this.heartbeatCbs) {
      cb({
        armed,
        mode,
        systemStatus: armed ? 4 : 3, // MAV_STATE_ACTIVE : MAV_STATE_STANDBY
        vehicleInfo: MOCK_VEHICLE_INFO,
      });
    }
  }

  emitSysStatus(data: Parameters<SysStatusCallback>[0]): void {
    for (const cb of this.sysStatusCbs) cb(data);
  }

  emitRadio(data: Parameters<RadioCallback>[0]): void {
    for (const cb of this.radioCbs) cb(data);
  }

  emitEkf(data: Parameters<EkfCallback>[0]): void {
    for (const cb of this.ekfCbs) cb(data);
  }

  emitVibration(data: Parameters<VibrationCallback>[0]): void {
    for (const cb of this.vibrationCbs) cb(data);
  }

  emitServoOutput(data: Parameters<ServoOutputCallback>[0]): void {
    for (const cb of this.servoOutputCbs) cb(data);
  }

  emitWind(data: Parameters<WindCallback>[0]): void {
    for (const cb of this.windCbs) cb(data);
  }

  // ── Connection ──────────────────────────────────────────

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(_transport: Transport): Promise<VehicleInfo> {
    this._connected = true;
    return MOCK_VEHICLE_INFO;
  }

  async disconnect(): Promise<void> {
    this._connected = false;
  }

  // ── Commands (all return success) ───────────────────────

  async arm(): Promise<CommandResult> {
    this.emitStatusText(6, "Arming motors");
    return ok("Armed");
  }

  async disarm(): Promise<CommandResult> {
    this.emitStatusText(6, "Disarming motors");
    return ok("Disarmed");
  }

  async setFlightMode(mode: UnifiedFlightMode): Promise<CommandResult> {
    this.emitStatusText(6, `Mode change to ${mode}`);
    return ok(`Mode: ${mode}`);
  }

  async returnToLaunch(): Promise<CommandResult> {
    this.emitStatusText(6, "Returning to launch");
    return ok("RTL");
  }

  async land(): Promise<CommandResult> {
    this.emitStatusText(6, "Landing");
    return ok("Landing");
  }

  async takeoff(altitude: number): Promise<CommandResult> {
    this.emitStatusText(6, `Taking off to ${altitude}m`);
    return ok(`Takeoff ${altitude}m`);
  }

  async killSwitch(): Promise<CommandResult> {
    this.emitStatusText(2, "KILL SWITCH ACTIVATED");
    return ok("Kill switch");
  }

  async guidedGoto(lat: number, lon: number, alt: number): Promise<CommandResult> {
    return ok(`Goto ${lat.toFixed(6)}, ${lon.toFixed(6)} @ ${alt}m`);
  }

  async pauseMission(): Promise<CommandResult> {
    return ok("Mission paused");
  }

  async resumeMission(): Promise<CommandResult> {
    return ok("Mission resumed");
  }

  async clearMission(): Promise<CommandResult> {
    return ok("Mission cleared");
  }

  async commitParamsToFlash(): Promise<CommandResult> {
    return ok("Params saved to flash");
  }

  // ── Field Operations ────────────────────────────────────

  async setHome(): Promise<CommandResult> { return ok("Home set"); }
  async changeSpeed(): Promise<CommandResult> { return ok("Speed changed"); }
  async setYaw(): Promise<CommandResult> { return ok("Yaw set"); }
  async setGeoFenceEnabled(): Promise<CommandResult> { return ok("Geofence updated"); }
  async setServo(): Promise<CommandResult> { return ok("Servo set"); }
  async cameraTrigger(): Promise<CommandResult> { return ok("Camera triggered"); }
  async setGimbalAngle(): Promise<CommandResult> { return ok("Gimbal set"); }
  async doPreArmCheck(): Promise<CommandResult> { return ok("Pre-arm: Ready"); }

  // ── Manual Control ──────────────────────────────────────

  sendManualControl(): void {
    // no-op — demo drones follow scripted paths
  }

  // ── Parameters ──────────────────────────────────────────

  async getAllParameters(): Promise<ParameterValue[]> {
    const all = Array.from(this.params.values());
    const count = all.length;

    // Fire onParameter callbacks for progress bar (async-ish, batched)
    for (let i = 0; i < all.length; i++) {
      const p = all[i];
      const pv: ParameterValue = {
        name: p.name,
        value: p.value,
        type: p.type,
        index: i,
        count,
      };
      for (const cb of this.parameterCbs) cb(pv);
    }

    return all.map((p, i) => ({
      name: p.name,
      value: p.value,
      type: p.type,
      index: i,
      count,
    }));
  }

  async getParameter(name: string): Promise<ParameterValue> {
    const p = this.params.get(name);
    if (!p) {
      return { name, value: 0, type: 9, index: -1, count: this.params.size };
    }
    const all = Array.from(this.params.keys());
    return {
      name: p.name,
      value: p.value,
      type: p.type,
      index: all.indexOf(name),
      count: this.params.size,
    };
  }

  async setParameter(name: string, value: number, type = 9): Promise<CommandResult> {
    const existing = this.params.get(name);
    if (existing) {
      existing.value = value;
    } else {
      this.params.set(name, { name, value, type });
    }

    // Fire parameter callback so UI updates
    const all = Array.from(this.params.keys());
    const pv: ParameterValue = {
      name,
      value,
      type,
      index: all.indexOf(name),
      count: this.params.size,
    };
    for (const cb of this.parameterCbs) cb(pv);

    return ok(`${name} = ${value}`);
  }

  async resetParametersToDefault(): Promise<CommandResult> {
    this.params.clear();
    for (const p of this.defaults) {
      this.params.set(p.name, { ...p });
    }
    this.emitStatusText(5, "Parameters reset to defaults");
    return ok("Parameters reset");
  }

  // ── Mission ─────────────────────────────────────────────

  async uploadMission(): Promise<CommandResult> {
    return ok("Mission uploaded");
  }

  async downloadMission(): Promise<MissionItem[]> {
    return [];
  }

  async setCurrentMissionItem(): Promise<CommandResult> {
    return ok("Mission item set");
  }

  // ── Calibration ─────────────────────────────────────────

  async startCalibration(type: "accel" | "gyro" | "compass" | "level" | "airspeed"): Promise<CommandResult> {
    this.emitStatusText(6, `${type} calibration started`);

    if (type === "accel") {
      // Simulate 6-position accel cal — send position 1 after 500ms
      this.clearAccelTimers();
      const t = setTimeout(() => this.emitAccelCalPos(1 as AccelCalPosition), 500);
      this.accelCalTimers.push(t);
    } else if (type === "compass") {
      // Simulate 2-compass cal with staggered progress, direction vectors, and completion mask
      this.clearCompassTimers();
      let pct0 = 0;
      let pct1 = 0;
      let tick = 0;
      const mask0 = new Uint8Array(10); // 80 sectors
      const mask1 = new Uint8Array(10);

      const iv = setInterval(() => {
        tick++;
        const angle0 = tick * 0.3;
        const angle1 = tick * 0.25;

        // Compass 0: 5%/tick, faster
        pct0 = Math.min(100, pct0 + 5);
        // Fill completion mask progressively
        const sectors0 = Math.floor((pct0 / 100) * 80);
        for (let b = 0; b < sectors0; b++) {
          mask0[Math.floor(b / 8)] |= (1 << (b % 8));
        }
        for (const cb of this.magCalProgressCbs) {
          cb({
            compassId: 0,
            completionPct: pct0,
            calStatus: pct0 < 50 ? 2 : 3,
            completionMask: Array.from(mask0),
            directionX: Math.cos(angle0),
            directionY: Math.sin(angle0),
            directionZ: Math.sin(angle0 * 0.7),
          });
        }

        // Compass 1: 4%/tick + delayed start (starts at tick 2)
        if (tick >= 2) {
          pct1 = Math.min(100, pct1 + 4);
          const sectors1 = Math.floor((pct1 / 100) * 80);
          for (let b = 0; b < sectors1; b++) {
            mask1[Math.floor(b / 8)] |= (1 << (b % 8));
          }
          for (const cb of this.magCalProgressCbs) {
            cb({
              compassId: 1,
              completionPct: pct1,
              calStatus: pct1 < 50 ? 2 : 3,
              completionMask: Array.from(mask1),
              directionX: Math.sin(angle1),
              directionY: Math.cos(angle1),
              directionZ: -Math.sin(angle1 * 0.5),
            });
          }
        }

        // Both done
        if (pct0 >= 100 && pct1 >= 100) {
          clearInterval(iv);
          // Report compass 0 (excellent fitness)
          const t0 = setTimeout(() => {
            for (const cb of this.magCalReportCbs) {
              cb({
                compassId: 0, calStatus: 4, autosaved: 1,
                ofsX: 42.3, ofsY: -18.7, ofsZ: 105.1, fitness: 6.2,
                diagX: 1.02, diagY: 0.98, diagZ: 1.01,
                offdiagX: 0.005, offdiagY: -0.012, offdiagZ: 0.008,
                orientationConfidence: 0.95,
                oldOrientation: 0, newOrientation: 0, scaleFactor: 1.0,
              });
            }
          }, 300);
          // Report compass 1 (acceptable fitness, slight delay)
          const t1 = setTimeout(() => {
            for (const cb of this.magCalReportCbs) {
              cb({
                compassId: 1, calStatus: 4, autosaved: 1,
                ofsX: -87.5, ofsY: 134.2, ofsZ: -62.8, fitness: 18.5,
                diagX: 0.95, diagY: 1.08, diagZ: 0.97,
                offdiagX: 0.042, offdiagY: -0.031, offdiagZ: 0.015,
                orientationConfidence: 0.88,
                oldOrientation: 0, newOrientation: 0, scaleFactor: 1.0,
              });
            }
          }, 500);
          this.compassCalTimers.push(t0, t1);
        }
      }, 250);
      this.compassCalTimers.push(iv);
    } else {
      // Gyro/level/airspeed: simple progress → success
      setTimeout(() => this.emitStatusText(6, `${type} calibration: 50%`), 1000);
      setTimeout(() => this.emitStatusText(5, `${type} calibration successful`), 2000);
    }

    return ok(`${type} calibration started`);
  }

  confirmAccelCalPos(position: number): void {
    // Simulate: after confirming, wait 800ms then send next position or finish
    const nextPos = position + 1;
    const t = setTimeout(() => {
      if (nextPos <= 6) {
        this.emitAccelCalPos(nextPos as AccelCalPosition);
      } else {
        // Match real ArduPilot: generic success then PreArm reboot message
        this.emitStatusText(5, "Calibration successful");
        setTimeout(() => this.emitStatusText(5, "PreArm: Accels calibrated requires reboot"), 200);
      }
    }, 800);
    this.accelCalTimers.push(t);
  }

  async acceptCompassCal(_compassMask?: number): Promise<CommandResult> {
    return ok("Compass calibration accepted");
  }

  async cancelCompassCal(_compassMask?: number): Promise<CommandResult> {
    this.clearCompassTimers();
    return ok("Compass calibration cancelled");
  }

  private emitAccelCalPos(position: AccelCalPosition): void {
    for (const cb of this.accelCalPosCbs) cb({ position });
  }

  private clearAccelTimers(): void {
    for (const t of this.accelCalTimers) clearTimeout(t);
    this.accelCalTimers = [];
  }

  private clearCompassTimers(): void {
    for (const t of this.compassCalTimers) {
      clearTimeout(t as ReturnType<typeof setTimeout>);
      clearInterval(t as ReturnType<typeof setInterval>);
    }
    this.compassCalTimers = [];
  }

  // ── Log Download ────────────────────────────────────

  async getLogList(): Promise<LogEntry[]> {
    const baseTime = Math.floor(Date.now() / 1000) - 86400; // 1 day ago
    return [
      { id: 1, numLogs: 5, lastLogId: 5, size: 24576,  timeUtc: baseTime - 86400 * 4 },
      { id: 2, numLogs: 5, lastLogId: 5, size: 51200,  timeUtc: baseTime - 86400 * 3 },
      { id: 3, numLogs: 5, lastLogId: 5, size: 102400, timeUtc: baseTime - 86400 * 2 },
      { id: 4, numLogs: 5, lastLogId: 5, size: 32768,  timeUtc: baseTime - 86400 },
      { id: 5, numLogs: 5, lastLogId: 5, size: 16384,  timeUtc: baseTime },
    ];
  }

  async downloadLog(_logId: number, onProgress?: LogDownloadProgressCallback): Promise<Uint8Array> {
    const totalSize = 4096;
    const chunkSize = 90;
    const chunks = Math.ceil(totalSize / chunkSize);

    // Simulate chunked progress
    for (let i = 0; i < chunks; i++) {
      await new Promise((r) => setTimeout(r, 100));
      if (onProgress) onProgress(Math.min((i + 1) * chunkSize, totalSize), totalSize);
    }

    // Return small Uint8Array with ArduPilot log header magic
    const data = new Uint8Array(totalSize);
    data[0] = 0xa3; // ArduPilot log header magic byte 1
    data[1] = 0x95; // ArduPilot log header magic byte 2
    return data;
  }

  async eraseAllLogs(): Promise<CommandResult> {
    this.emitStatusText(6, "All logs erased");
    return ok("Logs erased");
  }

  cancelLogDownload(): void {
    // no-op in mock
  }

  // ── Motor Test ──────────────────────────────────────────

  async motorTest(motor: number, throttle: number, duration: number): Promise<CommandResult> {
    this.emitStatusText(6, `Motor ${motor} test: ${throttle}% for ${duration}s`);
    return ok(`Motor ${motor} tested`);
  }

  // ── Reboot ──────────────────────────────────────────────

  async rebootToBootloader(): Promise<CommandResult> {
    return ok("Reboot to bootloader (mock)");
  }

  async reboot(): Promise<CommandResult> {
    this.emitStatusText(5, "Rebooting...");
    return ok("Reboot (mock)");
  }

  // ── Serial Passthrough ──────────────────────────────────

  sendSerialData(): void {
    // no-op
  }

  // ── Telemetry Subscriptions ─────────────────────────────

  onAttitude(cb: AttitudeCallback): () => void { return sub(this.attitudeCbs, cb); }
  onPosition(cb: PositionCallback): () => void { return sub(this.positionCbs, cb); }
  onBattery(cb: BatteryCallback): () => void { return sub(this.batteryCbs, cb); }
  onGps(cb: GpsCallback): () => void { return sub(this.gpsCbs, cb); }
  onVfr(cb: VfrCallback): () => void { return sub(this.vfrCbs, cb); }
  onRc(cb: RcCallback): () => void { return sub(this.rcCbs, cb); }
  onStatusText(cb: StatusTextCallback): () => void { return sub(this.statusTextCbs, cb); }
  onHeartbeat(cb: HeartbeatCallback): () => void { return sub(this.heartbeatCbs, cb); }
  onParameter(cb: ParameterCallback): () => void { return sub(this.parameterCbs, cb); }
  onSerialData(cb: SerialDataCallback): () => void { return sub(this.serialDataCbs, cb); }
  onSysStatus(cb: SysStatusCallback): () => void { return sub(this.sysStatusCbs, cb); }
  onRadio(cb: RadioCallback): () => void { return sub(this.radioCbs, cb); }
  onMissionProgress(cb: MissionProgressCallback): () => void { return sub(this.missionProgressCbs, cb); }
  onEkf(cb: EkfCallback): () => void { return sub(this.ekfCbs, cb); }
  onVibration(cb: VibrationCallback): () => void { return sub(this.vibrationCbs, cb); }
  onServoOutput(cb: ServoOutputCallback): () => void { return sub(this.servoOutputCbs, cb); }
  onWind(cb: WindCallback): () => void { return sub(this.windCbs, cb); }
  onTerrain(cb: TerrainCallback): () => void { return sub(this.terrainCbs, cb); }
  onMagCalProgress(cb: MagCalProgressCallback): () => void { return sub(this.magCalProgressCbs, cb); }
  onMagCalReport(cb: MagCalReportCallback): () => void { return sub(this.magCalReportCbs, cb); }
  onAccelCalPos(cb: AccelCalPosCallback): () => void { return sub(this.accelCalPosCbs, cb); }
  onHomePosition(cb: HomePositionCallback): () => void { return sub(this.homePositionCbs, cb); }
  onAutopilotVersion(cb: AutopilotVersionCallback): () => void { return sub(this.autopilotVersionCbs, cb); }
  onPowerStatus(cb: PowerStatusCallback): () => void { return sub(this.powerStatusCbs, cb); }
  onDistanceSensor(cb: DistanceSensorCallback): () => void { return sub(this.distanceSensorCbs, cb); }
  onFenceStatus(cb: FenceStatusCallback): () => void { return sub(this.fenceStatusCbs, cb); }
  onNavController(cb: NavControllerCallback): () => void { return sub(this.navControllerCbs, cb); }
  onScaledImu(cb: ScaledImuCallback): () => void { return sub(this.scaledImuCbs, cb); }
  onLinkLost(cb: LinkStateCallback): () => void { return sub(this.linkLostCbs, cb); }
  onLinkRestored(cb: LinkStateCallback): () => void { return sub(this.linkRestoredCbs, cb); }
  async requestMessage(): Promise<CommandResult> { return ok("Message requested"); }
  async setMessageInterval(): Promise<CommandResult> { return ok("Interval set"); }

  // ── Info ────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo {
    return MOCK_VEHICLE_INFO;
  }

  getCapabilities(): ProtocolCapabilities {
    return this.handler.getCapabilities();
  }

  getFirmwareHandler(): FirmwareHandler {
    return this.handler;
  }
}
