/**
 * ArduPilot firmware handlers for Altnautica Command GCS.
 *
 * Provides flight-mode encoding/decoding and capability reporting
 * for ArduPlane and ArduCopter firmware variants.
 *
 * @module firmware/ardupilot
 */

import type {
  FirmwareType,
  FirmwareHandler,
  UnifiedFlightMode,
  VehicleClass,
  ProtocolCapabilities,
} from '../types'
import { px4Handler } from './px4'
import { betaflightHandler } from './betaflight'
import { inavHandler } from './inav'

// ---------------------------------------------------------------------------
// MAVLink enum constants
// ---------------------------------------------------------------------------

/** MAV_AUTOPILOT enum subset (MAVLink common.xml) */
export const MAV_AUTOPILOT = {
  GENERIC: 0,
  ARDUPILOTMEGA: 3,
  PX4: 12,
} as const

/** MAV_TYPE enum subset (MAVLink common.xml) */
export const MAV_TYPE = {
  FIXED_WING: 1,
  QUADROTOR: 2,
  COAXIAL: 3,
  HELICOPTER: 4,
  GCS: 6,
  HEXAROTOR: 13,
  OCTOROTOR: 14,
  TRICOPTER: 15,
  VTOL_FIXEDROTOR: 22,
} as const

// ---------------------------------------------------------------------------
// Mode tables — custom_mode ↔ UnifiedFlightMode
// ---------------------------------------------------------------------------

/** ArduPlane custom_mode → UnifiedFlightMode mapping */
const ARDUPLANE_MODES: ReadonlyArray<[number, UnifiedFlightMode]> = [
  [0, 'MANUAL'],
  [1, 'CIRCLE'],
  [2, 'STABILIZE'],
  [3, 'TRAINING'],
  [4, 'ACRO'],
  [5, 'FBWA'],
  [6, 'FBWB'],
  [7, 'CRUISE'],
  [8, 'AUTOTUNE'],
  [10, 'AUTO'],
  [11, 'RTL'],
  [12, 'LOITER'],
  [14, 'AVOID_ADSB'],
  [15, 'GUIDED'],
  [17, 'QSTABILIZE'],
  [18, 'QHOVER'],
  [19, 'QLOITER'],
  [20, 'QLAND'],
  [21, 'QRTL'],
  [22, 'QAUTOTUNE'],
  [23, 'QACRO'],
  [24, 'THERMAL'],
  [13, 'TAKEOFF'],
  [25, 'LOITER_TO_QLAND'],
]

/** ArduCopter custom_mode → UnifiedFlightMode mapping */
const ARDUCOPTER_MODES: ReadonlyArray<[number, UnifiedFlightMode]> = [
  [0, 'STABILIZE'],
  [1, 'ACRO'],
  [2, 'ALT_HOLD'],
  [3, 'AUTO'],
  [4, 'GUIDED'],
  [5, 'LOITER'],
  [6, 'RTL'],
  [7, 'CIRCLE'],
  [9, 'LAND'],
  [11, 'DRIFT'],
  [13, 'SPORT'],
  [14, 'FLIP'],
  [15, 'AUTOTUNE'],
  [16, 'POSHOLD'],
  [17, 'BRAKE'],
  [18, 'THROW'],
  [19, 'AVOID_ADSB'],
  [21, 'SMART_RTL'],
  [22, 'FLOWHOLD'],
  [23, 'FOLLOW'],
  [24, 'ZIGZAG'],
  [25, 'SYSTEMID'],
  [26, 'HELI_AUTOROTATE'],
  [27, 'AUTO_RTL'],
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function buildMaps(
  table: ReadonlyArray<[number, UnifiedFlightMode]>,
): {
  modeToCustom: Map<UnifiedFlightMode, number>
  customToMode: Map<number, UnifiedFlightMode>
} {
  const modeToCustom = new Map<UnifiedFlightMode, number>()
  const customToMode = new Map<number, UnifiedFlightMode>()
  for (const [custom, mode] of table) {
    customToMode.set(custom, mode)
    // First occurrence wins — some modes may alias
    if (!modeToCustom.has(mode)) {
      modeToCustom.set(mode, custom)
    }
  }
  return { modeToCustom, customToMode }
}

// ---------------------------------------------------------------------------
// ArduPlaneHandler
// ---------------------------------------------------------------------------

/** Full ArduPilot capabilities shared by Plane and Copter */
const ARDUPILOT_CAPABILITIES: ProtocolCapabilities = {
  supportsArming: true,
  supportsFlightModes: true,
  supportsMissionUpload: true,
  supportsMissionDownload: true,
  supportsManualControl: true,
  supportsParameters: true,
  supportsCalibration: true,
  supportsSerialPassthrough: true,
  supportsMotorTest: true,
  supportsGeoFence: true,
  supportsRally: true,
  supportsLogDownload: true,
  supportsOsd: true,
  supportsPidTuning: true,
  supportsPorts: true,
  supportsFailsafe: true,
  supportsPowerConfig: true,
  supportsReceiver: true,
  supportsFirmwareFlash: true,
  supportsCliShell: true,
  supportsMavlinkInspector: true,
  supportsGimbal: true,
  supportsCamera: true,
  supportsLed: true,
  supportsBattery2: true,
  supportsRangefinder: true,
  supportsOpticalFlow: true,
  supportsObstacleAvoidance: true,
  supportsDebugValues: true,
  manualControlHz: 50,
  parameterCount: 1500,
}

/**
 * Firmware handler for ArduPlane.
 *
 * Handles flight-mode encoding/decoding using ArduPlane's custom_mode values
 * and reports full ArduPilot capability set.
 */
export class ArduPlaneHandler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'ardupilot-plane'
  readonly vehicleClass: VehicleClass = 'plane'

  private modeToCustom: Map<UnifiedFlightMode, number>
  private customToMode: Map<number, UnifiedFlightMode>

  constructor() {
    const maps = buildMaps(ARDUPLANE_MODES)
    this.modeToCustom = maps.modeToCustom
    this.customToMode = maps.customToMode
  }

  /**
   * Encode a unified flight mode into MAVLink base_mode + custom_mode
   * for a SET_MODE command.
   *
   * `baseMode` is set to 1 (MAV_MODE_FLAG_CUSTOM_MODE_ENABLED).
   * The flight controller interprets remaining flags from its own state.
   */
  encodeFlightMode(mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    const customMode = this.modeToCustom.get(mode)
    if (customMode === undefined) {
      throw new Error(`Unsupported mode for ArduPlane: ${mode}`)
    }
    return { baseMode: 1, customMode }
  }

  /** Decode a custom_mode uint32 from HEARTBEAT into a unified flight mode. */
  decodeFlightMode(customMode: number): UnifiedFlightMode {
    return this.customToMode.get(customMode) ?? 'UNKNOWN'
  }

  /** Return all flight modes available in ArduPlane. */
  getAvailableModes(): UnifiedFlightMode[] {
    return ARDUPLANE_MODES.map(([, mode]) => mode)
  }

  /** ArduPlane defaults to MANUAL on boot. */
  getDefaultMode(): UnifiedFlightMode {
    return 'MANUAL'
  }

  /** Full ArduPilot capability set. */
  getCapabilities(): ProtocolCapabilities {
    return ARDUPILOT_CAPABILITIES
  }

  /** Return a human-readable firmware identifier. */
  getFirmwareVersion(_params?: Map<string, number>): string {
    return 'ArduPlane'
  }

  /** ArduPilot uses canonical parameter names. */
  mapParameterName(canonical: string): string {
    return canonical
  }
}

// ---------------------------------------------------------------------------
// ArduCopterHandler
// ---------------------------------------------------------------------------

/**
 * Firmware handler for ArduCopter.
 *
 * Handles flight-mode encoding/decoding using ArduCopter's custom_mode values.
 * Applies to quadrotors, hexarotors, octorotors, tricopters, and other
 * multirotor vehicle types running ArduPilot.
 */
export class ArduCopterHandler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'ardupilot-copter'
  readonly vehicleClass: VehicleClass = 'copter'

  private modeToCustom: Map<UnifiedFlightMode, number>
  private customToMode: Map<number, UnifiedFlightMode>

  constructor() {
    const maps = buildMaps(ARDUCOPTER_MODES)
    this.modeToCustom = maps.modeToCustom
    this.customToMode = maps.customToMode
  }

  /**
   * Encode a unified flight mode into MAVLink base_mode + custom_mode
   * for a SET_MODE command.
   */
  encodeFlightMode(mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    const customMode = this.modeToCustom.get(mode)
    if (customMode === undefined) {
      throw new Error(`Unsupported mode for ArduCopter: ${mode}`)
    }
    return { baseMode: 1, customMode }
  }

  /** Decode a custom_mode uint32 from HEARTBEAT into a unified flight mode. */
  decodeFlightMode(customMode: number): UnifiedFlightMode {
    return this.customToMode.get(customMode) ?? 'UNKNOWN'
  }

  /** Return all flight modes available in ArduCopter. */
  getAvailableModes(): UnifiedFlightMode[] {
    return ARDUCOPTER_MODES.map(([, mode]) => mode)
  }

  /** ArduCopter defaults to STABILIZE on boot. */
  getDefaultMode(): UnifiedFlightMode {
    return 'STABILIZE'
  }

  /** Full ArduPilot capability set. */
  getCapabilities(): ProtocolCapabilities {
    return ARDUPILOT_CAPABILITIES
  }

  /** Return a human-readable firmware identifier. */
  getFirmwareVersion(_params?: Map<string, number>): string {
    return 'ArduCopter'
  }

  /** ArduPilot uses canonical parameter names. */
  mapParameterName(canonical: string): string {
    return canonical
  }
}

// ---------------------------------------------------------------------------
// GenericHandler (fallback for unknown autopilots)
// ---------------------------------------------------------------------------

/**
 * Minimal fallback handler for unrecognised autopilots.
 *
 * All mode operations return UNKNOWN. Capabilities report nothing supported.
 */
class GenericHandler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'unknown'
  readonly vehicleClass: VehicleClass = 'copter'

  encodeFlightMode(_mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    return { baseMode: 1, customMode: 0 }
  }

  decodeFlightMode(_customMode: number): UnifiedFlightMode {
    return 'UNKNOWN'
  }

  getAvailableModes(): UnifiedFlightMode[] {
    return ['UNKNOWN']
  }

  getDefaultMode(): UnifiedFlightMode {
    return 'UNKNOWN'
  }

  getCapabilities(): ProtocolCapabilities {
    return {
      supportsArming: false,
      supportsFlightModes: false,
      supportsMissionUpload: false,
      supportsMissionDownload: false,
      supportsManualControl: false,
      supportsParameters: false,
      supportsCalibration: false,
      supportsSerialPassthrough: false,
      supportsMotorTest: false,
      supportsGeoFence: false,
      supportsRally: false,
      supportsLogDownload: false,
      supportsOsd: false,
      supportsPidTuning: false,
      supportsPorts: false,
      supportsFailsafe: false,
      supportsPowerConfig: false,
      supportsReceiver: false,
      supportsFirmwareFlash: false,
      supportsCliShell: false,
      supportsMavlinkInspector: false,
      supportsGimbal: false,
      supportsCamera: false,
      supportsLed: false,
      supportsBattery2: false,
      supportsRangefinder: false,
      supportsOpticalFlow: false,
      supportsObstacleAvoidance: false,
      supportsDebugValues: false,
      manualControlHz: 0,
      parameterCount: 0,
    }
  }

  getFirmwareVersion(): string {
    return 'Unknown'
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create the appropriate firmware handler based on MAVLink HEARTBEAT fields.
 *
 * @param autopilot  `MAV_AUTOPILOT` value from HEARTBEAT
 * @param vehicleType  `MAV_TYPE` value from HEARTBEAT
 * @returns A `FirmwareHandler` for the detected firmware/vehicle combination
 */
export function createFirmwareHandler(autopilot: number, vehicleType: number): FirmwareHandler {
  // PX4 autopilot
  if (autopilot === MAV_AUTOPILOT.PX4) {
    return px4Handler
  }

  // ArduPilot — select by vehicle type
  if (autopilot === MAV_AUTOPILOT.ARDUPILOTMEGA) {
    switch (vehicleType) {
      case MAV_TYPE.FIXED_WING:
      case MAV_TYPE.VTOL_FIXEDROTOR:
        return new ArduPlaneHandler()

      case MAV_TYPE.QUADROTOR:
      case MAV_TYPE.COAXIAL:
      case MAV_TYPE.HELICOPTER:
      case MAV_TYPE.HEXAROTOR:
      case MAV_TYPE.OCTOROTOR:
      case MAV_TYPE.TRICOPTER:
        return new ArduCopterHandler()

      // Ground rover, submarine, etc. — fall back to copter handler for now
      default:
        return new ArduCopterHandler()
    }
  }

  // Unknown autopilot
  return new GenericHandler()
}

/**
 * Create a firmware handler by FirmwareType string.
 * Useful when firmware type is known from protocol detection
 * rather than HEARTBEAT parsing.
 */
export function createFirmwareHandlerByType(firmwareType: FirmwareType): FirmwareHandler {
  switch (firmwareType) {
    case 'ardupilot-copter':
      return new ArduCopterHandler()
    case 'ardupilot-plane':
      return new ArduPlaneHandler()
    case 'ardupilot-rover':
    case 'ardupilot-sub':
      return new ArduCopterHandler() // Fallback for now
    case 'px4':
      return px4Handler
    case 'betaflight':
      return betaflightHandler
    case 'inav':
      return inavHandler
    default:
      return new GenericHandler()
  }
}
