/**
 * MAVLink mission protocol encoders.
 * @module protocol/encoders/mission
 */

import { buildFrame } from "./frame";

// ── MISSION_COUNT (ID 44) ───────────────────────────────────

/** Send mission item count to initiate mission upload. */
export function encodeMissionCount(
  targetSys: number,
  targetComp: number,
  count: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(4);
  const dv = new DataView(payload.buffer);
  dv.setUint16(0, count, true);
  payload[2] = targetSys;
  payload[3] = targetComp;
  return buildFrame(44, payload, sysId, compId);
}

// ── MISSION_ITEM_INT (ID 73) ────────────────────────────────

/** Encode a single mission item (INT variant — lat/lon as int32 * 1e7). */
export function encodeMissionItemInt(
  targetSys: number,
  targetComp: number,
  seq: number,
  frame: number,
  command: number,
  current: number,
  autocontinue: number,
  p1: number,
  p2: number,
  p3: number,
  p4: number,
  x: number,
  y: number,
  z: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(37);
  const dv = new DataView(payload.buffer);
  dv.setFloat32(0, p1, true);
  dv.setFloat32(4, p2, true);
  dv.setFloat32(8, p3, true);
  dv.setFloat32(12, p4, true);
  dv.setInt32(16, x, true);      // lat * 1e7
  dv.setInt32(20, y, true);      // lon * 1e7
  dv.setFloat32(24, z, true);    // alt
  dv.setUint16(28, seq, true);
  dv.setUint16(30, command, true);
  payload[32] = targetSys;
  payload[33] = targetComp;
  payload[34] = frame;
  payload[35] = current;
  payload[36] = autocontinue;
  return buildFrame(73, payload, sysId, compId);
}

// ── MISSION_REQUEST_LIST (ID 43) ─────────────────────────────

/** Request the mission item list from the flight controller. */
export function encodeMissionRequestList(
  targetSys: number,
  targetComp: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = targetSys;
  payload[1] = targetComp;
  return buildFrame(43, payload, sysId, compId);
}

// ── MISSION_REQUEST_INT (ID 51) ──────────────────────────────

/** Request a specific mission item by sequence number. */
export function encodeMissionRequestInt(
  targetSys: number,
  targetComp: number,
  seq: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(4);
  const dv = new DataView(payload.buffer);
  dv.setUint16(0, seq, true);
  payload[2] = targetSys;
  payload[3] = targetComp;
  return buildFrame(51, payload, sysId, compId);
}

// ── MISSION_ACK (ID 47) ─────────────────────────────────────

/** Send mission acknowledgement. */
export function encodeMissionAck(
  targetSys: number,
  targetComp: number,
  type: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(3);
  payload[0] = targetSys;
  payload[1] = targetComp;
  payload[2] = type;
  return buildFrame(47, payload, sysId, compId);
}

// ── MISSION_CLEAR_ALL (ID 45) ───────────────────────────────

/** Clear all mission items on the flight controller. */
export function encodeMissionClearAll(
  targetSys: number,
  targetComp: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = targetSys;
  payload[1] = targetComp;
  return buildFrame(45, payload, sysId, compId);
}
