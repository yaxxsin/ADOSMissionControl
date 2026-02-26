/**
 * Protocol abstraction layer types for Altnautica Command GCS.
 *
 * Defines a firmware-agnostic interface (`DroneProtocol`) so the GCS
 * can talk to ArduPilot, PX4, and (future) Betaflight/iNav through
 * a single API surface. Telemetry callback shapes are intentionally
 * compatible with the store types in `../types.ts`.
 *
 * @module protocol/types
 */

// ── Transport ───────────────────────────────────────────────

/** Events emitted by a byte-level transport. */
type TransportEventMap = {
  data: Uint8Array;
  close: void;
  error: Error;
};

/** Generic byte-level connection to a flight controller. */
export interface Transport {
  readonly type: "webserial" | "websocket" | "tcp" | "udp-proxy";
  connect(...args: unknown[]): Promise<void>;
  disconnect(): Promise<void>;
  send(data: Uint8Array): void;
  on<K extends keyof TransportEventMap>(
    event: K,
    handler: (data: TransportEventMap[K]) => void,
  ): void;
  off<K extends keyof TransportEventMap>(
    event: K,
    handler: (data: TransportEventMap[K]) => void,
  ): void;
  readonly isConnected: boolean;
}

// ── Firmware / Vehicle Enums ────────────────────────────────

/** Autopilot firmware identifier derived from MAV_AUTOPILOT + MAV_TYPE. */
export type FirmwareType =
  | "ardupilot-copter"
  | "ardupilot-plane"
  | "ardupilot-rover"
  | "ardupilot-sub"
  | "px4"
  | "betaflight"
  | "inav"
  | "unknown";

/**
 * Unified flight mode — superset across all supported firmwares.
 *
 * The protocol adapter maps firmware-specific mode numbers to/from
 * this union so the UI never needs firmware-specific logic.
 */
export type UnifiedFlightMode =
  // Common
  | "STABILIZE"
  | "ACRO"
  | "ALT_HOLD"
  | "AUTO"
  | "GUIDED"
  | "LOITER"
  | "RTL"
  | "LAND"
  | "CIRCLE"
  | "POSHOLD"
  | "AUTOTUNE"
  | "MANUAL"
  // ArduPlane specific
  | "TRAINING"
  | "FBWA"
  | "FBWB"
  | "CRUISE"
  | "AVOID_ADSB"
  | "THERMAL"
  | "QSTABILIZE"
  | "QHOVER"
  | "QLOITER"
  | "QLAND"
  | "QRTL"
  | "QAUTOTUNE"
  | "QACRO"
  | "LOITER_TO_QLAND"
  // ArduCopter specific
  | "DRIFT"
  | "SPORT"
  | "FLIP"
  | "THROW"
  | "BRAKE"
  | "SMART_RTL"
  | "FLOWHOLD"
  | "FOLLOW"
  | "ZIGZAG"
  | "SYSTEMID"
  | "HELI_AUTOROTATE"
  | "AUTO_RTL"
  // PX4
  | "OFFBOARD"
  | "RATTITUDE"
  | "MISSION"
  | "TAKEOFF"
  | "FOLLOW_ME"
  | "ORBIT"
  // Generic
  | "UNKNOWN";

/** High-level vehicle class. */
export type VehicleClass = "copter" | "plane" | "rover" | "sub" | "vtol" | "unknown";

// ── Vehicle Info ────────────────────────────────────────────

/** Identity snapshot extracted from the first HEARTBEAT. */
export interface VehicleInfo {
  firmwareType: FirmwareType;
  vehicleClass: VehicleClass;
  firmwareVersionString: string;
  systemId: number;
  componentId: number;
  /** Raw MAV_AUTOPILOT enum value. */
  autopilotType: number;
  /** Raw MAV_TYPE enum value. */
  vehicleType: number;
}

// ── Command Result ──────────────────────────────────────────

/** Result of a command acknowledged by the flight controller. */
export interface CommandResult {
  success: boolean;
  /** Raw MAV_RESULT enum value. */
  resultCode: number;
  message: string;
}

// ── Parameters ──────────────────────────────────────────────

/** A single on-board parameter value. */
export interface ParameterValue {
  name: string;
  value: number;
  /** MAV_PARAM_TYPE enum. */
  type: number;
  index: number;
  count: number;
}

// ── Capabilities ────────────────────────────────────────────

/** Feature gates — what the connected firmware actually supports. */
export interface ProtocolCapabilities {
  supportsArming: boolean;
  supportsFlightModes: boolean;
  supportsMissionUpload: boolean;
  supportsMissionDownload: boolean;
  supportsManualControl: boolean;
  supportsParameters: boolean;
  supportsCalibration: boolean;
  supportsSerialPassthrough: boolean;
  supportsMotorTest: boolean;
  supportsGeoFence: boolean;
  supportsRally: boolean;
  supportsLogDownload: boolean;
}

// ── PID ─────────────────────────────────────────────────────

/** Single-axis PID gains. */
export interface PidValues {
  p: number;
  i: number;
  d: number;
  f?: number;
}

/** PID profile for the three principal axes. */
export interface PidProfile {
  roll: PidValues;
  pitch: PidValues;
  yaw: PidValues;
}

// ── Telemetry Callbacks ─────────────────────────────────────
// Shapes are kept compatible with the store types (AttitudeData, etc.)
// so protocol → store bridging is a plain assignment.

export type AttitudeCallback = (data: {
  timestamp: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollSpeed: number;
  pitchSpeed: number;
  yawSpeed: number;
}) => void;

export type PositionCallback = (data: {
  timestamp: number;
  lat: number;
  lon: number;
  alt: number;
  relativeAlt: number;
  heading: number;
  groundSpeed: number;
  airSpeed: number;
  climbRate: number;
}) => void;

export type BatteryCallback = (data: {
  timestamp: number;
  voltage: number;
  current: number;
  remaining: number;
  consumed: number;
}) => void;

export type GpsCallback = (data: {
  timestamp: number;
  fixType: number;
  satellites: number;
  hdop: number;
  lat: number;
  lon: number;
  alt: number;
}) => void;

export type VfrCallback = (data: {
  timestamp: number;
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}) => void;

export type RcCallback = (data: {
  timestamp: number;
  channels: number[];
  rssi: number;
}) => void;

export type StatusTextCallback = (data: {
  severity: number;
  text: string;
}) => void;

export type HeartbeatCallback = (data: {
  armed: boolean;
  mode: UnifiedFlightMode;
  systemStatus: number;
  vehicleInfo: VehicleInfo;
}) => void;

export type ParameterCallback = (data: ParameterValue) => void;

export type SerialDataCallback = (data: { device: number; data: Uint8Array }) => void;

export type SysStatusCallback = (data: {
  timestamp: number;
  cpuLoad: number;
  sensorsPresent: number;
  sensorsEnabled: number;
  sensorsHealthy: number;
  voltageMv: number;
  currentCa: number;
  batteryRemaining: number;
  dropRateComm: number;
  errorsComm: number;
}) => void;

export type RadioCallback = (data: {
  timestamp: number;
  rssi: number;
  remrssi: number;
  txbuf: number;
  noise: number;
  remnoise: number;
  rxerrors: number;
  fixed: number;
}) => void;

export type MissionProgressCallback = (data: {
  currentSeq: number;
  reachedSeq?: number;
}) => void;

export type EkfCallback = (data: {
  timestamp: number;
  velocityVariance: number;
  posHorizVariance: number;
  posVertVariance: number;
  compassVariance: number;
  terrainAltVariance: number;
  flags: number;
}) => void;

export type VibrationCallback = (data: {
  timestamp: number;
  vibrationX: number;
  vibrationY: number;
  vibrationZ: number;
  clipping0: number;
  clipping1: number;
  clipping2: number;
}) => void;

export type ServoOutputCallback = (data: {
  timestamp: number;
  port: number;
  servos: number[];
}) => void;

export type WindCallback = (data: {
  timestamp: number;
  direction: number;
  speed: number;
  speedZ: number;
}) => void;

export type TerrainCallback = (data: {
  timestamp: number;
  lat: number;
  lon: number;
  terrainHeight: number;
  currentHeight: number;
  spacing: number;
  pending: number;
  loaded: number;
}) => void;

export type MagCalProgressCallback = (data: {
  compassId: number;
  completionPct: number;
  calStatus: number;
  completionMask: number[];
  directionX: number;
  directionY: number;
  directionZ: number;
}) => void;

export type MagCalReportCallback = (data: {
  compassId: number;
  calStatus: number;
  autosaved: number;
  ofsX: number;
  ofsY: number;
  ofsZ: number;
  fitness: number;
  diagX: number;
  diagY: number;
  diagZ: number;
  offdiagX: number;
  offdiagY: number;
  offdiagZ: number;
  orientationConfidence: number;
  oldOrientation: number;
  newOrientation: number;
  scaleFactor: number;
}) => void;

/** Accel cal position enum (matches ACCELCAL_VEHICLE_POS). */
export type AccelCalPosition = 1 | 2 | 3 | 4 | 5 | 6;

export type AccelCalPosCallback = (data: { position: AccelCalPosition }) => void;

export type HomePositionCallback = (data: {
  timestamp: number;
  lat: number;
  lon: number;
  alt: number;
}) => void;

export type AutopilotVersionCallback = (data: {
  capabilities: number;
  flightSwVersion: number;
  middlewareSwVersion: number;
  osSwVersion: number;
  boardVersion: number;
  uid: number;
}) => void;

export type PowerStatusCallback = (data: {
  timestamp: number;
  vcc: number;
  vservo: number;
  flags: number;
}) => void;

export type DistanceSensorCallback = (data: {
  timestamp: number;
  currentDistance: number;
  minDistance: number;
  maxDistance: number;
  orientation: number;
  id: number;
  covariance: number;
}) => void;

export type FenceStatusCallback = (data: {
  timestamp: number;
  breachStatus: number;
  breachCount: number;
  breachType: number;
}) => void;

export type NavControllerCallback = (data: {
  timestamp: number;
  navBearing: number;
  targetBearing: number;
  wpDist: number;
  altError: number;
  xtrackError: number;
}) => void;

export type ScaledImuCallback = (data: {
  timestamp: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xmag: number;
  ymag: number;
  zmag: number;
}) => void;

export type LinkStateCallback = () => void;

// ── Mission Items ───────────────────────────────────────────

/** Wire-format mission item for upload/download (INT variant). */
export interface MissionItem {
  seq: number;
  /** MAV_FRAME enum. */
  frame: number;
  /** MAV_CMD enum. */
  command: number;
  current: number;
  autocontinue: number;
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  /** Latitude * 1e7. */
  x: number;
  /** Longitude * 1e7. */
  y: number;
  /** Altitude in meters. */
  z: number;
}

// ── Firmware Handler ────────────────────────────────────────

/**
 * Firmware-specific behaviour that differs between autopilots.
 *
 * One handler instance per firmware type. The MAVLink protocol
 * implementation delegates mode encoding/decoding and capability
 * queries here.
 */
export interface FirmwareHandler {
  readonly firmwareType: FirmwareType;
  readonly vehicleClass: VehicleClass;

  /** Convert a unified mode name to the baseMode + customMode pair the FC expects. */
  encodeFlightMode(mode: UnifiedFlightMode): { baseMode: number; customMode: number };

  /** Convert a raw customMode from HEARTBEAT into a unified mode name. */
  decodeFlightMode(customMode: number): UnifiedFlightMode;

  /** List of modes the UI should offer for this firmware. */
  getAvailableModes(): UnifiedFlightMode[];

  /** Mode to select when no explicit mode is set. */
  getDefaultMode(): UnifiedFlightMode;

  /** What this firmware can do. */
  getCapabilities(): ProtocolCapabilities;

  /** Human-readable firmware version string (may read from params). */
  getFirmwareVersion(params?: Map<string, number>): string;
}

// ── Main Protocol Interface ─────────────────────────────────

/**
 * Top-level protocol interface that the GCS talks to.
 *
 * Implementations (MAVLink, future MSP) fulfill this contract.
 * The Zustand `DroneManager` store holds a `DroneProtocol` per
 * connected vehicle and bridges telemetry callbacks into reactive
 * store state.
 */
export interface DroneProtocol {
  readonly protocolName: string;

  // ── Connection ──────────────────────────────────────────
  connect(transport: Transport): Promise<VehicleInfo>;
  disconnect(): Promise<void>;
  readonly isConnected: boolean;

  // ── Commands ────────────────────────────────────────────
  arm(): Promise<CommandResult>;
  disarm(): Promise<CommandResult>;
  setFlightMode(mode: UnifiedFlightMode): Promise<CommandResult>;
  returnToLaunch(): Promise<CommandResult>;
  land(): Promise<CommandResult>;
  takeoff(altitude: number): Promise<CommandResult>;
  killSwitch(): Promise<CommandResult>;
  guidedGoto(lat: number, lon: number, alt: number): Promise<CommandResult>;
  pauseMission(): Promise<CommandResult>;
  resumeMission(): Promise<CommandResult>;
  clearMission(): Promise<CommandResult>;
  commitParamsToFlash(): Promise<CommandResult>;

  // ── Field Operations ──────────────────────────────────────
  setHome(useCurrent: boolean, lat?: number, lon?: number, alt?: number): Promise<CommandResult>;
  changeSpeed(speedType: number, speed: number): Promise<CommandResult>;
  setYaw(angle: number, speed: number, direction: number, relative: boolean): Promise<CommandResult>;
  setGeoFenceEnabled(enabled: boolean): Promise<CommandResult>;
  setServo(servoNumber: number, pwm: number): Promise<CommandResult>;
  cameraTrigger(): Promise<CommandResult>;
  setGimbalAngle(pitch: number, roll: number, yaw: number): Promise<CommandResult>;
  doPreArmCheck(): Promise<CommandResult>;

  // ── Manual Control ──────────────────────────────────────
  /** Send MANUAL_CONTROL at up to 50 Hz. Fire-and-forget (no ACK). */
  sendManualControl(
    roll: number,
    pitch: number,
    throttle: number,
    yaw: number,
    buttons: number,
  ): void;

  // ── Parameters ──────────────────────────────────────────
  getAllParameters(): Promise<ParameterValue[]>;
  getParameter(name: string): Promise<ParameterValue>;
  setParameter(name: string, value: number, type?: number): Promise<CommandResult>;
  resetParametersToDefault(): Promise<CommandResult>;

  // ── Mission ─────────────────────────────────────────────
  uploadMission(items: MissionItem[]): Promise<CommandResult>;
  downloadMission(): Promise<MissionItem[]>;
  setCurrentMissionItem(seq: number): Promise<CommandResult>;

  // ── Calibration ─────────────────────────────────────────
  startCalibration(
    type: "accel" | "gyro" | "compass" | "level" | "airspeed",
  ): Promise<CommandResult>;
  /** Send COMMAND_LONG(42429) to confirm accel cal position (fire-and-forget). */
  confirmAccelCalPos?(position: number): void;
  /** Send DO_ACCEPT_MAG_CAL (42425). compassMask=0 means all. */
  acceptCompassCal?(compassMask?: number): Promise<CommandResult>;
  /** Send DO_CANCEL_MAG_CAL (42426). compassMask=0 means all. */
  cancelCompassCal?(compassMask?: number): Promise<CommandResult>;

  // ── Motor Test ──────────────────────────────────────────
  motorTest(motor: number, throttle: number, duration: number): Promise<CommandResult>;

  // ── Reboot ──────────────────────────────────────────────
  rebootToBootloader(): Promise<CommandResult>;
  reboot(): Promise<CommandResult>;

  // ── Telemetry Subscriptions ─────────────────────────────
  // Each returns an unsubscribe function.
  onAttitude(callback: AttitudeCallback): () => void;
  onPosition(callback: PositionCallback): () => void;
  onBattery(callback: BatteryCallback): () => void;
  onGps(callback: GpsCallback): () => void;
  onVfr(callback: VfrCallback): () => void;
  onRc(callback: RcCallback): () => void;
  onStatusText(callback: StatusTextCallback): () => void;
  onHeartbeat(callback: HeartbeatCallback): () => void;
  onParameter(callback: ParameterCallback): () => void;
  onSerialData(callback: SerialDataCallback): () => void;
  onSysStatus(callback: SysStatusCallback): () => void;
  onRadio(callback: RadioCallback): () => void;
  onMissionProgress(callback: MissionProgressCallback): () => void;
  onEkf(callback: EkfCallback): () => void;
  onVibration(callback: VibrationCallback): () => void;
  onServoOutput(callback: ServoOutputCallback): () => void;
  onWind(callback: WindCallback): () => void;
  onTerrain(callback: TerrainCallback): () => void;
  onMagCalProgress?(callback: MagCalProgressCallback): () => void;
  onMagCalReport?(callback: MagCalReportCallback): () => void;
  onAccelCalPos?(callback: AccelCalPosCallback): () => void;
  onHomePosition?(callback: HomePositionCallback): () => void;
  onAutopilotVersion?(callback: AutopilotVersionCallback): () => void;
  onPowerStatus?(callback: PowerStatusCallback): () => void;
  onDistanceSensor?(callback: DistanceSensorCallback): () => void;
  onFenceStatus?(callback: FenceStatusCallback): () => void;
  onNavController?(callback: NavControllerCallback): () => void;
  onScaledImu?(callback: ScaledImuCallback): () => void;
  onLinkLost?(callback: LinkStateCallback): () => void;
  onLinkRestored?(callback: LinkStateCallback): () => void;

  // ── Serial Passthrough ──────────────────────────────────
  /** Send a string as SERIAL_CONTROL data to the FC shell. */
  sendSerialData(text: string): void;

  // ── Message Rate Control ────────────────────────────────
  /** Request a single message by ID (MAV_CMD_REQUEST_MESSAGE = 512). */
  requestMessage?(msgId: number): Promise<CommandResult>;
  /** Set streaming interval for a message (MAV_CMD_SET_MESSAGE_INTERVAL = 511). */
  setMessageInterval?(msgId: number, intervalUs: number): Promise<CommandResult>;

  // ── Info ─────────────────────────────────────────────────
  getVehicleInfo(): VehicleInfo | null;
  getCapabilities(): ProtocolCapabilities;
  getFirmwareHandler(): FirmwareHandler | null;
}
