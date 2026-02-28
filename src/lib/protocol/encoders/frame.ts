/**
 * MAVLink v2 frame builder and sequence counter.
 * @module protocol/encoders/frame
 */

import { CRC_EXTRA, crc16, crc16Accumulate } from "../mavlink-parser";

// ── Sequence Counter ────────────────────────────────────────

/** Global send-sequence counter, wraps at 255. */
let sequence = 0;

export function nextSequence(): number {
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
