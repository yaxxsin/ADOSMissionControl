/**
 * MAVLink v2 binary frame parser.
 *
 * Accumulates raw bytes from a transport, scans for 0xFD start markers,
 * validates CRC-16/MCRF4XX checksums (with per-message CRC_EXTRA seed),
 * handles MAVLink v2 zero-trimmed payload restoration, and emits typed
 * `MAVLinkFrame` objects to subscribers.
 *
 * @module protocol/mavlink-parser
 */

// ── MAVLink v2 Constants ────────────────────────────────────

/** MAVLink v2 start-of-frame marker. */
const MAVLINK_STX = 0xfd;

/** Fixed header size: STX(1) + len(1) + inc_flags(1) + cmp_flags(1) + seq(1) + sysid(1) + compid(1) + msgid(3) = 10 */
const HEADER_SIZE = 10;

/** CRC size in bytes. */
const CRC_SIZE = 2;

// ── CRC_EXTRA Map ───────────────────────────────────────────

/**
 * Per-message CRC_EXTRA seed for all Phase 1 MAVLink messages.
 *
 * These are derived from the MAVLink XML message definitions and act
 * as a version check — if the message layout changes, the CRC_EXTRA
 * changes, causing a CRC mismatch and frame rejection.
 */
export const CRC_EXTRA: ReadonlyMap<number, number> = new Map([
  [0, 50],    // HEARTBEAT
  [1, 124],   // SYS_STATUS
  [11, 89],   // SET_MODE
  [20, 214],  // PARAM_REQUEST_READ
  [21, 159],  // PARAM_REQUEST_LIST
  [22, 220],  // PARAM_VALUE
  [23, 168],  // PARAM_SET
  [24, 24],   // GPS_RAW_INT
  [30, 39],   // ATTITUDE
  [33, 104],  // GLOBAL_POSITION_INT
  [41, 28],   // MISSION_SET_CURRENT
  [44, 221],  // MISSION_COUNT
  [47, 153],  // MISSION_ACK
  [51, 196],  // MISSION_REQUEST_INT
  [65, 118],  // RC_CHANNELS
  [69, 243],  // MANUAL_CONTROL
  [73, 38],   // MISSION_ITEM_INT
  [74, 20],   // VFR_HUD
  [75, 158],  // COMMAND_INT
  [76, 152],  // COMMAND_LONG
  [77, 143],  // COMMAND_ACK
  [147, 154], // BATTERY_STATUS
  [126, 220], // SERIAL_CONTROL
  [253, 83],  // STATUSTEXT
  [42, 28],   // MISSION_CURRENT
  [43, 132],  // MISSION_REQUEST_LIST
  [45, 232],  // MISSION_CLEAR_ALL
  [46, 11],   // MISSION_ITEM_REACHED
  [109, 185], // RADIO_STATUS
  [36, 222],  // SERVO_OUTPUT_RAW
  [136, 1],   // TERRAIN_REPORT
  [168, 1],   // WIND
  [191, 92],  // MAG_CAL_PROGRESS
  [192, 36],  // MAG_CAL_REPORT
  [241, 90],  // VIBRATION
  [335, 71],  // EKF_STATUS_REPORT
  [66, 148],  // REQUEST_DATA_STREAM
  [242, 104], // HOME_POSITION
  [148, 178], // AUTOPILOT_VERSION
  [125, 203], // POWER_STATUS
  [132, 85],  // DISTANCE_SENSOR
  [162, 189], // FENCE_STATUS
  [62, 183],  // NAV_CONTROLLER_OUTPUT
  [26, 170],  // SCALED_IMU
  [29, 115],  // SCALED_PRESSURE
  [124, 87],  // GPS2_RAW
  [117, 128], // LOG_REQUEST_LIST
  [118, 56],  // LOG_ENTRY
  [119, 116], // LOG_REQUEST_DATA
  [120, 134], // LOG_DATA
  [121, 237], // LOG_ERASE
  [122, 203], // LOG_REQUEST_END
  [2, 137],     // SYSTEM_TIME
  [32, 185],    // LOCAL_POSITION_NED
  [82, 49],     // SET_ATTITUDE_TARGET
  [86, 5],      // SET_POSITION_TARGET_GLOBAL_INT
  [111, 34],    // TIMESYNC
  [245, 130],   // EXTENDED_SYS_STATE
  [251, 170],   // NAMED_VALUE_FLOAT
  [252, 44],    // NAMED_VALUE_INT
  [254, 46],    // DEBUG
  [263, 133],   // CAMERA_IMAGE_CAPTURED
  [284, 227],   // GIMBAL_DEVICE_ATTITUDE_STATUS
  [330, 23],    // OBSTACLE_DISTANCE
  [160, 78],    // FENCE_POINT
  [161, 68],    // FENCE_FETCH_POINT
  [70, 124],    // RC_CHANNELS_OVERRIDE
  [112, 174],   // CAMERA_TRIGGER
  [230, 163],   // ESTIMATOR_STATUS
  [27, 144],    // RAW_IMU
  [35, 244],    // RC_CHANNELS_RAW
  [39, 254],    // MISSION_ITEM
  [141, 47],    // ALTITUDE
  [231, 105],   // WIND_COV
  [246, 245],   // AIS_VESSEL
  [285, 166],   // GIMBAL_MANAGER_INFORMATION
  [286, 48],    // GIMBAL_MANAGER_STATUS
]);

/**
 * Expected payload lengths for known messages.
 * Used to restore zero-trimmed payloads to their canonical size.
 */
const PAYLOAD_LENGTHS: ReadonlyMap<number, number> = new Map([
  [0, 9],     // HEARTBEAT
  [1, 31],    // SYS_STATUS
  [11, 6],    // SET_MODE
  [20, 20],   // PARAM_REQUEST_READ
  [21, 2],    // PARAM_REQUEST_LIST
  [22, 25],   // PARAM_VALUE
  [23, 23],   // PARAM_SET
  [24, 30],   // GPS_RAW_INT
  [30, 28],   // ATTITUDE
  [33, 28],   // GLOBAL_POSITION_INT
  [41, 4],    // MISSION_SET_CURRENT
  [44, 5],    // MISSION_COUNT (4 base + 1 missionType extension)
  [47, 4],    // MISSION_ACK (3 base + 1 missionType extension)
  [51, 5],    // MISSION_REQUEST_INT (4 base + 1 missionType extension)
  [65, 42],   // RC_CHANNELS
  [69, 11],   // MANUAL_CONTROL
  [73, 38],   // MISSION_ITEM_INT (37 base + 1 missionType extension)
  [74, 20],   // VFR_HUD
  [75, 35],   // COMMAND_INT
  [76, 33],   // COMMAND_LONG
  [77, 3],    // COMMAND_ACK
  [126, 79],  // SERIAL_CONTROL
  [147, 36],  // BATTERY_STATUS
  [253, 54],  // STATUSTEXT (severity + 50 chars + 3 id bytes)
  [42, 2],    // MISSION_CURRENT
  [43, 3],    // MISSION_REQUEST_LIST (2 base + 1 missionType extension)
  [45, 3],    // MISSION_CLEAR_ALL (2 base + 1 missionType extension)
  [46, 2],    // MISSION_ITEM_REACHED
  [109, 9],   // RADIO_STATUS
  [36, 21],   // SERVO_OUTPUT_RAW
  [136, 22],  // TERRAIN_REPORT
  [168, 12],  // WIND
  [191, 27],  // MAG_CAL_PROGRESS
  [192, 54],  // MAG_CAL_REPORT (with orientation/scale extensions)
  [241, 32],  // VIBRATION
  [335, 22],  // EKF_STATUS_REPORT
  [66, 6],    // REQUEST_DATA_STREAM
  [242, 52],  // HOME_POSITION (base, without time_usec extension)
  [148, 60],  // AUTOPILOT_VERSION (base, without uid2 extension)
  [125, 6],   // POWER_STATUS
  [132, 14],  // DISTANCE_SENSOR (base)
  [162, 8],   // FENCE_STATUS
  [62, 26],   // NAV_CONTROLLER_OUTPUT
  [26, 22],   // SCALED_IMU
  [29, 14],   // SCALED_PRESSURE
  [124, 35],  // GPS2_RAW
  [117, 6],   // LOG_REQUEST_LIST
  [118, 14],  // LOG_ENTRY
  [119, 12],  // LOG_REQUEST_DATA
  [120, 97],  // LOG_DATA
  [121, 2],   // LOG_ERASE
  [122, 2],   // LOG_REQUEST_END
  [2, 12],      // SYSTEM_TIME
  [32, 28],     // LOCAL_POSITION_NED
  [82, 39],     // SET_ATTITUDE_TARGET
  [86, 53],     // SET_POSITION_TARGET_GLOBAL_INT
  [111, 17],    // TIMESYNC
  [245, 2],     // EXTENDED_SYS_STATE
  [251, 18],    // NAMED_VALUE_FLOAT
  [252, 18],    // NAMED_VALUE_INT
  [254, 9],     // DEBUG
  [263, 255],   // CAMERA_IMAGE_CAPTURED
  [284, 40],    // GIMBAL_DEVICE_ATTITUDE_STATUS
  [330, 158],   // OBSTACLE_DISTANCE
  [160, 12],    // FENCE_POINT
  [161, 6],     // FENCE_FETCH_POINT
  [70, 18],     // RC_CHANNELS_OVERRIDE
  [112, 24],    // CAMERA_TRIGGER
  [230, 42],    // ESTIMATOR_STATUS
  [27, 26],     // RAW_IMU
  [35, 22],     // RC_CHANNELS_RAW
  [39, 37],     // MISSION_ITEM
  [141, 32],    // ALTITUDE
  [231, 40],    // WIND_COV
  [246, 58],    // AIS_VESSEL
  [285, 33],    // GIMBAL_MANAGER_INFORMATION
  [286, 13],    // GIMBAL_MANAGER_STATUS
]);

// ── CRC-16/MCRF4XX ─────────────────────────────────────────

/**
 * Compute CRC-16/MCRF4XX (X.25) used by MAVLink.
 * Polynomial 0x1021, init 0xFFFF, no final XOR.
 */
export function crc16(data: Uint8Array, start: number, length: number): number {
  let crc = 0xffff;
  for (let i = start; i < start + length; i++) {
    let tmp = data[i] ^ (crc & 0xff);
    tmp ^= (tmp << 4) & 0xff;
    crc = ((crc >> 8) & 0xff) ^ (tmp << 8) ^ (tmp << 3) ^ ((tmp >> 4) & 0xf);
    crc &= 0xffff;
  }
  return crc;
}

/**
 * Accumulate a single byte into a running CRC-16/MCRF4XX value.
 * Used when we need to feed the CRC_EXTRA byte separately.
 */
export function crc16Accumulate(byte: number, crc: number): number {
  let tmp = byte ^ (crc & 0xff);
  tmp ^= (tmp << 4) & 0xff;
  crc = ((crc >> 8) & 0xff) ^ (tmp << 8) ^ (tmp << 3) ^ ((tmp >> 4) & 0xf);
  return crc & 0xffff;
}

// ── Frame Type ──────────────────────────────────────────────

/** A parsed MAVLink v2 frame. */
export interface MAVLinkFrame {
  /** MAVLink message ID (0–16777215). */
  msgId: number;
  /** Sender system ID. */
  systemId: number;
  /** Sender component ID. */
  componentId: number;
  /** Packet sequence number (0–255). */
  sequence: number;
  /** Payload as a little-endian DataView (zero-restored to canonical length). */
  payload: DataView;
  /** Local timestamp (ms) when the frame was parsed. */
  timestamp: number;
}

type FrameCallback = (frame: MAVLinkFrame) => void;

// ── Parser ──────────────────────────────────────────────────

/**
 * Streaming MAVLink v2 parser.
 *
 * Feed raw bytes via `feed()`. The parser accumulates them in an
 * internal buffer, scans for 0xFD markers, validates each candidate
 * frame (length, CRC), restores zero-trimmed payloads, and emits
 * `MAVLinkFrame` objects to registered callbacks.
 *
 * @example
 * ```ts
 * const parser = new MAVLinkParser();
 * const unsub = parser.onFrame((frame) => {
 *   console.log(`msg ${frame.msgId} from sys ${frame.systemId}`);
 * });
 * transport.on("data", (bytes) => parser.feed(bytes));
 * ```
 */
export class MAVLinkParser {
  private buffer: Uint8Array;
  private writePos = 0;
  private callbacks: FrameCallback[] = [];

  constructor(initialCapacity = 4096) {
    this.buffer = new Uint8Array(initialCapacity);
  }

  /**
   * Feed raw bytes from the transport into the parser.
   * Triggers frame parsing and callback emission synchronously.
   */
  feed(data: Uint8Array): void {
    this.ensureCapacity(data.length);
    this.buffer.set(data, this.writePos);
    this.writePos += data.length;
    this.parseFrames();
  }

  /** Subscribe to parsed frames. Returns an unsubscribe function. */
  onFrame(callback: FrameCallback): () => void {
    this.callbacks.push(callback);
    return () => {
      const idx = this.callbacks.indexOf(callback);
      if (idx !== -1) this.callbacks.splice(idx, 1);
    };
  }

  /** Clear the internal buffer and discard any partial frames. */
  reset(): void {
    this.writePos = 0;
  }

  // ── Internal ────────────────────────────────────────────

  private ensureCapacity(additional: number): void {
    const needed = this.writePos + additional;
    if (needed <= this.buffer.length) return;

    // Double the buffer (or more if needed)
    let newSize = this.buffer.length * 2;
    while (newSize < needed) newSize *= 2;

    const newBuf = new Uint8Array(newSize);
    newBuf.set(this.buffer.subarray(0, this.writePos));
    this.buffer = newBuf;
  }

  private parseFrames(): void {
    let readPos = 0;

    while (readPos < this.writePos) {
      // Scan for STX
      if (this.buffer[readPos] !== MAVLINK_STX) {
        readPos++;
        continue;
      }

      // Need at least the header to know payload length
      if (this.writePos - readPos < HEADER_SIZE) break;

      const payloadLen = this.buffer[readPos + 1];
      const frameLen = HEADER_SIZE + payloadLen + CRC_SIZE;

      // Wait for full frame
      if (this.writePos - readPos < frameLen) break;

      // Extract header fields
      const incFlags = this.buffer[readPos + 2];
      const _cmpFlags = this.buffer[readPos + 3];
      const seq = this.buffer[readPos + 4];
      const sysId = this.buffer[readPos + 5];
      const compId = this.buffer[readPos + 6];
      const msgId =
        this.buffer[readPos + 7] |
        (this.buffer[readPos + 8] << 8) |
        (this.buffer[readPos + 9] << 16);

      // Signature handling — if incompatibility flag bit 0 is set, 13 extra bytes follow CRC
      const signatureLen = (incFlags & 0x01) ? 13 : 0;
      const totalLen = frameLen + signatureLen;
      if (this.writePos - readPos < totalLen) break;

      // Validate CRC
      const crcExtra = CRC_EXTRA.get(msgId);
      if (crcExtra === undefined) {
        // Unknown message — skip this byte and keep scanning
        readPos++;
        continue;
      }

      // CRC covers bytes 1..(HEADER_SIZE + payloadLen - 1), i.e. everything except STX and CRC itself
      let crc = crc16(this.buffer, readPos + 1, HEADER_SIZE - 1 + payloadLen);
      crc = crc16Accumulate(crcExtra, crc);

      const wireCrcLo = this.buffer[readPos + HEADER_SIZE + payloadLen];
      const wireCrcHi = this.buffer[readPos + HEADER_SIZE + payloadLen + 1];
      const wireCrc = wireCrcLo | (wireCrcHi << 8);

      if (crc !== wireCrc) {
        if (msgId === 77) {
          console.debug(`[MAVLink] CRC mismatch for COMMAND_ACK: computed=${crc} wire=${wireCrc} payloadLen=${payloadLen}`)
        }
        // CRC mismatch — skip this STX and try the next byte
        readPos++;
        continue;
      }

      // Extract payload (restore zero-trimmed trailing bytes)
      const expectedLen = PAYLOAD_LENGTHS.get(msgId) ?? payloadLen;
      const restored = new Uint8Array(expectedLen);
      const copyLen = Math.min(payloadLen, expectedLen);
      restored.set(
        this.buffer.subarray(readPos + HEADER_SIZE, readPos + HEADER_SIZE + copyLen),
      );
      // Remaining bytes stay zero (Uint8Array is zero-initialized)

      const frame: MAVLinkFrame = {
        msgId,
        systemId: sysId,
        componentId: compId,
        sequence: seq,
        payload: new DataView(restored.buffer, restored.byteOffset, restored.byteLength),
        timestamp: Date.now(),
      };

      // Emit
      for (const cb of this.callbacks) {
        cb(frame);
      }

      readPos += totalLen;
    }

    // Compact buffer — move unconsumed bytes to front
    if (readPos > 0) {
      if (readPos < this.writePos) {
        this.buffer.copyWithin(0, readPos, this.writePos);
      }
      this.writePos -= readPos;
    }
  }
}
