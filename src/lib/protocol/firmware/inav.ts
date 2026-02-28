/**
 * iNav firmware handler stub for Altnautica Command GCS.
 *
 * iNav uses MSP protocol (like Betaflight) but adds mission planning,
 * geofence, and navigation capabilities. Protocol implementation is
 * planned for Phase 2.
 *
 * @module firmware/inav
 */

import type {
  FirmwareType,
  FirmwareHandler,
  UnifiedFlightMode,
  VehicleClass,
  ProtocolCapabilities,
} from '../types'

// ---------------------------------------------------------------------------
// iNav capabilities
// ---------------------------------------------------------------------------

const INAV_CAPABILITIES: ProtocolCapabilities = {
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
  supportsRally: false,
  supportsLogDownload: true,
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
  supportsRangefinder: true,
  supportsOpticalFlow: false,
  supportsObstacleAvoidance: false,
  supportsDebugValues: true,
  manualControlHz: 50,
  parameterCount: 400,
}

// ---------------------------------------------------------------------------
// INavHandler
// ---------------------------------------------------------------------------

/**
 * Stub firmware handler for iNav.
 *
 * Similar to Betaflight but with navigation features (missions, geofence).
 * MSP protocol support planned for Phase 2.
 */
class INavHandler implements FirmwareHandler {
  readonly firmwareType: FirmwareType = 'inav'
  readonly vehicleClass: VehicleClass = 'copter'

  /** MSP mode encoding not yet implemented. */
  encodeFlightMode(_mode: UnifiedFlightMode): { baseMode: number; customMode: number } {
    return { baseMode: 0, customMode: 0 }
  }

  /** MSP mode decoding not yet implemented. */
  decodeFlightMode(_customMode: number): UnifiedFlightMode {
    return 'UNKNOWN'
  }

  /** iNav modes — stubs until MSP is implemented. */
  getAvailableModes(): UnifiedFlightMode[] {
    return [
      'ACRO', 'STABILIZE', 'ALT_HOLD', 'POSHOLD',
      'RTL', 'LAND', 'MISSION', 'LOITER', 'UNKNOWN',
    ]
  }

  getDefaultMode(): UnifiedFlightMode {
    return 'ACRO'
  }

  getCapabilities(): ProtocolCapabilities {
    return INAV_CAPABILITIES
  }

  getFirmwareVersion(_params?: Map<string, number>): string {
    return 'iNav'
  }

  /** iNav uses its own parameter names — pass through as-is. */
  mapParameterName(canonical: string): string {
    return canonical
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const inavHandler: FirmwareHandler = new INavHandler()
