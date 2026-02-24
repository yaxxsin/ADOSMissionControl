/**
 * MAVLink v2 frame encoder.
 *
 * Provides a low-level `buildFrame()` that assembles a complete MAVLink v2
 * binary frame, plus typed encode helpers for every message the GCS sends
 * during Phase 1 operation.
 *
 * @module protocol/mavlink-encoder
 */

import { CRC_EXTRA, crc16, crc16Accumulate } from "./mavlink-parser";

// ── Sequence Counter ────────────────────────────────────────

/** Global send-sequence counter, wraps at 255. */
let sequence = 0;

function nextSequence(): number {
  const seq = sequence;
  sequence = (sequence + 1) & 0xff;
  return seq;
}

// ── Frame Builder ───────────────────────────────────────────

/**
 * Assemble a complete MAVLink v2 frame.
 *
 * @param msgId   - 24-bit message ID
 * @param payload - Serialised payload bytes
 * @param sysId   - Sender system ID (default 255 = GCS)
 * @param compId  - Sender component ID (default 190 = MAV_COMP_ID_MISSIONPLANNER)
 * @param seq     - Explicit sequence number (auto-incremented if omitted)
 * @returns Complete frame ready to send over the transport
 */
export function buildFrame(
  msgId: number,
  payload: Uint8Array,
  sysId = 255,
  compId = 190,
  seq?: number,
): Uint8Array {
  const payloadLen = payload.length;
  const frame = new Uint8Array(10 + payloadLen + 2);

  // Header
  frame[0] = 0xfd;                       // STX
  frame[1] = payloadLen;                  // LEN
  frame[2] = 0;                          // INC_FLAGS
  frame[3] = 0;                          // CMP_FLAGS
  frame[4] = seq ?? nextSequence();      // SEQ
  frame[5] = sysId;                      // SYSID
  frame[6] = compId;                     // COMPID
  frame[7] = msgId & 0xff;              // MSGID low
  frame[8] = (msgId >> 8) & 0xff;       // MSGID mid
  frame[9] = (msgId >> 16) & 0xff;      // MSGID high

  // Payload
  frame.set(payload, 10);

  // CRC — covers bytes 1..9+payloadLen (everything except STX and CRC itself)
  let crc = crc16(frame, 1, 9 + payloadLen);
  const extra = CRC_EXTRA.get(msgId);
  if (extra !== undefined) {
    crc = crc16Accumulate(extra, crc);
  }
  frame[10 + payloadLen] = crc & 0xff;
  frame[10 + payloadLen + 1] = (crc >> 8) & 0xff;

  return frame;
}

// ── Heartbeat (ID 0) ────────────────────────────────────────

/**
 * Encode a GCS heartbeat.
 *
 * Sent at 1 Hz to keep the link alive.
 * type=6 (MAV_TYPE_GCS), autopilot=8 (MAV_AUTOPILOT_INVALID),
 * baseMode=0, customMode=0, systemStatus=4 (MAV_STATE_ACTIVE).
 */
export function encodeHeartbeat(sysId = 255, compId = 190): Uint8Array {
  const payload = new Uint8Array(9);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, 0, true);   // customMode
  payload[4] = 6;             // type = GCS
  payload[5] = 8;             // autopilot = INVALID
  payload[6] = 0;             // baseMode
  payload[7] = 4;             // systemStatus = ACTIVE
  payload[8] = 3;             // mavlinkVersion = v2
  return buildFrame(0, payload, sysId, compId);
}

// ── COMMAND_LONG (ID 76) ────────────────────────────────────

/**
 * Encode a COMMAND_LONG message.
 *
 * Generic command interface — most GCS actions (arm, disarm, takeoff,
 * calibration, motor test, etc.) go through this.
 */
export function encodeCommandLong(
  targetSys: number,
  targetComp: number,
  command: number,
  p1 = 0,
  p2 = 0,
  p3 = 0,
  p4 = 0,
  p5 = 0,
  p6 = 0,
  p7 = 0,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(33);
  const dv = new DataView(payload.buffer);
  dv.setFloat32(0, p1, true);
  dv.setFloat32(4, p2, true);
  dv.setFloat32(8, p3, true);
  dv.setFloat32(12, p4, true);
  dv.setFloat32(16, p5, true);
  dv.setFloat32(20, p6, true);
  dv.setFloat32(24, p7, true);
  dv.setUint16(28, command, true);
  payload[30] = targetSys;
  payload[31] = targetComp;
  payload[32] = 0; // confirmation
  return buildFrame(76, payload, sysId, compId);
}

// ── MANUAL_CONTROL (ID 69) ──────────────────────────────────

/**
 * Encode a MANUAL_CONTROL message.
 *
 * Sent at up to 50 Hz for real-time joystick/gamepad control.
 * Axes are int16 (-1000 to 1000), buttons is uint16 bitmask.
 */
export function encodeManualControl(
  targetSys: number,
  x: number,
  y: number,
  z: number,
  r: number,
  buttons: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(11);
  const dv = new DataView(payload.buffer);
  dv.setInt16(0, x, true);        // pitch (forward/back)
  dv.setInt16(2, y, true);        // roll (left/right)
  dv.setInt16(4, z, true);        // throttle (up/down)
  dv.setInt16(6, r, true);        // yaw (rotation)
  dv.setUint16(8, buttons, true); // button bitmask
  payload[10] = targetSys;        // target system
  return buildFrame(69, payload, sysId, compId);
}

// ── PARAM_REQUEST_LIST (ID 21) ──────────────────────────────

/** Request all parameters from the flight controller. */
export function encodeParamRequestList(
  targetSys: number,
  targetComp: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(2);
  payload[0] = targetSys;
  payload[1] = targetComp;
  return buildFrame(21, payload, sysId, compId);
}

// ── PARAM_SET (ID 23) ───────────────────────────────────────

/**
 * Set a single parameter on the flight controller.
 *
 * @param paramId - Parameter name (max 16 chars, null-padded)
 * @param value   - New value
 * @param type    - MAV_PARAM_TYPE (default 9 = REAL32)
 */
export function encodeParamSet(
  targetSys: number,
  targetComp: number,
  paramId: string,
  value: number,
  type = 9,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(23);
  const dv = new DataView(payload.buffer);

  // param_value (float32) at offset 0
  dv.setFloat32(0, value, true);

  // target_system at offset 4
  payload[4] = targetSys;

  // target_component at offset 5
  payload[5] = targetComp;

  // param_id (char[16]) at offset 6 — null-padded
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(paramId.slice(0, 16));
  payload.set(nameBytes, 6);

  // param_type at offset 22
  payload[22] = type;

  return buildFrame(23, payload, sysId, compId);
}

// ── SET_MODE (ID 11) ────────────────────────────────────────

/** Set the flight mode on the target system. */
export function encodeSetMode(
  targetSys: number,
  baseMode: number,
  customMode: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(6);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, customMode, true);
  payload[4] = targetSys;
  payload[5] = baseMode;
  return buildFrame(11, payload, sysId, compId);
}

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

// ── SERIAL_CONTROL (ID 126) ────────────────────────────────

/**
 * Encode a SERIAL_CONTROL message for serial passthrough to the FC shell.
 *
 * @param device   - SERIAL_CONTROL_DEV enum (0 = TELEM1, 10 = SHELL)
 * @param flags    - SERIAL_CONTROL_FLAG bitmask (REPLY=1, RESPOND=2, EXCLUSIVE=4, BLOCKING=8, MULTI=16)
 * @param timeout  - Timeout in ms (0 = no timeout)
 * @param baudrate - Baudrate (0 = no change)
 * @param data     - Payload bytes (max 70)
 */
// ── PARAM_REQUEST_READ (ID 20) ──────────────────────────────

/**
 * Request a single parameter by index from the flight controller.
 *
 * @param targetSys  - Target system ID
 * @param targetComp - Target component ID
 * @param paramId    - Parameter name (empty string to use index)
 * @param paramIndex - Parameter index (-1 to use name instead)
 */
export function encodeParamRequestRead(
  targetSys: number,
  targetComp: number,
  paramId: string,
  paramIndex: number,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(20);
  const dv = new DataView(payload.buffer);

  // param_index (int16) at offset 0
  dv.setInt16(0, paramIndex, true);

  // target_system at offset 2
  payload[2] = targetSys;

  // target_component at offset 3
  payload[3] = targetComp;

  // param_id (char[16]) at offset 4 — null-padded
  const encoder = new TextEncoder();
  const nameBytes = encoder.encode(paramId.slice(0, 16));
  payload.set(nameBytes, 4);

  return buildFrame(20, payload, sysId, compId);
}

// ── SERIAL_CONTROL (ID 126) ────────────────────────────────

export function encodeSerialControl(
  device: number,
  flags: number,
  timeout: number,
  baudrate: number,
  data: Uint8Array,
  sysId = 255,
  compId = 190,
): Uint8Array {
  const payload = new Uint8Array(79);
  const dv = new DataView(payload.buffer);
  dv.setUint32(0, baudrate, true);   // baudrate
  dv.setUint16(4, timeout, true);    // timeout
  payload[6] = device;               // device
  payload[7] = flags;                // flags
  payload[8] = Math.min(data.length, 70); // count
  payload.set(data.subarray(0, 70), 9);   // data[70]
  return buildFrame(126, payload, sysId, compId);
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
