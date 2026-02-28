/**
 * PX4 firmware handler for Altnautica Command GCS.
 *
 * PX4 uses a different custom_mode encoding than ArduPilot:
 * main_mode in bits 16-23, sub_mode in bits 0-15.
 *
 * @module firmware/px4
 */

import type {
  FirmwareType,
  FirmwareHandler,
  UnifiedFlightMode,
  VehicleClass,
  ProtocolCapabilities,
} from '../types'

// ---------------------------------------------------------------------------
// PX4 mode constants
// ---------------------------------------------------------------------------

/** PX4 main mode IDs (bits 16-23 of custom_mode). */
const PX4_MAIN_MODE = {
  MANUAL: 1,
  ALTCTL: 2,
  POSCTL: 3,
  AUTO: 4,
  ACRO: 5,
  OFFBOARD: 6,
  STABILIZED: 7,
  RATTITUDE: 8,
} as const

/** PX4 auto sub-mode IDs (bits 0-15 of custom_mode). */
const PX4_AUTO_SUB = {
  READY: 1,
  TAKEOFF: 2,
  LOITER: 3,
  MISSION: 4,
  RTL: 5,
  LAND: 6,
  RTGS: 7,
  FOLLOW_TARGET: 8,
  PRECLAND: 9,
  ORBIT: 10,
} as const

// ---------------------------------------------------------------------------
// Mode mapping table: [main, sub, unified]
// ---------------------------------------------------------------------------

const PX4_MODE_TABLE: ReadonlyArray<[number, number, UnifiedFlightMode]> = [
  [PX4_MAIN_MODE.MANUAL, 0, 'MANUAL'],
  [PX4_MAIN_MODE.ALTCTL, 0, 'ALT_HOLD'],
  [PX4_MAIN_MODE.POSCTL, 0, 'POSHOLD'],
  [PX4_MAIN_MODE.STABILIZED, 0, 'STABILIZE'],
  [PX4_MAIN_MODE.ACRO, 0, 'ACRO'],
  [PX4_MAIN_MODE.OFFBOARD, 0, 'OFFBOARD'],
  [PX4_MAIN_MODE.RATTITUDE, 0, 'RATTITUDE'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.MISSION, 'AUTO'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.LOITER, 'LOITER'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.RTL, 'RTL'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.LAND, 'LAND'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.TAKEOFF, 'TAKEOFF'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.MISSION, 'MISSION'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.FOLLOW_TARGET, 'FOLLOW_ME'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.ORBIT, 'ORBIT'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.READY, 'READY'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.PRECLAND, 'PRECLAND'],
  [PX4_MAIN_MODE.AUTO, PX4_AUTO_SUB.RTGS, 'RTGS'],
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function encodeCustomMode(main: number, sub: number): number {
  return (main << 16) | sub
}

function decodeCustomMode(customMode: number): { main: number; sub: number } {
  return {
    main: (customMode >> 16) & 0xff,
    sub: customMode & 0xffff,
  }
}

// ---------------------------------------------------------------------------
// PX4 parameter name mapping (canonical ArduPilot → PX4)
// ---------------------------------------------------------------------------

const PX4_PARAM_MAP: Record<string, string> = {
  // ── PID rate (inner loop) ─────────────────────────────
  ATC_RAT_RLL_P: 'MC_ROLLRATE_P',
  ATC_RAT_RLL_I: 'MC_ROLLRATE_I',
  ATC_RAT_RLL_D: 'MC_ROLLRATE_D',
  ATC_RAT_RLL_FF: 'MC_ROLLRATE_FF',
  ATC_RAT_PIT_P: 'MC_PITCHRATE_P',
  ATC_RAT_PIT_I: 'MC_PITCHRATE_I',
  ATC_RAT_PIT_D: 'MC_PITCHRATE_D',
  ATC_RAT_PIT_FF: 'MC_PITCHRATE_FF',
  ATC_RAT_YAW_P: 'MC_YAWRATE_P',
  ATC_RAT_YAW_I: 'MC_YAWRATE_I',
  ATC_RAT_YAW_D: 'MC_YAWRATE_D',
  ATC_RAT_YAW_FF: 'MC_YAWRATE_FF',

  // ── PID angle (outer loop) ────────────────────────────
  ATC_ANG_RLL_P: 'MC_ROLL_P',
  ATC_ANG_PIT_P: 'MC_PITCH_P',
  ATC_ANG_YAW_P: 'MC_YAW_P',

  // ── Receiver channel mapping ──────────────────────────
  RCMAP_ROLL: 'RC_MAP_ROLL',
  RCMAP_PITCH: 'RC_MAP_PITCH',
  RCMAP_YAW: 'RC_MAP_YAW',
  RCMAP_THROTTLE: 'RC_MAP_THROTTLE',

  // ── Flight modes ──────────────────────────────────────
  FLTMODE_CH: 'RC_MAP_FLTMODE',
  FLTMODE1: 'COM_FLTMODE1',
  FLTMODE2: 'COM_FLTMODE2',
  FLTMODE3: 'COM_FLTMODE3',
  FLTMODE4: 'COM_FLTMODE4',
  FLTMODE5: 'COM_FLTMODE5',
  FLTMODE6: 'COM_FLTMODE6',

  // ── Power / battery ───────────────────────────────────
  BATT_MONITOR: 'BAT1_SOURCE',
  BATT_CAPACITY: 'BAT1_CAPACITY',
  BATT_VOLT_MULT: 'BAT1_V_DIV',
  BATT_AMP_PERVLT: 'BAT1_A_PER_V',
  BATT_AMP_OFFSET: 'BAT1_A_OFFSET',
  BATT2_MONITOR: 'BAT2_SOURCE',
  BATT2_CAPACITY: 'BAT2_CAPACITY',
  BATT2_VOLT_MULT: 'BAT2_V_DIV',
  BATT2_AMP_PERVLT: 'BAT2_A_PER_V',
  BATT2_AMP_OFFSET: 'BAT2_A_OFFSET',

  // ── Failsafe ──────────────────────────────────────────
  FS_THR_ENABLE: 'COM_RC_LOSS_T',
  FS_THR_VALUE: 'RC_FAILS_THR',
  FS_GCS_ENABLE: 'COM_DL_LOSS_T',
  BATT_FS_LOW_ACT: 'COM_LOW_BAT_ACT',
  BATT_FS_LOW_VOLT: 'BAT_LOW_THR',
  BATT_FS_CRT_ACT: 'COM_LOW_BAT_ACT',
  BATT_FS_CRT_VOLT: 'BAT_CRIT_THR',

  // ── Geofence ──────────────────────────────────────────
  FENCE_ENABLE: 'GF_ACTION',
  FENCE_ALT_MAX: 'GF_MAX_VER_DIST',
  FENCE_RADIUS: 'GF_MAX_HOR_DIST',

  // ── Compass calibration offsets ───────────────────────
  COMPASS_OFS_X: 'CAL_MAG0_XOFF',
  COMPASS_OFS_Y: 'CAL_MAG0_YOFF',
  COMPASS_OFS_Z: 'CAL_MAG0_ZOFF',
  COMPASS_OFS2_X: 'CAL_MAG1_XOFF',
  COMPASS_OFS2_Y: 'CAL_MAG1_YOFF',
  COMPASS_OFS2_Z: 'CAL_MAG1_ZOFF',

  // ── Altitude / position ───────────────────────────────
  WPNAV_SPEED: 'MPC_XY_VEL_MAX',
  WPNAV_SPEED_UP: 'MPC_Z_VEL_MAX_UP',
  WPNAV_SPEED_DN: 'MPC_Z_VEL_MAX_DN',
  WPNAV_ACCEL: 'MPC_ACC_HOR',
  PILOT_SPEED_UP: 'MPC_Z_VEL_MAX_UP',
  PILOT_SPEED_DN: 'MPC_Z_VEL_MAX_DN',
  PILOT_ACCEL_Z: 'MPC_ACC_UP_MAX',

  // ── General config ────────────────────────────────────
  ARMING_CHECK: 'COM_ARM_CHK_MODE',
  ARMING_REQUIRE: 'COM_ARM_AUTH_REQ',
  LAND_SPEED: 'MPC_LAND_SPEED',
  RTL_ALT: 'RTL_RETURN_ALT',
  RTL_SPEED: 'RTL_RETURN_ALT',
}

const PX4_REVERSE_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PX4_PARAM_MAP).map(([k, v]) => [v, k])
)

// ---------------------------------------------------------------------------
// PX4 capabilities
// ---------------------------------------------------------------------------

const PX4_CAPABILITIES: ProtocolCapabilities = {
  supportsArming: true,
  supportsFlightModes: true,
  supportsMissionUpload: true,
  supportsMissionDownload: true,
  supportsManualControl: true,
  supportsParameters: true,
  supportsCalibration: true,
  supportsSerialPassthrough: false,
  supportsMotorTest: true,
  supportsGeoFence: true,
  supportsRally: false,
  supportsLogDownload: true,
  supportsOsd: false,
  supportsPidTuning: true,
  supportsPorts: false,
  supportsFailsafe: true,
  supportsPowerConfig: true,
  supportsReceiver: true,
  supportsFirmwareFlash: true,
  supportsCliShell: true,
  supportsMavlinkInspector: true,
  supportsGimbal: true,
  supportsCamera: true,
  supportsLed: false,
  supportsBattery2: true,
  supportsRangefinder: true,
  supportsOpticalFlow: true,
  supportsObstacleAvoidance: true,
  supportsDebugValues: true,
  manualControlHz: 50,
  parameterCount: 1000,
}

// ---------------------------------------------------------------------------
// PX4Handler
// ---------------------------------------------------------------------------

/**
 * Firmware handler for PX4 autopilot.
 *
 * Handles PX4's custom_mode encoding where main_mode occupies bits 16-23
 * and sub_mode occupies bits 0-15.
 */
class PX4Handler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'px4'
  readonly vehicleClass: VehicleClass

  private modeToEncoding = new Map<UnifiedFlightMode, { main: number; sub: number }>()
  private encodingToMode = new Map<number, UnifiedFlightMode>()

  constructor(vehicleClass: VehicleClass = 'copter') {
    this.vehicleClass = vehicleClass
    for (const [main, sub, mode] of PX4_MODE_TABLE) {
      const key = encodeCustomMode(main, sub)
      // First occurrence wins for decode
      if (!this.encodingToMode.has(key)) {
        this.encodingToMode.set(key, mode)
      }
      // First occurrence wins for encode
      if (!this.modeToEncoding.has(mode)) {
        this.modeToEncoding.set(mode, { main, sub })
      }
    }
  }

  /**
   * Encode a unified flight mode into PX4's base_mode + custom_mode pair.
   *
   * PX4 expects `base_mode = 157` (MAV_MODE_FLAG_CUSTOM_MODE_ENABLED |
   * MAV_MODE_FLAG_SAFETY_ARMED | other standard flags).
   */
  encodeFlightMode(mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    const enc = this.modeToEncoding.get(mode)
    if (!enc) {
      throw new Error(`Unsupported mode for PX4: ${mode}`)
    }
    return { baseMode: 157, customMode: encodeCustomMode(enc.main, enc.sub) }
  }

  /** Decode PX4 custom_mode from HEARTBEAT into a unified flight mode. */
  decodeFlightMode(customMode: number): UnifiedFlightMode {
    // Try exact match first
    const exact = this.encodingToMode.get(customMode)
    if (exact) return exact

    // For non-auto modes, sub might be non-zero — try main only
    const { main } = decodeCustomMode(customMode)
    const mainOnly = this.encodingToMode.get(encodeCustomMode(main, 0))
    return mainOnly ?? 'UNKNOWN'
  }

  /** Return all flight modes available in PX4. */
  getAvailableModes(): UnifiedFlightMode[] {
    return [
      'MANUAL',
      'STABILIZE',
      'ALT_HOLD',
      'POSHOLD',
      'ACRO',
      'OFFBOARD',
      'RATTITUDE',
      'AUTO',
      'MISSION',
      'LOITER',
      'RTL',
      'LAND',
      'TAKEOFF',
      'FOLLOW_ME',
      'ORBIT',
    ]
  }

  /** PX4 defaults to MANUAL. */
  getDefaultMode(): UnifiedFlightMode {
    return 'MANUAL'
  }

  /** PX4 capability set. */
  getCapabilities(): ProtocolCapabilities {
    return PX4_CAPABILITIES
  }

  /** Return a human-readable firmware identifier. */
  getFirmwareVersion(_params?: Map<string, number>): string {
    return 'PX4'
  }

  /** Map canonical ArduPilot parameter names to PX4 equivalents. */
  mapParameterName(canonical: string): string {
    return PX4_PARAM_MAP[canonical] ?? canonical
  }

  reverseMapParameterName(firmwareName: string): string {
    return PX4_REVERSE_MAP[firmwareName] ?? firmwareName
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const px4Handler: FirmwareHandler = new PX4Handler()

export { PX4Handler }
