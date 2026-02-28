/**
 * Vehicle info MAVLink v2 message decoders: AutopilotVersion, ExtendedSysState.
 *
 * @module protocol/messages/vehicle-info
 */

// ── AUTOPILOT_VERSION (ID 148) ──────────────────────────────

export interface AutopilotVersionMsg {
  capabilities: number;
  flightSwVersion: number;
  middlewareSwVersion: number;
  osSwVersion: number;
  boardVersion: number;
  uid: number;
  vendorId: number;
  productId: number;
}

/**
 * Decode AUTOPILOT_VERSION (msg ID 148).
 *
 * Wire order (uint64 → uint32 → uint16 → uint8[]):
 * | Offset | Type      | Field                |
 * |--------|-----------|----------------------|
 * | 0      | uint64    | capabilities         |
 * | 8      | uint64    | uid                  |
 * | 16     | uint32    | flightSwVersion      |
 * | 20     | uint32    | middlewareSwVersion   |
 * | 24     | uint32    | osSwVersion          |
 * | 28     | uint32    | boardVersion         |
 * | 32     | uint16    | vendorId             |
 * | 34     | uint16    | productId            |
 * | 36     | uint8[8]  | flightCustomVersion  |
 * | 44     | uint8[8]  | middlewareCustomVer  |
 * | 52     | uint8[8]  | osCustomVersion      |
 */
export function decodeAutopilotVersion(dv: DataView): AutopilotVersionMsg {
  // capabilities is uint64 — read as two uint32
  const capLow = dv.getUint32(0, true);
  const capHigh = dv.getUint32(4, true);
  const uidLow = dv.getUint32(8, true);
  const uidHigh = dv.getUint32(12, true);

  return {
    capabilities: capHigh * 0x100000000 + capLow,
    uid: uidHigh * 0x100000000 + uidLow,
    flightSwVersion: dv.getUint32(16, true),
    middlewareSwVersion: dv.getUint32(20, true),
    osSwVersion: dv.getUint32(24, true),
    boardVersion: dv.getUint32(28, true),
    vendorId: dv.getUint16(32, true),
    productId: dv.getUint16(34, true),
  };
}

// ── EXTENDED_SYS_STATE (ID 245) ─────────────────────────────

export interface ExtendedSysStateMsg {
  vtolState: number;
  landedState: number;
}

/**
 * Decode EXTENDED_SYS_STATE (msg ID 245).
 *
 * | Offset | Type  | Field       |
 * |--------|-------|-------------|
 * | 0      | uint8 | vtolState   |
 * | 1      | uint8 | landedState |
 */
export function decodeExtendedSysState(dv: DataView): ExtendedSysStateMsg {
  return {
    vtolState: dv.getUint8(0),
    landedState: dv.getUint8(1),
  };
}
