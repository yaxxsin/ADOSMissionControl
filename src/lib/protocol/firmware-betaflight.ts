/**
 * Betaflight firmware handler stub for Altnautica Command GCS.
 *
 * Betaflight uses the MSP (MultiWii Serial Protocol) which is not yet
 * implemented. This handler provides capability reporting so the UI
 * can show/hide panels appropriately when a Betaflight FC is detected.
 *
 * @module firmware-betaflight
 */

import type {
  FirmwareType,
  FirmwareHandler,
  UnifiedFlightMode,
  VehicleClass,
  ProtocolCapabilities,
} from './types'

// ---------------------------------------------------------------------------
// Betaflight capabilities
// ---------------------------------------------------------------------------

const BETAFLIGHT_CAPABILITIES: ProtocolCapabilities = {
  supportsArming: true,
  supportsFlightModes: true,
  supportsMissionUpload: false,
  supportsMissionDownload: false,
  supportsManualControl: true,
  supportsParameters: true,
  supportsCalibration: true,
  supportsSerialPassthrough: true,
  supportsMotorTest: true,
  supportsGeoFence: false,
  supportsRally: false,
  supportsLogDownload: false,
  supportsOsd: true,
  supportsPidTuning: true,
  supportsPorts: true,
  supportsFailsafe: true,
  supportsPowerConfig: true,
  supportsReceiver: true,
  supportsFirmwareFlash: true,
  supportsCliShell: true,
  supportsMavlinkInspector: false,
  supportsGimbal: false,
  supportsCamera: false,
  supportsLed: true,
  supportsBattery2: false,
  supportsRangefinder: false,
  supportsOpticalFlow: false,
  supportsObstacleAvoidance: false,
  supportsDebugValues: true,
  manualControlHz: 50,
  parameterCount: 300,
}

// ---------------------------------------------------------------------------
// BetaflightHandler
// ---------------------------------------------------------------------------

/**
 * Stub firmware handler for Betaflight.
 *
 * MSP protocol support is planned for Phase 2. All mode encode/decode
 * operations return UNKNOWN. Capability flags are accurate so the UI
 * can correctly show/hide panels.
 */
class BetaflightHandler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'betaflight'
  readonly vehicleClass: VehicleClass = 'copter'

  /** MSP mode encoding not yet implemented. */
  encodeFlightMode(_mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    return { baseMode: 0, customMode: 0 }
  }

  /** MSP mode decoding not yet implemented. */
  decodeFlightMode(_customMode: number): UnifiedFlightMode {
    return 'UNKNOWN'
  }

  /** Betaflight modes — stubs until MSP is implemented. */
  getAvailableModes(): UnifiedFlightMode[] {
    return ['ACRO', 'STABILIZE', 'ALT_HOLD', 'POSHOLD', 'RTL', 'LAND', 'UNKNOWN']
  }

  getDefaultMode(): UnifiedFlightMode {
    return 'ACRO'
  }

  getCapabilities(): ProtocolCapabilities {
    return BETAFLIGHT_CAPABILITIES
  }

  getFirmwareVersion(_params?: Map<string, number>): string {
    return 'Betaflight'
  }

  /** Betaflight uses its own parameter names — pass through as-is. */
  mapParameterName(canonical: string): string {
    return canonical
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const betaflightHandler: FirmwareHandler = new BetaflightHandler()
