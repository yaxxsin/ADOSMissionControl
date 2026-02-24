/**
 * @module types
 * @description Core TypeScript types for Altnautica Command GCS.
 * Covers drone state, telemetry, fleet, mission planning, video, input, UI,
 * hardware, flight history, and analytics domains.
 * @license GPL-3.0-only
 */

// ── Drone State ──────────────────────────────────────────────

export type DroneStatus = "online" | "in_mission" | "idle" | "returning" | "maintenance" | "offline";
export type ConnectionState = "disconnected" | "connecting" | "connected" | "armed" | "in_flight";
export type FlightMode =
  | "STABILIZE" | "ALT_HOLD" | "LOITER" | "GUIDED" | "AUTO" | "RTL" | "LAND" | "MANUAL" | "ACRO"
  // ArduPlane modes
  | "FBWA" | "FBWB" | "CRUISE" | "TRAINING" | "CIRCLE" | "AUTOTUNE"
  | "QSTABILIZE" | "QHOVER" | "QLOITER" | "QLAND" | "QRTL" | "QAUTOTUNE" | "QACRO"
  | "AVOID_ADSB" | "THERMAL"
  // ArduCopter modes
  | "POSHOLD" | "BRAKE" | "SMART_RTL" | "DRIFT" | "SPORT" | "FLIP" | "THROW";
export type ArmState = "disarmed" | "armed";

export interface DroneInfo {
  id: string;
  name: string;
  status: DroneStatus;
  suiteName?: string;
  suiteType?: SuiteType;
  connectionState: ConnectionState;
  flightMode: FlightMode;
  armState: ArmState;
  lastHeartbeat: number;
  firmwareVersion?: string;
  frameType?: string;
}

// ── Telemetry ────────────────────────────────────────────────

export interface AttitudeData {
  timestamp: number;
  roll: number;    // degrees
  pitch: number;   // degrees
  yaw: number;     // degrees (heading)
  rollSpeed: number;
  pitchSpeed: number;
  yawSpeed: number;
}

export interface PositionData {
  timestamp: number;
  lat: number;
  lon: number;
  alt: number;        // meters AGL
  relativeAlt: number;
  heading: number;    // degrees 0-360
  groundSpeed: number; // m/s
  airSpeed: number;    // m/s
  climbRate: number;   // m/s
}

export interface BatteryData {
  timestamp: number;
  voltage: number;     // volts
  current: number;     // amps
  remaining: number;   // percentage 0-100
  consumed: number;    // mAh
  temperature?: number; // celsius
}

export interface GpsData {
  timestamp: number;
  fixType: number;     // 0=none, 2=2D, 3=3D
  satellites: number;
  hdop: number;
  lat: number;
  lon: number;
  alt: number;         // meters MSL
}

export interface VfrData {
  timestamp: number;
  airspeed: number;    // m/s
  groundspeed: number; // m/s
  heading: number;     // degrees
  throttle: number;    // percentage 0-100
  alt: number;         // meters
  climb: number;       // m/s
}

export interface RcData {
  timestamp: number;
  channels: number[];  // RC channel values (typically 16 channels)
  rssi: number;        // signal strength 0-255
}

// ── SYS_STATUS ─────────────────────────────────────────────
export interface SysStatusData {
  timestamp: number;
  cpuLoad: number;            // 0-1000 (0.1% units)
  sensorsPresent: number;     // raw bitmask
  sensorsEnabled: number;
  sensorsHealthy: number;
  voltageMv: number;
  currentCa: number;
  batteryRemaining: number;
  dropRateComm: number;
  errorsComm: number;
}

// ── Radio Link ─────────────────────────────────────────────
export interface RadioData {
  timestamp: number;
  rssi: number;
  remrssi: number;
  txbuf: number;
  noise: number;
  remnoise: number;
  rxerrors: number;
  fixed: number;
}

// ── EKF Status ──────────────────────────────────────────────

export interface EkfData {
  timestamp: number;
  velocityVariance: number;
  posHorizVariance: number;
  posVertVariance: number;
  compassVariance: number;
  terrainAltVariance: number;
  flags: number;
}

// ── Vibration ───────────────────────────────────────────────

export interface VibrationData {
  timestamp: number;
  vibrationX: number;
  vibrationY: number;
  vibrationZ: number;
  clipping0: number;
  clipping1: number;
  clipping2: number;
}

// ── Servo Output ────────────────────────────────────────────

export interface ServoOutputData {
  timestamp: number;
  port: number;
  servos: number[];  // up to 8 PWM values
}

// ── Wind ────────────────────────────────────────────────────

export interface WindData {
  timestamp: number;
  direction: number;  // degrees
  speed: number;      // m/s
  speedZ: number;     // m/s
}

// ── Terrain ─────────────────────────────────────────────────

export interface TerrainData {
  timestamp: number;
  lat: number;
  lon: number;
  terrainHeight: number;  // m AMSL
  currentHeight: number;  // m above terrain
  spacing: number;
  pending: number;
  loaded: number;
}

// ── Fleet ────────────────────────────────────────────────────

export interface FleetDrone extends DroneInfo {
  position?: PositionData;
  battery?: BatteryData;
  gps?: GpsData;
  healthScore: number; // 0-100
}

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  id: string;
  droneId: string;
  droneName: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// ── Mission ──────────────────────────────────────────────────

export type SuiteType = "sentry" | "survey" | "agriculture" | "cargo" | "sar" | "inspection";

export interface Waypoint {
  id: string;
  lat: number;
  lon: number;
  alt: number;         // meters AGL
  speed?: number;      // m/s
  holdTime?: number;   // seconds
  command?: WaypointCommand;
  param1?: number;
  param2?: number;
  param3?: number;
}

/** MAVLink command types supported in mission waypoints. */
export type WaypointCommand =
  | "WAYPOINT" | "SPLINE_WAYPOINT" | "LOITER" | "LOITER_TIME" | "LOITER_TURNS"
  | "TAKEOFF" | "LAND" | "RTL" | "ROI" | "DO_SET_SPEED"
  | "DO_SET_CAM_TRIGG" | "DO_DIGICAM" | "DO_JUMP" | "DELAY" | "CONDITION_YAW";

/** Available tools in the map toolbar. */
export type PlannerTool = "select" | "waypoint" | "polygon" | "circle" | "measure";

/** Altitude reference frame for waypoints. */
export type AltitudeFrame = "relative" | "absolute" | "terrain";

export type MissionState = "idle" | "planning" | "uploading" | "uploaded" | "running" | "paused" | "completed" | "aborted";

export interface Mission {
  id: string;
  name: string;
  droneId: string;
  suiteType?: SuiteType;
  templateName?: string;
  waypoints: Waypoint[];
  state: MissionState;
  progress: number;      // 0-100
  currentWaypoint: number;
  estimatedTime?: number; // seconds
  estimatedDistance?: number; // meters
  startedAt?: number;
  completedAt?: number;
}

// ── Video ────────────────────────────────────────────────────

export interface VideoState {
  streamUrl: string | null;
  isStreaming: boolean;
  isRecording: boolean;
  fps: number;
  latencyMs: number;
  resolution?: string;
}

// ── Input ────────────────────────────────────────────────────

export type InputController = "keyboard" | "gamepad" | "rc_tx" | "none";

export interface InputState {
  activeController: InputController;
  axes: [number, number, number, number]; // roll, pitch, throttle, yaw (-1 to 1)
  buttons: boolean[];
  deadzone: number;
  expo: number;
}

// ── UI ───────────────────────────────────────────────────────

export type ViewId =
  | "dashboard"
  | "fly"
  | "plan"
  | "history"
  | "analytics"
  | "config"
  | "wizard";

export interface PanelState {
  telemetry: boolean;
  alerts: boolean;
  chat: boolean;
}

// ── Hardware ─────────────────────────────────────────────────

export interface HardwareComponent {
  id: string;
  name: string;
  type: "compute" | "fc" | "esc" | "motor" | "sensor" | "camera" | "radio" | "gps" | "battery" | "frame";
  status: "ok" | "warning" | "error" | "offline";
  details?: Record<string, string | number>;
}

export interface HardwareConnection {
  id: string;
  source: string;  // component id
  target: string;  // component id
  protocol: string; // e.g. "UART", "SPI", "I2C", "USB", "PWM", "CAN"
  label?: string;
}

// ── Flight History ───────────────────────────────────────────

export interface FlightRecord {
  id: string;
  droneId: string;
  droneName: string;
  suiteType?: SuiteType;
  date: number;          // timestamp
  duration: number;       // seconds
  distance: number;       // meters
  maxAlt: number;         // meters
  maxSpeed: number;       // m/s
  batteryUsed: number;    // percentage
  waypointCount: number;
  status: "completed" | "aborted" | "emergency";
  path?: [number, number][]; // [lat, lon][]
}

// ── Analytics ────────────────────────────────────────────────

export interface AnalyticsData {
  totalFlights: number;
  totalFlightTime: number;    // seconds
  totalDistance: number;       // meters
  avgFlightTime: number;       // seconds
  avgBatteryUsed: number;      // percentage
  missionSuccessRate: number;  // percentage
  flightsPerDay: { date: string; count: number }[];
  utilizationByDrone: { droneId: string; droneName: string; hours: number }[];
  batteryDegradation: { date: string; avgCapacity: number }[];
}
