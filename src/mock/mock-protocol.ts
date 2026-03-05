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
  ScaledPressureCallback,
  EstimatorStatusCallback,
  CameraTriggerCallback,
  LinkStateCallback,
  LocalPositionCallback,
  DebugCallback,
  GimbalAttitudeCallback,
  ObstacleDistanceCallback,
  CameraImageCapturedCallback,
  ExtendedSysStateCallback,
  FencePointCallback,
  SystemTimeCallback,
  RawImuCallback,
  RcChannelsRawCallback,
  RcChannelsOverrideCallback,
  MissionItemCallback,
  AltitudeCallback,
  WindCovCallback,
  AisVesselCallback,
  GimbalManagerInfoCallback,
  GimbalManagerStatusCallback,
} from "@/lib/protocol/types";
import { ArduCopterHandler } from "@/lib/protocol/firmware/ardupilot";
import { PX4Handler } from "@/lib/protocol/firmware/px4";
import { MOCK_PARAMS, PX4_MOCK_PARAMS, type MockParam } from "./mock-params";

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

// ── Mock fence polygon (~200m radius around Bangalore mock home) ────

const MOCK_HOME_LAT = 12.9716;
const MOCK_HOME_LON = 77.5946;

/** 5-point polygon fence centered on mock home, ~200m radius. */
export const MOCK_FENCE_POLYGON: Array<{ idx: number; lat: number; lon: number }> = [
  { idx: 0, lat: MOCK_HOME_LAT + 0.0018,  lon: MOCK_HOME_LON },          // North
  { idx: 1, lat: MOCK_HOME_LAT + 0.00056, lon: MOCK_HOME_LON + 0.00171 }, // NE
  { idx: 2, lat: MOCK_HOME_LAT - 0.00145, lon: MOCK_HOME_LON + 0.00106 }, // SE
  { idx: 3, lat: MOCK_HOME_LAT - 0.00145, lon: MOCK_HOME_LON - 0.00106 }, // SW
  { idx: 4, lat: MOCK_HOME_LAT + 0.00056, lon: MOCK_HOME_LON - 0.00171 }, // NW
];

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

const PX4_VEHICLE_INFO: VehicleInfo = {
  firmwareType: "px4",
  vehicleClass: "copter",
  firmwareVersionString: "PX4 v1.15.0",
  systemId: 1,
  componentId: 1,
  autopilotType: 12,  // MAV_AUTOPILOT_PX4
  vehicleType: 2,     // MAV_TYPE_QUADROTOR
};

// ── MockProtocol ────────────────────────────────────────────

export class MockProtocol implements DroneProtocol {
  readonly protocolName = "mock-mavlink";

  private _connected = true;
  private handler: FirmwareHandler;
  private _vehicleInfo: VehicleInfo;
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
  private scaledPressureCbs: ScaledPressureCallback[] = [];
  private estimatorStatusCbs: EstimatorStatusCallback[] = [];
  private cameraTriggerCbs: CameraTriggerCallback[] = [];
  private linkLostCbs: LinkStateCallback[] = [];
  private linkRestoredCbs: LinkStateCallback[] = [];
  private localPositionCbs: LocalPositionCallback[] = [];
  private debugCbs: DebugCallback[] = [];
  private gimbalAttitudeCbs: GimbalAttitudeCallback[] = [];
  private obstacleDistanceCbs: ObstacleDistanceCallback[] = [];
  private cameraImageCapturedCbs: CameraImageCapturedCallback[] = [];
  private extendedSysStateCbs: ExtendedSysStateCallback[] = [];
  private fencePointCbs: FencePointCallback[] = [];
  private systemTimeCbs: SystemTimeCallback[] = [];
  private rawImuCbs: RawImuCallback[] = [];
  private rcChannelsRawCbs: RcChannelsRawCallback[] = [];
  private rcChannelsOverrideCbs: RcChannelsOverrideCallback[] = [];
  private missionItemCbs: MissionItemCallback[] = [];
  private altitudeCbs: AltitudeCallback[] = [];
  private windCovCbs: WindCovCallback[] = [];
  private aisVesselCbs: AisVesselCallback[] = [];
  private gimbalManagerInfoCbs: GimbalManagerInfoCallback[] = [];
  private gimbalManagerStatusCbs: GimbalManagerStatusCallback[] = [];
  private accelCalTimers: ReturnType<typeof setTimeout>[] = [];
  private compassCalTimers: ReturnType<typeof setTimeout | typeof setInterval>[] = [];

  constructor(firmwareType: 'ardupilot-copter' | 'px4' = 'ardupilot-copter') {
    if (firmwareType === 'px4') {
      this.handler = new PX4Handler();
      this.defaults = PX4_MOCK_PARAMS;
      this._vehicleInfo = PX4_VEHICLE_INFO;
    } else {
      this.handler = new ArduCopterHandler();
      this.defaults = MOCK_PARAMS;
      this._vehicleInfo = MOCK_VEHICLE_INFO;
    }
    this.params = new Map();
    for (const p of this.defaults) {
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
        vehicleInfo: this._vehicleInfo,
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

  emitTerrain(data: Parameters<TerrainCallback>[0]): void {
    for (const cb of this.terrainCbs) cb(data);
  }

  emitScaledImu(data: Parameters<ScaledImuCallback>[0]): void {
    for (const cb of this.scaledImuCbs) cb(data);
  }

  emitScaledPressure(data: Parameters<ScaledPressureCallback>[0]): void {
    for (const cb of this.scaledPressureCbs) cb(data);
  }

  emitHomePosition(data: Parameters<HomePositionCallback>[0]): void {
    for (const cb of this.homePositionCbs) cb(data);
  }

  emitPowerStatus(data: Parameters<PowerStatusCallback>[0]): void {
    for (const cb of this.powerStatusCbs) cb(data);
  }

  emitDistanceSensor(data: Parameters<DistanceSensorCallback>[0]): void {
    for (const cb of this.distanceSensorCbs) cb(data);
  }

  emitFenceStatus(data: Parameters<FenceStatusCallback>[0]): void {
    for (const cb of this.fenceStatusCbs) cb(data);
  }

  emitEstimatorStatus(data: Parameters<EstimatorStatusCallback>[0]): void {
    for (const cb of this.estimatorStatusCbs) cb(data);
  }

  emitCameraTrigger(data: Parameters<CameraTriggerCallback>[0]): void {
    for (const cb of this.cameraTriggerCbs) cb(data);
  }

  emitNavController(data: Parameters<NavControllerCallback>[0]): void {
    for (const cb of this.navControllerCbs) cb(data);
  }

  emitLocalPosition(data: Parameters<LocalPositionCallback>[0]): void {
    for (const cb of this.localPositionCbs) cb(data);
  }

  emitDebug(data: Parameters<DebugCallback>[0]): void {
    for (const cb of this.debugCbs) cb(data);
  }

  emitGimbalAttitude(data: Parameters<GimbalAttitudeCallback>[0]): void {
    for (const cb of this.gimbalAttitudeCbs) cb(data);
  }

  emitObstacleDistance(data: Parameters<ObstacleDistanceCallback>[0]): void {
    for (const cb of this.obstacleDistanceCbs) cb(data);
  }

  emitCameraImageCaptured(data: Parameters<CameraImageCapturedCallback>[0]): void {
    for (const cb of this.cameraImageCapturedCbs) cb(data);
  }

  emitExtendedSysState(data: Parameters<ExtendedSysStateCallback>[0]): void {
    for (const cb of this.extendedSysStateCbs) cb(data);
  }

  emitFencePoint(data: Parameters<FencePointCallback>[0]): void {
    for (const cb of this.fencePointCbs) cb(data);
  }

  emitSystemTime(data: Parameters<SystemTimeCallback>[0]): void {
    for (const cb of this.systemTimeCbs) cb(data);
  }

  emitAutopilotVersion(data: Parameters<AutopilotVersionCallback>[0]): void {
    for (const cb of this.autopilotVersionCbs) cb(data);
  }

  // ── Connection ──────────────────────────────────────────

  get isConnected(): boolean {
    return this._connected;
  }

  async connect(_transport: Transport): Promise<VehicleInfo> {
    this._connected = true;
    return this._vehicleInfo;
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
  async doPreArmCheck(): Promise<CommandResult> {
    // Check RC channels against trim ± DZ (like real ArduPilot)
    const channelNames = ["Roll", "Pitch", "Throttle", "Yaw"];
    let hasFailure = false;
    for (let ch = 1; ch <= 4; ch++) {
      const trim = this.params.get(`RC${ch}_TRIM`)?.value ?? 1500;
      const dz = this.params.get(`RC${ch}_DZ`)?.value ?? 30;
      const live = this._rcChannelValues[ch - 1] ?? 1500;
      if (Math.abs(live - trim) > dz) {
        hasFailure = true;
        const name = channelNames[ch - 1] ?? `CH${ch}`;
        setTimeout(() => {
          this.emitStatusText(4, `Arm: ${name} (RC${ch}) is not neutral`);
        }, 100 * ch);
      }
    }
    if (!hasFailure) {
      setTimeout(() => this.emitStatusText(6, "PreArm: Ready to arm"), 200);
    }
    return ok("Pre-arm check");
  }

  /** Live RC channel values — set by mock engine for pre-arm checks */
  private _rcChannelValues: number[] = Array(16).fill(1500);

  setRcChannelValues(channels: number[]): void {
    this._rcChannelValues = channels;
  }

  // ── Fence Operations ────────────────────────────────────

  async uploadFence(_points: Array<{ lat: number; lon: number }>): Promise<CommandResult> {
    await new Promise((r) => setTimeout(r, 500));
    this.emitStatusText(6, "Fence uploaded");
    return ok("Fence uploaded");
  }

  async downloadFence(): Promise<Array<{ idx: number; lat: number; lon: number }>> {
    return MOCK_FENCE_POLYGON;
  }

  // ── Rally Point Operations ────────────────────────────────

  private rallyPoints: Array<{ lat: number; lon: number; alt: number }> = [];

  async uploadRallyPoints(points: Array<{ lat: number; lon: number; alt: number }>): Promise<CommandResult> {
    await new Promise((r) => setTimeout(r, 300));
    this.rallyPoints = [...points];
    this.emitStatusText(6, `${points.length} rally points uploaded`);
    return ok("Rally points uploaded");
  }

  async downloadRallyPoints(): Promise<Array<{ lat: number; lon: number; alt: number }>> {
    return [...this.rallyPoints];
  }

  // ── Guided Flight ──────────────────────────────────────

  sendPositionTarget(_lat: number, _lon: number, _alt: number): void {
    // no-op — guided mode position target
  }

  sendAttitudeTarget(_roll: number, _pitch: number, _yaw: number, _thrust: number): void {
    // no-op — guided mode attitude target
  }

  // ── Camera/Gimbal ──────────────────────────────────────

  async setCameraTriggerDistance(_distance: number): Promise<CommandResult> {
    return ok("Camera trigger distance set");
  }

  async setGimbalMode(_mode: number): Promise<CommandResult> {
    return ok("Gimbal mode set");
  }

  async setGimbalROI(_lat: number, _lon: number, _alt: number): Promise<CommandResult> {
    return ok("Gimbal ROI set");
  }

  // ── Advanced Calibration ───────────────────────────────

  async startEscCalibration(): Promise<CommandResult> {
    this.emitStatusText(3, "WARNING: ESC calibration will spin motors! Remove props!");
    return ok("ESC calibration started");
  }

  async startCompassMotCal(): Promise<CommandResult> {
    this.emitStatusText(6, "CompassMot calibration started — increase throttle slowly");
    return ok("CompassMot calibration started");
  }

  // ── Manual Control ──────────────────────────────────────

  sendManualControl(): void {
    // no-op — demo drones follow scripted paths
  }

  // ── Parameters ──────────────────────────────────────────

  getCachedParameterNames(): string[] {
    return Array.from(this.params.keys());
  }

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
    // Simulate network delay
    await new Promise((r) => setTimeout(r, 800));

    // 6 realistic waypoints around Bangalore: TAKEOFF → 4 waypoints → LAND
    return [
      { seq: 0, frame: 3, command: 22, current: 1, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9716 * 1e7), y: Math.round(77.5946 * 1e7), z: 50 },
      { seq: 1, frame: 3, command: 16, current: 0, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9736 * 1e7), y: Math.round(77.5966 * 1e7), z: 50 },
      { seq: 2, frame: 3, command: 16, current: 0, autocontinue: 1,
        param1: 5, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9756 * 1e7), y: Math.round(77.5946 * 1e7), z: 60 },
      { seq: 3, frame: 3, command: 16, current: 0, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9756 * 1e7), y: Math.round(77.5926 * 1e7), z: 60 },
      { seq: 4, frame: 3, command: 16, current: 0, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9736 * 1e7), y: Math.round(77.5926 * 1e7), z: 50 },
      { seq: 5, frame: 3, command: 21, current: 0, autocontinue: 1,
        param1: 0, param2: 0, param3: 0, param4: 0,
        x: Math.round(12.9716 * 1e7), y: Math.round(77.5946 * 1e7), z: 0 },
    ];
  }

  async setCurrentMissionItem(): Promise<CommandResult> {
    return ok("Mission item set");
  }

  // ── Calibration ─────────────────────────────────────────

  async startCalibration(type: "accel" | "gyro" | "compass" | "level" | "airspeed" | "baro" | "rc" | "esc" | "compassmot"): Promise<CommandResult> {
    const isPX4 = this._vehicleInfo.firmwareType === "px4";
    this.emitStatusText(6, `${type} calibration started`);

    if (type === "accel") {
      if (isPX4) {
        // PX4 accel cal: [cal] STATUSTEXT messages with side-done progression
        this.clearAccelTimers();
        const sides = ["back", "front", "left", "right", "up", "down"];
        this.emitStatusText(6, "[cal] calibration started: 4");
        let progress = 0;
        let sideIdx = 0;
        const iv = setInterval(() => {
          progress += 8;
          if (sideIdx < sides.length) {
            this.emitStatusText(6, `[cal] progress <${Math.min(progress, 95)}>`);
            // Every ~16% of progress, mark a side as done
            if (progress % 16 === 0 && sideIdx < sides.length) {
              this.emitStatusText(6, `[cal] ${sides[sideIdx]} side done, rotate to a different side`);
              sideIdx++;
            }
          }
          if (progress >= 100) {
            clearInterval(iv);
            this.emitStatusText(6, "[cal] calibration done: accel");
          }
        }, 500);
        this.accelCalTimers.push(iv as unknown as ReturnType<typeof setTimeout>);
      } else {
        // ArduPilot accel cal: 6-position with AccelCalPos callbacks
        this.clearAccelTimers();
        const t = setTimeout(() => this.emitAccelCalPos(1 as AccelCalPosition), 500);
        this.accelCalTimers.push(t);
      }
    } else if (type === "compass") {
      if (isPX4) {
        // PX4 compass cal: [cal] STATUSTEXT messages with progress
        this.clearCompassTimers();
        this.emitStatusText(6, "[cal] calibration started: 2");
        let progress = 0;
        const iv = setInterval(() => {
          progress += 10;
          if (progress < 100) {
            this.emitStatusText(6, `[cal] progress <${progress}>`);
          } else {
            clearInterval(iv);
            this.emitStatusText(6, "[cal] calibration done: mag");
          }
        }, 500);
        this.compassCalTimers.push(iv);
      } else {
        // ArduPilot compass cal: MAG_CAL_PROGRESS/REPORT callbacks
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
            // Report compass 0 (excellent fitness, autosaved=0 — requires manual accept)
            const t0 = setTimeout(() => {
              for (const cb of this.magCalReportCbs) {
                cb({
                  compassId: 0, calStatus: 4, autosaved: 0,
                  ofsX: 42.3, ofsY: -18.7, ofsZ: 105.1, fitness: 6.2,
                  diagX: 1.02, diagY: 0.98, diagZ: 1.01,
                  offdiagX: 0.005, offdiagY: -0.012, offdiagZ: 0.008,
                  orientationConfidence: 0.95,
                  oldOrientation: 0, newOrientation: 0, scaleFactor: 1.0,
                });
              }
            }, 300);
            // Report compass 1 — randomly succeeds (calStatus=4) or fails with warning (calStatus=6)
            // to test both the accept and force-save flows
            const compass1Fails = Math.random() < 0.3; // 30% chance of cal_warning
            const t1 = setTimeout(() => {
              for (const cb of this.magCalReportCbs) {
                cb({
                  compassId: 1, calStatus: compass1Fails ? 6 : 4, autosaved: 0,
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
      }
    } else if (type === "rc") {
      return { success: true, resultCode: 0, message: "RC calibration ready — follow on-screen instructions" };
    } else if (type === "esc") {
      // ESC cal simulation — longer with motor warning
      this.emitStatusText(3, "WARNING: ESC calibration will spin motors! Remove props!");
      setTimeout(() => this.emitStatusText(6, "ESC calibration: Set throttle to maximum"), 1000);
      setTimeout(() => this.emitStatusText(6, "ESC calibration: 50%"), 2000);
      setTimeout(() => this.emitStatusText(5, "ESC calibration successful"), 3500);
    } else if (type === "compassmot") {
      // CompassMot simulation
      setTimeout(() => this.emitStatusText(6, "CompassMot: Increasing throttle..."), 1000);
      setTimeout(() => this.emitStatusText(6, "CompassMot interference: 12% — Good"), 3000);
      setTimeout(() => this.emitStatusText(5, "CompassMot calibration successful"), 4000);
    } else if (type === "gyro") {
      if (isPX4) {
        // PX4 gyro cal: [cal] STATUSTEXT messages
        this.emitStatusText(6, "[cal] calibration started: 5");
        let progress = 0;
        const iv = setInterval(() => {
          progress += 20;
          if (progress < 100) {
            this.emitStatusText(6, `[cal] progress <${progress}>`);
          } else {
            clearInterval(iv);
            this.emitStatusText(6, "[cal] calibration done: gyro");
          }
        }, 400);
      } else {
        // Match real ArduPilot phrasing
        setTimeout(() => this.emitStatusText(6, "Gyro calibration started"), 200);
        setTimeout(() => this.emitStatusText(6, "Gyro calibration: 50%"), 1000);
        setTimeout(() => this.emitStatusText(5, "Gyro cal done"), 1800);
        setTimeout(() => this.emitStatusText(5, "gyro calibration successful"), 2000);
      }
    } else if (type === "level") {
      if (isPX4) {
        // PX4 level cal: [cal] STATUSTEXT messages
        this.emitStatusText(6, "[cal] calibration started: 6");
        let progress = 0;
        const iv = setInterval(() => {
          progress += 25;
          if (progress < 100) {
            this.emitStatusText(6, `[cal] progress <${progress}>`);
          } else {
            clearInterval(iv);
            this.emitStatusText(6, "[cal] calibration done: level");
          }
        }, 350);
      } else {
        // Match real ArduPilot phrasing — "Trim OK: roll=X pitch=Y yaw=Z"
        setTimeout(() => this.emitStatusText(6, "Level calibration started"), 200);
        setTimeout(() => this.emitStatusText(5, "Trim OK: roll=0.00 pitch=0.00 yaw=0.00"), 1500);
        setTimeout(() => this.emitStatusText(5, "level calibration successful"), 2000);
      }
    } else {
      // Airspeed/baro: simple progress → success
      if (isPX4) {
        const calTypeId = type === "airspeed" ? 7 : 8;
        this.emitStatusText(6, `[cal] calibration started: ${calTypeId}`);
        let progress = 0;
        const iv = setInterval(() => {
          progress += 20;
          if (progress < 100) {
            this.emitStatusText(6, `[cal] progress <${progress}>`);
          } else {
            clearInterval(iv);
            this.emitStatusText(6, `[cal] calibration done: ${type}`);
          }
        }, 500);
      } else {
        setTimeout(() => this.emitStatusText(6, `${type} calibration: 50%`), 1000);
        setTimeout(() => this.emitStatusText(5, `${type} calibration successful`), 2000);
      }
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

  async cancelCalibration(): Promise<CommandResult> {
    this.clearAccelTimers();
    return ok("Calibration cancelled");
  }

  async startGnssMagCal(): Promise<CommandResult> {
    this.emitStatusText(6, "[cal] calibration started: 2");
    setTimeout(() => {
      this.emitStatusText(6, "[cal] progress <50>");
      setTimeout(() => {
        this.emitStatusText(6, "[cal] calibration done: mag");
      }, 1000);
    }, 500);
    return ok("GNSS mag calibration started");
  }

  async sendCommand(_commandId: number, _params: number[]): Promise<CommandResult> {
    return ok("Command sent");
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
  onScaledPressure(cb: ScaledPressureCallback): () => void { return sub(this.scaledPressureCbs, cb); }
  onEstimatorStatus(cb: EstimatorStatusCallback): () => void { return sub(this.estimatorStatusCbs, cb); }
  onCameraTrigger(cb: CameraTriggerCallback): () => void { return sub(this.cameraTriggerCbs, cb); }
  onLinkLost(cb: LinkStateCallback): () => void { return sub(this.linkLostCbs, cb); }
  onLinkRestored(cb: LinkStateCallback): () => void { return sub(this.linkRestoredCbs, cb); }
  onLocalPosition(cb: LocalPositionCallback): () => void { return sub(this.localPositionCbs, cb); }
  onDebug(cb: DebugCallback): () => void { return sub(this.debugCbs, cb); }
  onGimbalAttitude(cb: GimbalAttitudeCallback): () => void { return sub(this.gimbalAttitudeCbs, cb); }
  onObstacleDistance(cb: ObstacleDistanceCallback): () => void { return sub(this.obstacleDistanceCbs, cb); }
  onCameraImageCaptured(cb: CameraImageCapturedCallback): () => void { return sub(this.cameraImageCapturedCbs, cb); }
  onExtendedSysState(cb: ExtendedSysStateCallback): () => void { return sub(this.extendedSysStateCbs, cb); }
  onFencePoint(cb: FencePointCallback): () => void { return sub(this.fencePointCbs, cb); }
  onSystemTime(cb: SystemTimeCallback): () => void { return sub(this.systemTimeCbs, cb); }
  onRawImu(cb: RawImuCallback): () => void { return sub(this.rawImuCbs, cb); }
  onRcChannelsRaw(cb: RcChannelsRawCallback): () => void { return sub(this.rcChannelsRawCbs, cb); }
  onRcChannelsOverride(cb: RcChannelsOverrideCallback): () => void { return sub(this.rcChannelsOverrideCbs, cb); }
  onMissionItem(cb: MissionItemCallback): () => void { return sub(this.missionItemCbs, cb); }
  onAltitude(cb: AltitudeCallback): () => void { return sub(this.altitudeCbs, cb); }
  onWindCov(cb: WindCovCallback): () => void { return sub(this.windCovCbs, cb); }
  onAisVessel(cb: AisVesselCallback): () => void { return sub(this.aisVesselCbs, cb); }
  onGimbalManagerInfo(cb: GimbalManagerInfoCallback): () => void { return sub(this.gimbalManagerInfoCbs, cb); }
  onGimbalManagerStatus(cb: GimbalManagerStatusCallback): () => void { return sub(this.gimbalManagerStatusCbs, cb); }
  async enableFence(_enable: boolean): Promise<CommandResult> { return ok("Fence updated"); }
  async doLandStart(): Promise<CommandResult> { return ok("Land start"); }
  async controlVideo(): Promise<CommandResult> { return ok("Video control"); }
  async setRelay(): Promise<CommandResult> { return ok("Relay set"); }
  async startRxPair(): Promise<CommandResult> { return ok("RX pair started"); }
  async requestMessage(messageId: number): Promise<CommandResult> {
    if (messageId === 148) {
      setTimeout(() => {
        this.emitAutopilotVersion({
          capabilities: 0xFF,
          flightSwVersion: 0x04050007,
          middlewareSwVersion: 0,
          osSwVersion: 0,
          boardVersion: 1032, // SpeedyBee F405 Wing (matches primary test board)
          uid: 0,
        });
      }, 0);
    }
    return ok("Message requested");
  }
  async setMessageInterval(): Promise<CommandResult> { return ok("Interval set"); }

  // ── Mock Telemetry Tick ─────────────────────────────────
  // Emits debug, gimbal, obstacle, localPosition, and cameraImageCaptured
  // on realistic intervals. Call startMockTelemetryTick() after connect.

  private tickTimers: ReturnType<typeof setInterval>[] = [];
  private imageIndex = 0;

  startMockTelemetryTick(): void {
    this.stopMockTelemetryTick();

    // Debug values: 3 named floats every 2 seconds
    this.tickTimers.push(
      setInterval(() => {
        const now = Date.now();
        this.emitDebug({ timestamp: now, name: "BaroAlt", value: 10 + Math.random() * 2, type: "float" });
        this.emitDebug({ timestamp: now, name: "RangefinderDist", value: 8 + Math.random() * 4, type: "float" });
        this.emitDebug({ timestamp: now, name: "OptFlowQual", value: 180 + Math.random() * 75, type: "float" });
      }, 2000),
    );

    // Gimbal attitude: oscillating pitch/roll, yaw follows heading, every 500ms
    let gimbalTick = 0;
    this.tickTimers.push(
      setInterval(() => {
        gimbalTick++;
        const t = gimbalTick * 0.05;
        this.emitGimbalAttitude({
          timestamp: Date.now(),
          pitch: -15 + -15 * Math.sin(t),          // oscillates -30 to 0
          roll: 5 * Math.sin(t * 1.3),              // oscillates ±5
          yaw: (gimbalTick * 2) % 360,              // slow rotation following heading
          angularVelocityX: 0,
          angularVelocityY: 0,
          angularVelocityZ: 0,
        });
      }, 500),
    );

    // Obstacle distances: 12 sectors, mostly far, 2 closer, every 1 second
    this.tickTimers.push(
      setInterval(() => {
        const distances = new Array(12).fill(1000);
        // Two sectors have closer obstacles (200-800cm range)
        distances[3] = 200 + Math.random() * 600;
        distances[9] = 200 + Math.random() * 600;
        this.emitObstacleDistance({
          timestamp: Date.now(),
          distances,
          minDistance: 20,
          maxDistance: 1200,
          increment: 30,       // 360/12
          incrementF: 30,
          angleOffset: 0,
          frame: 12,           // MAV_FRAME_BODY_FRD
        });
      }, 1000),
    );

    // Local position NED: derived from mock home, every 200ms
    let localTick = 0;
    this.tickTimers.push(
      setInterval(() => {
        localTick++;
        const t = localTick * 0.1;
        this.emitLocalPosition({
          timestamp: Date.now(),
          x: 10 * Math.sin(t * 0.3),    // North/South drift
          y: 10 * Math.cos(t * 0.2),    // East/West drift
          z: -(10 + Math.sin(t * 0.15)), // NED: negative = up
          vx: 0.3 * Math.cos(t * 0.3),
          vy: -0.2 * Math.sin(t * 0.2),
          vz: -0.1 * Math.cos(t * 0.15),
        });
      }, 200),
    );

    // Camera image captured: every 10 seconds
    this.tickTimers.push(
      setInterval(() => {
        this.imageIndex++;
        this.emitCameraImageCaptured({
          timestamp: Date.now(),
          lat: MOCK_HOME_LAT + (Math.random() - 0.5) * 0.001,
          lon: MOCK_HOME_LON + (Math.random() - 0.5) * 0.001,
          alt: 50 + Math.random() * 10,
          imageIndex: this.imageIndex,
          captureResult: 1,
          fileUrl: `IMG_${String(this.imageIndex).padStart(4, "0")}.jpg`,
        });
      }, 10000),
    );
  }

  stopMockTelemetryTick(): void {
    for (const t of this.tickTimers) clearInterval(t);
    this.tickTimers = [];
  }

  // ── Info ────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo {
    return this._vehicleInfo;
  }

  getCapabilities(): ProtocolCapabilities {
    return this.handler.getCapabilities();
  }

  getFirmwareHandler(): FirmwareHandler {
    return this.handler;
  }
}
