/**
 * Typed MAVLink v2 message decoders.
 *
 * Each function takes the payload `DataView` from a parsed `MAVLinkFrame`
 * (little-endian, zero-restored) and returns a typed object.
 *
 * **IMPORTANT:** Field offsets follow MAVLink v2 **wire order**, which sorts
 * fields by type size (largest first), NOT the XML definition order. Within
 * the same type size, fields retain their XML declaration order. This
 * reordering is part of the MAVLink v2 serialization spec. Messages where
 * all fields share the same size (e.g., ATTITUDE — all float32) are
 * unaffected; mixed-size messages differ from their XML layout.
 *
 * All multi-byte reads use little-endian (`true` as the second argument
 * to DataView getters).
 *
 * @module protocol/mavlink-messages
 */

// ── HEARTBEAT (ID 0) ───────────────────────────────────────

export interface HeartbeatMsg {
  customMode: number;
  type: number;
  autopilot: number;
  baseMode: number;
  systemStatus: number;
  mavlinkVersion: number;
}

/**
 * Decode HEARTBEAT (msg ID 0).
 *
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint32 | customMode      |
 * | 4      | uint8  | type            |
 * | 5      | uint8  | autopilot       |
 * | 6      | uint8  | baseMode        |
 * | 7      | uint8  | systemStatus    |
 * | 8      | uint8  | mavlinkVersion  |
 */
export function decodeHeartbeat(dv: DataView): HeartbeatMsg {
  return {
    customMode: dv.getUint32(0, true),
    type: dv.getUint8(4),
    autopilot: dv.getUint8(5),
    baseMode: dv.getUint8(6),
    systemStatus: dv.getUint8(7),
    mavlinkVersion: dv.getUint8(8),
  };
}

// ── SYS_STATUS (ID 1) ──────────────────────────────────────

export interface SysStatusMsg {
  onboardControlSensorsPresent: number;
  onboardControlSensorsEnabled: number;
  onboardControlSensorsHealth: number;
  load: number;
  voltageBattery: number;
  currentBattery: number;
  batteryRemaining: number;
  dropRateComm: number;
  errorsComm: number;
}

/**
 * Decode SYS_STATUS (msg ID 1).
 *
 * Wire order (uint32 → uint16/int16 → int8):
 * | Offset | Type   | Field                          |
 * |--------|--------|--------------------------------|
 * | 0      | uint32 | onboardControlSensorsPresent   |
 * | 4      | uint32 | onboardControlSensorsEnabled   |
 * | 8      | uint32 | onboardControlSensorsHealth    |
 * | 12     | uint16 | load                           |
 * | 14     | uint16 | voltageBattery (mV)            |
 * | 16     | int16  | currentBattery (cA, 10*mA)     |
 * | 18     | uint16 | dropRateComm                   |
 * | 20     | uint16 | errorsComm                     |
 * | 22     | uint16 | errorsCount1                   |
 * | 24     | uint16 | errorsCount2                   |
 * | 26     | uint16 | errorsCount3                   |
 * | 28     | uint16 | errorsCount4                   |
 * | 30     | int8   | batteryRemaining (%)           |
 */
export function decodeSysStatus(dv: DataView): SysStatusMsg {
  return {
    onboardControlSensorsPresent: dv.getUint32(0, true),
    onboardControlSensorsEnabled: dv.getUint32(4, true),
    onboardControlSensorsHealth: dv.getUint32(8, true),
    load: dv.getUint16(12, true),
    voltageBattery: dv.getUint16(14, true),
    currentBattery: dv.getInt16(16, true),
    batteryRemaining: dv.getInt8(30),
    dropRateComm: dv.getUint16(18, true),
    errorsComm: dv.getUint16(20, true),
  };
}

// ── ATTITUDE (ID 30) ───────────────────────────────────────

export interface AttitudeMsg {
  timeBootMs: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

/**
 * Decode ATTITUDE (msg ID 30).
 *
 * | Offset | Type    | Field       |
 * |--------|---------|-------------|
 * | 0      | uint32  | timeBootMs  |
 * | 4      | float32 | roll (rad)  |
 * | 8      | float32 | pitch (rad) |
 * | 12     | float32 | yaw (rad)   |
 * | 16     | float32 | rollspeed   |
 * | 20     | float32 | pitchspeed  |
 * | 24     | float32 | yawspeed    |
 */
export function decodeAttitude(dv: DataView): AttitudeMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    roll: dv.getFloat32(4, true),
    pitch: dv.getFloat32(8, true),
    yaw: dv.getFloat32(12, true),
    rollspeed: dv.getFloat32(16, true),
    pitchspeed: dv.getFloat32(20, true),
    yawspeed: dv.getFloat32(24, true),
  };
}

// ── GPS_RAW_INT (ID 24) ────────────────────────────────────

export interface GpsRawIntMsg {
  timeUsec: number;
  fixType: number;
  lat: number;
  lon: number;
  alt: number;
  eph: number;
  epv: number;
  vel: number;
  cog: number;
  satellitesVisible: number;
}

/**
 * Decode GPS_RAW_INT (msg ID 24).
 *
 * | Offset | Type   | Field             |
 * |--------|--------|-------------------|
 * | 0      | uint64 | timeUsec          |
 * | 8      | int32  | lat (degE7)       |
 * | 12     | int32  | lon (degE7)       |
 * | 16     | int32  | alt (mm MSL)      |
 * | 20     | uint16 | eph (cm)          |
 * | 22     | uint16 | epv (cm)          |
 * | 24     | uint16 | vel (cm/s)        |
 * | 26     | uint16 | cog (cdeg)        |
 * | 28     | uint8  | fixType           |
 * | 29     | uint8  | satellitesVisible |
 */
export function decodeGpsRawInt(dv: DataView): GpsRawIntMsg {
  // timeUsec is uint64 — read as two uint32 and combine (safe up to 2^53)
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    lat: dv.getInt32(8, true),
    lon: dv.getInt32(12, true),
    alt: dv.getInt32(16, true),
    eph: dv.getUint16(20, true),
    epv: dv.getUint16(22, true),
    vel: dv.getUint16(24, true),
    cog: dv.getUint16(26, true),
    fixType: dv.getUint8(28),
    satellitesVisible: dv.getUint8(29),
  };
}

// ── GLOBAL_POSITION_INT (ID 33) ────────────────────────────

export interface GlobalPositionIntMsg {
  timeBootMs: number;
  lat: number;
  lon: number;
  alt: number;
  relativeAlt: number;
  vx: number;
  vy: number;
  vz: number;
  hdg: number;
}

/**
 * Decode GLOBAL_POSITION_INT (msg ID 33).
 *
 * | Offset | Type   | Field       |
 * |--------|--------|-------------|
 * | 0      | uint32 | timeBootMs  |
 * | 4      | int32  | lat (degE7) |
 * | 8      | int32  | lon (degE7) |
 * | 12     | int32  | alt (mm)    |
 * | 16     | int32  | relativeAlt |
 * | 20     | int16  | vx (cm/s)   |
 * | 22     | int16  | vy (cm/s)   |
 * | 24     | int16  | vz (cm/s)   |
 * | 26     | uint16 | hdg (cdeg)  |
 */
export function decodeGlobalPositionInt(dv: DataView): GlobalPositionIntMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    lat: dv.getInt32(4, true),
    lon: dv.getInt32(8, true),
    alt: dv.getInt32(12, true),
    relativeAlt: dv.getInt32(16, true),
    vx: dv.getInt16(20, true),
    vy: dv.getInt16(22, true),
    vz: dv.getInt16(24, true),
    hdg: dv.getUint16(26, true),
  };
}

// ── RC_CHANNELS (ID 65) ────────────────────────────────────

export interface RcChannelsMsg {
  timeBootMs: number;
  chancount: number;
  channels: number[];
  rssi: number;
}

/**
 * Decode RC_CHANNELS (msg ID 65).
 *
 * | Offset | Type   | Field       |
 * |--------|--------|-------------|
 * Wire order (uint32 → uint16 → uint8):
 * | Offset | Type   | Field       |
 * |--------|--------|-------------|
 * | 0      | uint32 | timeBootMs  |
 * | 4      | uint16 | chan1_raw    |
 * | 6      | uint16 | chan2_raw    |
 * | ...    | ...    | ...         |
 * | 38     | uint16 | chan18_raw   |
 * | 40     | uint8  | chancount   |
 * | 41     | uint8  | rssi        |
 */
export function decodeRcChannels(dv: DataView): RcChannelsMsg {
  const channels: number[] = [];
  for (let i = 0; i < 18; i++) {
    channels.push(dv.getUint16(4 + i * 2, true));
  }
  return {
    timeBootMs: dv.getUint32(0, true),
    chancount: dv.getUint8(40),
    channels,
    rssi: dv.getUint8(41),
  };
}

// ── VFR_HUD (ID 74) ────────────────────────────────────────

export interface VfrHudMsg {
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}

/**
 * Decode VFR_HUD (msg ID 74).
 *
 * Wire order (float32 → int16/uint16):
 * | Offset | Type    | Field       |
 * |--------|---------|-------------|
 * | 0      | float32 | airspeed    |
 * | 4      | float32 | groundspeed |
 * | 8      | float32 | alt         |
 * | 12     | float32 | climb       |
 * | 16     | int16   | heading     |
 * | 18     | uint16  | throttle    |
 */
export function decodeVfrHud(dv: DataView): VfrHudMsg {
  return {
    airspeed: dv.getFloat32(0, true),
    groundspeed: dv.getFloat32(4, true),
    heading: dv.getInt16(16, true),
    throttle: dv.getUint16(18, true),
    alt: dv.getFloat32(8, true),
    climb: dv.getFloat32(12, true),
  };
}

// ── COMMAND_ACK (ID 77) ────────────────────────────────────

export interface CommandAckMsg {
  command: number;
  result: number;
}

/**
 * Decode COMMAND_ACK (msg ID 77).
 *
 * | Offset | Type   | Field   |
 * |--------|--------|---------|
 * | 0      | uint16 | command |
 * | 2      | uint8  | result  |
 */
export function decodeCommandAck(dv: DataView): CommandAckMsg {
  return {
    command: dv.getUint16(0, true),
    result: dv.getUint8(2),
  };
}

// ── PARAM_VALUE (ID 22) ────────────────────────────────────

export interface ParamValueMsg {
  paramValue: number;
  paramCount: number;
  paramIndex: number;
  paramId: string;
  paramType: number;
}

/**
 * Decode PARAM_VALUE (msg ID 22).
 *
 * | Offset | Type     | Field      |
 * |--------|----------|------------|
 * | 0      | float32  | paramValue |
 * | 4      | uint16   | paramCount |
 * | 6      | uint16   | paramIndex |
 * | 8      | char[16] | paramId    |
 * | 24     | uint8    | paramType  |
 */
export function decodeParamValue(dv: DataView): ParamValueMsg {
  // Extract null-terminated param ID
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + 8, 16);
  let end = bytes.indexOf(0);
  if (end === -1) end = 16;
  const paramId = new TextDecoder().decode(bytes.subarray(0, end));

  return {
    paramValue: dv.getFloat32(0, true),
    paramCount: dv.getUint16(4, true),
    paramIndex: dv.getUint16(6, true),
    paramId,
    paramType: dv.getUint8(24),
  };
}

// ── BATTERY_STATUS (ID 147) ────────────────────────────────

export interface BatteryStatusMsg {
  id: number;
  batteryFunction: number;
  type: number;
  temperature: number;
  voltages: number[];
  currentBattery: number;
  currentConsumed: number;
  energyConsumed: number;
  batteryRemaining: number;
}

/**
 * Decode BATTERY_STATUS (msg ID 147).
 *
 * Wire order (int32 → int16/uint16 → uint8/int8):
 * | Offset | Type        | Field            |
 * |--------|-------------|------------------|
 * | 0      | int32       | currentConsumed  |
 * | 4      | int32       | energyConsumed   |
 * | 8      | int16       | temperature (cC) |
 * | 10     | uint16[10]  | voltages (mV)    |
 * | 30     | int16       | currentBattery   |
 * | 32     | uint8       | id               |
 * | 33     | uint8       | batteryFunction  |
 * | 34     | uint8       | type             |
 * | 35     | int8        | batteryRemaining |
 */
export function decodeBatteryStatus(dv: DataView): BatteryStatusMsg {
  const voltages: number[] = [];
  for (let i = 0; i < 10; i++) {
    voltages.push(dv.getUint16(10 + i * 2, true));
  }

  return {
    id: dv.getUint8(32),
    batteryFunction: dv.getUint8(33),
    type: dv.getUint8(34),
    temperature: dv.getInt16(8, true),
    voltages,
    currentBattery: dv.getInt16(30, true),
    currentConsumed: dv.getInt32(0, true),
    energyConsumed: dv.getInt32(4, true),
    batteryRemaining: dv.getInt8(35),
  };
}

// ── STATUSTEXT (ID 253) ────────────────────────────────────

export interface StatustextMsg {
  severity: number;
  text: string;
}

/**
 * Decode STATUSTEXT (msg ID 253).
 *
 * | Offset | Type     | Field    |
 * |--------|----------|----------|
 * | 0      | uint8    | severity |
 * | 1      | char[50] | text     |
 */
export function decodeStatustext(dv: DataView): StatustextMsg {
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + 1, 50);
  let end = bytes.indexOf(0);
  if (end === -1) end = 50;
  const text = new TextDecoder().decode(bytes.subarray(0, end));

  return {
    severity: dv.getUint8(0),
    text,
  };
}

// ── MISSION_ACK (ID 47) ────────────────────────────────────

export interface MissionAckMsg {
  targetSystem: number;
  targetComponent: number;
  type: number;
}

/**
 * Decode MISSION_ACK (msg ID 47).
 *
 * | Offset | Type  | Field           |
 * |--------|-------|-----------------|
 * | 0      | uint8 | targetSystem    |
 * | 1      | uint8 | targetComponent |
 * | 2      | uint8 | type            |
 */
export function decodeMissionAck(dv: DataView): MissionAckMsg {
  return {
    targetSystem: dv.getUint8(0),
    targetComponent: dv.getUint8(1),
    type: dv.getUint8(2),
  };
}

// ── SERIAL_CONTROL (ID 126) ─────────────────────────────────

export interface SerialControlMsg {
  baudrate: number;
  timeout: number;
  device: number;
  flags: number;
  count: number;
  data: Uint8Array;
}

/**
 * Decode SERIAL_CONTROL (msg ID 126).
 *
 * | Offset | Type      | Field    |
 * |--------|-----------|----------|
 * | 0      | uint32    | baudrate |
 * | 4      | uint16    | timeout  |
 * | 6      | uint8     | device   |
 * | 7      | uint8     | flags    |
 * | 8      | uint8     | count    |
 * | 9      | uint8[70] | data     |
 */
export function decodeSerialControl(dv: DataView): SerialControlMsg {
  const count = dv.getUint8(8);
  const data = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = dv.getUint8(9 + i);
  }
  return {
    baudrate: dv.getUint32(0, true),
    timeout: dv.getUint16(4, true),
    device: dv.getUint8(6),
    flags: dv.getUint8(7),
    count,
    data,
  };
}

// ── MISSION_REQUEST_INT (ID 51) ─────────────────────────────

export interface MissionRequestIntMsg {
  targetSystem: number;
  targetComponent: number;
  seq: number;
}

/**
 * Decode MISSION_REQUEST_INT (msg ID 51).
 *
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint16 | seq             |
 * | 2      | uint8  | targetSystem    |
 * | 3      | uint8  | targetComponent |
 */
export function decodeMissionRequestInt(dv: DataView): MissionRequestIntMsg {
  return {
    seq: dv.getUint16(0, true),
    targetSystem: dv.getUint8(2),
    targetComponent: dv.getUint8(3),
  };
}

// ── RADIO_STATUS (ID 109) ──────────────────────────────────

export interface RadioStatusMsg {
  rxerrors: number;
  fixed: number;
  rssi: number;
  remrssi: number;
  txbuf: number;
  noise: number;
  remnoise: number;
}

/**
 * Decode RADIO_STATUS (msg ID 109).
 *
 * | Offset | Type   | Field     |
 * |--------|--------|-----------|
 * | 0      | uint16 | rxerrors  |
 * | 2      | uint16 | fixed     |
 * | 4      | uint8  | rssi      |
 * | 5      | uint8  | remrssi   |
 * | 6      | uint8  | txbuf     |
 * | 7      | uint8  | noise     |
 * | 8      | uint8  | remnoise  |
 */
export function decodeRadioStatus(dv: DataView): RadioStatusMsg {
  return {
    rxerrors: dv.getUint16(0, true),
    fixed: dv.getUint16(2, true),
    rssi: dv.getUint8(4),
    remrssi: dv.getUint8(5),
    txbuf: dv.getUint8(6),
    noise: dv.getUint8(7),
    remnoise: dv.getUint8(8),
  };
}

// ── MISSION_COUNT (ID 44) ──────────────────────────────────

export interface MissionCountMsg {
  count: number;
  targetSystem: number;
  targetComponent: number;
}

/**
 * Decode MISSION_COUNT (msg ID 44).
 *
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint16 | count           |
 * | 2      | uint8  | targetSystem    |
 * | 3      | uint8  | targetComponent |
 */
export function decodeMissionCount(dv: DataView): MissionCountMsg {
  return {
    count: dv.getUint16(0, true),
    targetSystem: dv.getUint8(2),
    targetComponent: dv.getUint8(3),
  };
}

// ── MISSION_ITEM_INT (ID 73) — Decode ─────────────────────

export interface MissionItemIntMsg {
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  x: number;
  y: number;
  z: number;
  seq: number;
  command: number;
  targetSystem: number;
  targetComponent: number;
  frame: number;
  current: number;
  autocontinue: number;
}

/**
 * Decode MISSION_ITEM_INT (msg ID 73).
 *
 * | Offset | Type    | Field           |
 * |--------|---------|-----------------|
 * | 0      | float32 | param1          |
 * | 4      | float32 | param2          |
 * | 8      | float32 | param3          |
 * | 12     | float32 | param4          |
 * | 16     | int32   | x (lat * 1e7)   |
 * | 20     | int32   | y (lon * 1e7)   |
 * | 24     | float32 | z (alt)         |
 * | 28     | uint16  | seq             |
 * | 30     | uint16  | command         |
 * | 32     | uint8   | targetSystem    |
 * | 33     | uint8   | targetComponent |
 * | 34     | uint8   | frame           |
 * | 35     | uint8   | current         |
 * | 36     | uint8   | autocontinue    |
 */
export function decodeMissionItemInt(dv: DataView): MissionItemIntMsg {
  return {
    param1: dv.getFloat32(0, true),
    param2: dv.getFloat32(4, true),
    param3: dv.getFloat32(8, true),
    param4: dv.getFloat32(12, true),
    x: dv.getInt32(16, true),
    y: dv.getInt32(20, true),
    z: dv.getFloat32(24, true),
    seq: dv.getUint16(28, true),
    command: dv.getUint16(30, true),
    targetSystem: dv.getUint8(32),
    targetComponent: dv.getUint8(33),
    frame: dv.getUint8(34),
    current: dv.getUint8(35),
    autocontinue: dv.getUint8(36),
  };
}

// ── MISSION_CURRENT (ID 42) ────────────────────────────────

export interface MissionCurrentMsg {
  seq: number;
}

/**
 * Decode MISSION_CURRENT (msg ID 42).
 *
 * | Offset | Type   | Field |
 * |--------|--------|-------|
 * | 0      | uint16 | seq   |
 */
export function decodeMissionCurrent(dv: DataView): MissionCurrentMsg {
  return {
    seq: dv.getUint16(0, true),
  };
}

// ── MISSION_ITEM_REACHED (ID 46) ───────────────────────────

export interface MissionItemReachedMsg {
  seq: number;
}

/**
 * Decode MISSION_ITEM_REACHED (msg ID 46).
 *
 * | Offset | Type   | Field |
 * |--------|--------|-------|
 * | 0      | uint16 | seq   |
 */
export function decodeMissionItemReached(dv: DataView): MissionItemReachedMsg {
  return {
    seq: dv.getUint16(0, true),
  };
}

// ── MAG_CAL_PROGRESS (ID 191) ───────────────────────────────

export interface MagCalProgressMsg {
  compassId: number;
  calMask: number;
  calStatus: number;
  attempt: number;
  completionPct: number;
  completionMask: Uint8Array;
  directionX: number;
  directionY: number;
  directionZ: number;
}

/**
 * Decode MAG_CAL_PROGRESS (msg ID 191).
 *
 * | Offset | Type       | Field           |
 * |--------|------------|-----------------|
 * | 0      | float32    | directionX      |
 * | 4      | float32    | directionY      |
 * | 8      | float32    | directionZ      |
 * | 12     | uint8      | compassId       |
 * | 13     | uint8      | calMask         |
 * | 14     | uint8      | calStatus       |
 * | 15     | uint8      | attempt         |
 * | 16     | uint8      | completionPct   |
 * | 17     | uint8[10]  | completionMask  |
 */
export function decodeMagCalProgress(dv: DataView): MagCalProgressMsg {
  const completionMask = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    completionMask[i] = dv.getUint8(17 + i);
  }
  return {
    directionX: dv.getFloat32(0, true),
    directionY: dv.getFloat32(4, true),
    directionZ: dv.getFloat32(8, true),
    compassId: dv.getUint8(12),
    calMask: dv.getUint8(13),
    calStatus: dv.getUint8(14),
    attempt: dv.getUint8(15),
    completionPct: dv.getUint8(16),
    completionMask,
  };
}

// ── MAG_CAL_REPORT (ID 192) ────────────────────────────────

export interface MagCalReportMsg {
  compassId: number;
  calMask: number;
  calStatus: number;
  autosaved: number;
  fitness: number;
  ofsX: number;
  ofsY: number;
  ofsZ: number;
  diagX: number;
  diagY: number;
  diagZ: number;
  offdiagX: number;
  offdiagY: number;
  offdiagZ: number;
  orientationConfidence: number;
  oldOrientation: number;
  newOrientation: number;
  scaleFactor: number;
}

/**
 * Decode MAG_CAL_REPORT (msg ID 192).
 *
 * Base fields (44 bytes):
 * | Offset | Type    | Field       |
 * |--------|---------|-------------|
 * | 0      | float32 | fitness     |
 * | 4      | float32 | ofsX        |
 * | 8      | float32 | ofsY        |
 * | 12     | float32 | ofsZ        |
 * | 16     | float32 | diagX       |
 * | 20     | float32 | diagY       |
 * | 24     | float32 | diagZ       |
 * | 28     | float32 | offdiagX    |
 * | 32     | float32 | offdiagY    |
 * | 36     | float32 | offdiagZ    |
 * | 40     | uint8   | compassId   |
 * | 41     | uint8   | calMask     |
 * | 42     | uint8   | calStatus   |
 * | 43     | uint8   | autosaved   |
 *
 * Extension fields (offsets 44-53, present when payload > 44 bytes):
 * | 44     | float32 | orientationConfidence |
 * | 48     | uint8   | oldOrientation        |
 * | 49     | uint8   | newOrientation        |
 * | 50     | float32 | scaleFactor           |
 */
export function decodeMagCalReport(dv: DataView): MagCalReportMsg {
  const hasExtensions = dv.byteLength >= 54;
  return {
    fitness: dv.getFloat32(0, true),
    ofsX: dv.getFloat32(4, true),
    ofsY: dv.getFloat32(8, true),
    ofsZ: dv.getFloat32(12, true),
    diagX: dv.getFloat32(16, true),
    diagY: dv.getFloat32(20, true),
    diagZ: dv.getFloat32(24, true),
    offdiagX: dv.getFloat32(28, true),
    offdiagY: dv.getFloat32(32, true),
    offdiagZ: dv.getFloat32(36, true),
    compassId: dv.getUint8(40),
    calMask: dv.getUint8(41),
    calStatus: dv.getUint8(42),
    autosaved: dv.getUint8(43),
    orientationConfidence: hasExtensions ? dv.getFloat32(44, true) : 0,
    oldOrientation: hasExtensions ? dv.getUint8(48) : 0,
    newOrientation: hasExtensions ? dv.getUint8(49) : 0,
    scaleFactor: hasExtensions ? dv.getFloat32(50, true) : 0,
  };
}

// ── COMMAND_LONG (ID 76) — Decode ───────────────────────────

export interface CommandLongMsg {
  param1: number;
  param2: number;
  param3: number;
  param4: number;
  param5: number;
  param6: number;
  param7: number;
  command: number;
  targetSystem: number;
  targetComponent: number;
  confirmation: number;
}

/**
 * Decode COMMAND_LONG (msg ID 76).
 *
 * MAVLink wire order (largest type first):
 * | Offset | Type    | Field           |
 * |--------|---------|-----------------|
 * | 0      | float32 | param1          |
 * | 4      | float32 | param2          |
 * | 8      | float32 | param3          |
 * | 12     | float32 | param4          |
 * | 16     | float32 | param5          |
 * | 20     | float32 | param6          |
 * | 24     | float32 | param7          |
 * | 28     | uint16  | command         |
 * | 30     | uint8   | targetSystem    |
 * | 31     | uint8   | targetComponent |
 * | 32     | uint8   | confirmation    |
 */
export function decodeCommandLong(dv: DataView): CommandLongMsg {
  return {
    param1: dv.getFloat32(0, true),
    param2: dv.getFloat32(4, true),
    param3: dv.getFloat32(8, true),
    param4: dv.getFloat32(12, true),
    param5: dv.getFloat32(16, true),
    param6: dv.getFloat32(20, true),
    param7: dv.getFloat32(24, true),
    command: dv.getUint16(28, true),
    targetSystem: dv.getUint8(30),
    targetComponent: dv.getUint8(31),
    confirmation: dv.getUint8(32),
  };
}

// ── EKF_STATUS_REPORT (ID 335) ─────────────────────────────

export interface EkfStatusReportMsg {
  velocityVariance: number;
  posHorizVariance: number;
  posVertVariance: number;
  compassVariance: number;
  terrainAltVariance: number;
  flags: number;
}

/**
 * Decode EKF_STATUS_REPORT (msg ID 335).
 *
 * | Offset | Type    | Field                |
 * |--------|---------|----------------------|
 * | 0      | float32 | velocityVariance     |
 * | 4      | float32 | posHorizVariance     |
 * | 8      | float32 | posVertVariance      |
 * | 12     | float32 | compassVariance      |
 * | 16     | float32 | terrainAltVariance   |
 * | 20     | uint16  | flags                |
 */
export function decodeEkfStatusReport(dv: DataView): EkfStatusReportMsg {
  return {
    velocityVariance: dv.getFloat32(0, true),
    posHorizVariance: dv.getFloat32(4, true),
    posVertVariance: dv.getFloat32(8, true),
    compassVariance: dv.getFloat32(12, true),
    terrainAltVariance: dv.getFloat32(16, true),
    flags: dv.getUint16(20, true),
  };
}

// ── VIBRATION (ID 241) ─────────────────────────────────────

export interface VibrationMsg {
  timeUsec: number;
  vibrationX: number;
  vibrationY: number;
  vibrationZ: number;
  clipping0: number;
  clipping1: number;
  clipping2: number;
}

/**
 * Decode VIBRATION (msg ID 241).
 *
 * | Offset | Type    | Field        |
 * |--------|---------|--------------|
 * | 0      | uint64  | timeUsec     |
 * | 8      | float32 | vibrationX   |
 * | 12     | float32 | vibrationY   |
 * | 16     | float32 | vibrationZ   |
 * | 20     | uint32  | clipping0    |
 * | 24     | uint32  | clipping1    |
 * | 28     | uint32  | clipping2    |
 */
export function decodeVibration(dv: DataView): VibrationMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    vibrationX: dv.getFloat32(8, true),
    vibrationY: dv.getFloat32(12, true),
    vibrationZ: dv.getFloat32(16, true),
    clipping0: dv.getUint32(20, true),
    clipping1: dv.getUint32(24, true),
    clipping2: dv.getUint32(28, true),
  };
}

// ── SERVO_OUTPUT_RAW (ID 36) ───────────────────────────────

export interface ServoOutputRawMsg {
  timeUsec: number;
  servo1: number;
  servo2: number;
  servo3: number;
  servo4: number;
  servo5: number;
  servo6: number;
  servo7: number;
  servo8: number;
  port: number;
}

/**
 * Decode SERVO_OUTPUT_RAW (msg ID 36).
 *
 * | Offset | Type   | Field      |
 * |--------|--------|------------|
 * | 0      | uint32 | timeUsec   |
 * | 4      | uint16 | servo1_raw |
 * | 6      | uint16 | servo2_raw |
 * | 8      | uint16 | servo3_raw |
 * | 10     | uint16 | servo4_raw |
 * | 12     | uint16 | servo5_raw |
 * | 14     | uint16 | servo6_raw |
 * | 16     | uint16 | servo7_raw |
 * | 18     | uint16 | servo8_raw |
 * | 20     | uint8  | port       |
 */
export function decodeServoOutputRaw(dv: DataView): ServoOutputRawMsg {
  return {
    timeUsec: dv.getUint32(0, true),
    servo1: dv.getUint16(4, true),
    servo2: dv.getUint16(6, true),
    servo3: dv.getUint16(8, true),
    servo4: dv.getUint16(10, true),
    servo5: dv.getUint16(12, true),
    servo6: dv.getUint16(14, true),
    servo7: dv.getUint16(16, true),
    servo8: dv.getUint16(18, true),
    port: dv.getUint8(20),
  };
}

// ── WIND (ID 168) ──────────────────────────────────────────

export interface WindMsg {
  direction: number;
  speed: number;
  speedZ: number;
}

/**
 * Decode WIND (msg ID 168).
 *
 * | Offset | Type    | Field     |
 * |--------|---------|-----------|
 * | 0      | float32 | direction |
 * | 4      | float32 | speed     |
 * | 8      | float32 | speedZ    |
 */
export function decodeWind(dv: DataView): WindMsg {
  return {
    direction: dv.getFloat32(0, true),
    speed: dv.getFloat32(4, true),
    speedZ: dv.getFloat32(8, true),
  };
}

// ── TERRAIN_REPORT (ID 136) ────────────────────────────────

export interface TerrainReportMsg {
  lat: number;
  lon: number;
  spacing: number;
  terrainHeight: number;
  currentHeight: number;
  pending: number;
  loaded: number;
}

/**
 * Decode TERRAIN_REPORT (msg ID 136).
 *
 * | Offset | Type    | Field          |
 * |--------|---------|----------------|
 * | 0      | int32   | lat (degE7)    |
 * | 4      | int32   | lon (degE7)    |
 * | 8      | float32 | terrainHeight  |
 * | 12     | float32 | currentHeight  |
 * | 16     | uint16  | spacing        |
 * | 18     | uint16  | pending        |
 * | 20     | uint16  | loaded         |
 */
export function decodeTerrainReport(dv: DataView): TerrainReportMsg {
  return {
    lat: dv.getInt32(0, true),
    lon: dv.getInt32(4, true),
    terrainHeight: dv.getFloat32(8, true),
    currentHeight: dv.getFloat32(12, true),
    spacing: dv.getUint16(16, true),
    pending: dv.getUint16(18, true),
    loaded: dv.getUint16(20, true),
  };
}

// ── HOME_POSITION (ID 242) ──────────────────────────────────

export interface HomePositionMsg {
  lat: number;
  lon: number;
  alt: number;
  x: number;
  y: number;
  z: number;
  q: [number, number, number, number];
  approachX: number;
  approachY: number;
  approachZ: number;
}

/**
 * Decode HOME_POSITION (msg ID 242).
 *
 * Wire order (int32/float32 → none smaller):
 * | Offset | Type       | Field       |
 * |--------|------------|-------------|
 * | 0      | int32      | lat (degE7) |
 * | 4      | int32      | lon (degE7) |
 * | 8      | int32      | alt (mm)    |
 * | 12     | float32    | x           |
 * | 16     | float32    | y           |
 * | 20     | float32    | z           |
 * | 24     | float32[4] | q           |
 * | 40     | float32    | approachX   |
 * | 44     | float32    | approachY   |
 * | 48     | float32    | approachZ   |
 */
export function decodeHomePosition(dv: DataView): HomePositionMsg {
  return {
    lat: dv.getInt32(0, true),
    lon: dv.getInt32(4, true),
    alt: dv.getInt32(8, true),
    x: dv.getFloat32(12, true),
    y: dv.getFloat32(16, true),
    z: dv.getFloat32(20, true),
    q: [
      dv.getFloat32(24, true),
      dv.getFloat32(28, true),
      dv.getFloat32(32, true),
      dv.getFloat32(36, true),
    ],
    approachX: dv.getFloat32(40, true),
    approachY: dv.getFloat32(44, true),
    approachZ: dv.getFloat32(48, true),
  };
}

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

// ── POWER_STATUS (ID 125) ───────────────────────────────────

export interface PowerStatusMsg {
  vcc: number;
  vservo: number;
  flags: number;
}

/**
 * Decode POWER_STATUS (msg ID 125).
 *
 * Wire order (all uint16):
 * | Offset | Type   | Field  |
 * |--------|--------|--------|
 * | 0      | uint16 | vcc    |
 * | 2      | uint16 | vservo |
 * | 4      | uint16 | flags  |
 */
export function decodePowerStatus(dv: DataView): PowerStatusMsg {
  return {
    vcc: dv.getUint16(0, true),
    vservo: dv.getUint16(2, true),
    flags: dv.getUint16(4, true),
  };
}

// ── DISTANCE_SENSOR (ID 132) ────────────────────────────────

export interface DistanceSensorMsg {
  timeBootMs: number;
  minDistance: number;
  maxDistance: number;
  currentDistance: number;
  type: number;
  id: number;
  orientation: number;
  covariance: number;
}

/**
 * Decode DISTANCE_SENSOR (msg ID 132).
 *
 * Wire order (uint32 → uint16 → uint8):
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint32 | timeBootMs      |
 * | 4      | uint16 | minDistance (cm) |
 * | 6      | uint16 | maxDistance (cm) |
 * | 8      | uint16 | currentDist(cm) |
 * | 10     | uint8  | type            |
 * | 11     | uint8  | id              |
 * | 12     | uint8  | orientation     |
 * | 13     | uint8  | covariance (cm) |
 */
export function decodeDistanceSensor(dv: DataView): DistanceSensorMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    minDistance: dv.getUint16(4, true),
    maxDistance: dv.getUint16(6, true),
    currentDistance: dv.getUint16(8, true),
    type: dv.getUint8(10),
    id: dv.getUint8(11),
    orientation: dv.getUint8(12),
    covariance: dv.getUint8(13),
  };
}

// ── FENCE_STATUS (ID 162) ───────────────────────────────────

export interface FenceStatusMsg {
  breachTime: number;
  breachCount: number;
  breachStatus: number;
  breachType: number;
}

/**
 * Decode FENCE_STATUS (msg ID 162).
 *
 * Wire order (uint32 → uint16 → uint8):
 * | Offset | Type   | Field        |
 * |--------|--------|--------------|
 * | 0      | uint32 | breachTime   |
 * | 4      | uint16 | breachCount  |
 * | 6      | uint8  | breachStatus |
 * | 7      | uint8  | breachType   |
 */
export function decodeFenceStatus(dv: DataView): FenceStatusMsg {
  return {
    breachTime: dv.getUint32(0, true),
    breachCount: dv.getUint16(4, true),
    breachStatus: dv.getUint8(6),
    breachType: dv.getUint8(7),
  };
}

// ── NAV_CONTROLLER_OUTPUT (ID 62) ───────────────────────────

export interface NavControllerOutputMsg {
  navRoll: number;
  navPitch: number;
  altError: number;
  aspdError: number;
  xtrackError: number;
  navBearing: number;
  targetBearing: number;
  wpDist: number;
}

/**
 * Decode NAV_CONTROLLER_OUTPUT (msg ID 62).
 *
 * Wire order (float32 → int16 → uint16):
 * | Offset | Type    | Field          |
 * |--------|---------|----------------|
 * | 0      | float32 | navRoll        |
 * | 4      | float32 | navPitch       |
 * | 8      | float32 | altError       |
 * | 12     | float32 | aspdError      |
 * | 16     | float32 | xtrackError    |
 * | 20     | int16   | navBearing     |
 * | 22     | int16   | targetBearing  |
 * | 24     | uint16  | wpDist         |
 */
export function decodeNavControllerOutput(dv: DataView): NavControllerOutputMsg {
  return {
    navRoll: dv.getFloat32(0, true),
    navPitch: dv.getFloat32(4, true),
    altError: dv.getFloat32(8, true),
    aspdError: dv.getFloat32(12, true),
    xtrackError: dv.getFloat32(16, true),
    navBearing: dv.getInt16(20, true),
    targetBearing: dv.getInt16(22, true),
    wpDist: dv.getUint16(24, true),
  };
}

// ── SCALED_IMU (ID 26) ─────────────────────────────────────

export interface ScaledImuMsg {
  timeBootMs: number;
  xacc: number;
  yacc: number;
  zacc: number;
  xgyro: number;
  ygyro: number;
  zgyro: number;
  xmag: number;
  ymag: number;
  zmag: number;
}

/**
 * Decode SCALED_IMU (msg ID 26).
 *
 * Wire order (uint32 → int16):
 * | Offset | Type   | Field      |
 * |--------|--------|------------|
 * | 0      | uint32 | timeBootMs |
 * | 4      | int16  | xacc       |
 * | 6      | int16  | yacc       |
 * | 8      | int16  | zacc       |
 * | 10     | int16  | xgyro      |
 * | 12     | int16  | ygyro      |
 * | 14     | int16  | zgyro      |
 * | 16     | int16  | xmag       |
 * | 18     | int16  | ymag       |
 * | 20     | int16  | zmag       |
 */
export function decodeScaledImu(dv: DataView): ScaledImuMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    xacc: dv.getInt16(4, true),
    yacc: dv.getInt16(6, true),
    zacc: dv.getInt16(8, true),
    xgyro: dv.getInt16(10, true),
    ygyro: dv.getInt16(12, true),
    zgyro: dv.getInt16(14, true),
    xmag: dv.getInt16(16, true),
    ymag: dv.getInt16(18, true),
    zmag: dv.getInt16(20, true),
  };
}

// ── LOG_ENTRY (ID 118) ──────────────────────────────────────

export interface LogEntryMsg {
  id: number;
  numLogs: number;
  lastLogNum: number;
  timeUtc: number;
  size: number;
}

/**
 * Decode LOG_ENTRY (msg ID 118).
 *
 * Wire order (uint32 → uint16):
 * | Offset | Type   | Field      |
 * |--------|--------|------------|
 * | 0      | uint32 | timeUtc    |
 * | 4      | uint32 | size       |
 * | 8      | uint16 | id         |
 * | 10     | uint16 | numLogs    |
 * | 12     | uint16 | lastLogNum |
 */
export function decodeLogEntry(dv: DataView): LogEntryMsg {
  return {
    timeUtc: dv.getUint32(0, true),
    size: dv.getUint32(4, true),
    id: dv.getUint16(8, true),
    numLogs: dv.getUint16(10, true),
    lastLogNum: dv.getUint16(12, true),
  };
}

// ── LOG_DATA (ID 120) ───────────────────────────────────────

export interface LogDataMsg {
  ofs: number;
  id: number;
  count: number;
  data: Uint8Array;
}

/**
 * Decode LOG_DATA (msg ID 120).
 *
 * Wire order (uint32 → uint16 → uint8):
 * | Offset | Type      | Field |
 * |--------|-----------|-------|
 * | 0      | uint32    | ofs   |
 * | 4      | uint16    | id    |
 * | 6      | uint8     | count |
 * | 7      | uint8[90] | data  |
 */
export function decodeLogData(dv: DataView): LogDataMsg {
  const count = dv.getUint8(6);
  const data = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = dv.getUint8(7 + i);
  }
  return {
    ofs: dv.getUint32(0, true),
    id: dv.getUint16(4, true),
    count,
    data,
  };
}

// ── GPS2_RAW (ID 124) ──────────────────────────────────────

export interface Gps2RawMsg {
  timeUsec: number;
  lat: number;
  lon: number;
  alt: number;
  dgpsAge: number;
  eph: number;
  epv: number;
  vel: number;
  cog: number;
  fixType: number;
  satellitesVisible: number;
  dgpsNumch: number;
}

/**
 * Decode GPS2_RAW (msg ID 124).
 *
 * Wire order (uint64 → int32 → uint32 → uint16 → uint8):
 * | Offset | Type   | Field             |
 * |--------|--------|-------------------|
 * | 0      | uint64 | timeUsec          |
 * | 8      | int32  | lat (degE7)       |
 * | 12     | int32  | lon (degE7)       |
 * | 16     | int32  | alt (mm MSL)      |
 * | 20     | uint32 | dgpsAge           |
 * | 24     | uint16 | eph (cm)          |
 * | 26     | uint16 | epv (cm)          |
 * | 28     | uint16 | vel (cm/s)        |
 * | 30     | uint16 | cog (cdeg)        |
 * | 32     | uint8  | fixType           |
 * | 33     | uint8  | satellitesVisible |
 * | 34     | uint8  | dgpsNumch         |
 */
export function decodeGps2Raw(dv: DataView): Gps2RawMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    lat: dv.getInt32(8, true),
    lon: dv.getInt32(12, true),
    alt: dv.getInt32(16, true),
    dgpsAge: dv.getUint32(20, true),
    eph: dv.getUint16(24, true),
    epv: dv.getUint16(26, true),
    vel: dv.getUint16(28, true),
    cog: dv.getUint16(30, true),
    fixType: dv.getUint8(32),
    satellitesVisible: dv.getUint8(33),
    dgpsNumch: dv.getUint8(34),
  };
}

// ── SYSTEM_TIME (ID 2) ──────────────────────────────────────

export interface SystemTimeMsg {
  timeUnixUsec: number;
  timeBootMs: number;
}

/**
 * Decode SYSTEM_TIME (msg ID 2).
 *
 * | Offset | Type   | Field         |
 * |--------|--------|---------------|
 * | 0      | uint64 | timeUnixUsec  |
 * | 8      | uint32 | timeBootMs    |
 */
export function decodeSystemTime(dv: DataView): SystemTimeMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUnixUsec: high * 0x100000000 + low,
    timeBootMs: dv.getUint32(8, true),
  };
}

// ── LOCAL_POSITION_NED (ID 32) ──────────────────────────────

export interface LocalPositionNedMsg {
  timeBootMs: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Decode LOCAL_POSITION_NED (msg ID 32).
 *
 * | Offset | Type    | Field      |
 * |--------|---------|------------|
 * | 0      | uint32  | timeBootMs |
 * | 4      | float32 | x          |
 * | 8      | float32 | y          |
 * | 12     | float32 | z          |
 * | 16     | float32 | vx         |
 * | 20     | float32 | vy         |
 * | 24     | float32 | vz         |
 */
export function decodeLocalPositionNed(dv: DataView): LocalPositionNedMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    x: dv.getFloat32(4, true),
    y: dv.getFloat32(8, true),
    z: dv.getFloat32(12, true),
    vx: dv.getFloat32(16, true),
    vy: dv.getFloat32(20, true),
    vz: dv.getFloat32(24, true),
  };
}

// ── SET_ATTITUDE_TARGET (ID 82) ─────────────────────────────

export interface SetAttitudeTargetMsg {
  timeBootMs: number;
  q: [number, number, number, number];
  bodyRollRate: number;
  bodyPitchRate: number;
  bodyYawRate: number;
  thrust: number;
  targetSystem: number;
  targetComponent: number;
  typeMask: number;
}

/**
 * Decode SET_ATTITUDE_TARGET (msg ID 82).
 *
 * Wire order (uint32/float32 → uint8):
 * | Offset | Type       | Field          |
 * |--------|------------|----------------|
 * | 0      | uint32     | timeBootMs     |
 * | 4      | float32[4] | q              |
 * | 20     | float32    | bodyRollRate   |
 * | 24     | float32    | bodyPitchRate  |
 * | 28     | float32    | bodyYawRate    |
 * | 32     | float32    | thrust         |
 * | 36     | uint8      | targetSystem   |
 * | 37     | uint8      | targetComponent|
 * | 38     | uint8      | typeMask       |
 */
export function decodeSetAttitudeTarget(dv: DataView): SetAttitudeTargetMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    q: [
      dv.getFloat32(4, true),
      dv.getFloat32(8, true),
      dv.getFloat32(12, true),
      dv.getFloat32(16, true),
    ],
    bodyRollRate: dv.getFloat32(20, true),
    bodyPitchRate: dv.getFloat32(24, true),
    bodyYawRate: dv.getFloat32(28, true),
    thrust: dv.getFloat32(32, true),
    targetSystem: dv.getUint8(36),
    targetComponent: dv.getUint8(37),
    typeMask: dv.getUint8(38),
  };
}

// ── SET_POSITION_TARGET_GLOBAL_INT (ID 86) ──────────────────

export interface SetPositionTargetGlobalIntMsg {
  timeBootMs: number;
  latInt: number;
  lonInt: number;
  alt: number;
  vx: number;
  vy: number;
  vz: number;
  afx: number;
  afy: number;
  afz: number;
  yaw: number;
  yawRate: number;
  typeMask: number;
  targetSystem: number;
  targetComponent: number;
  coordinateFrame: number;
}

/**
 * Decode SET_POSITION_TARGET_GLOBAL_INT (msg ID 86).
 *
 * Wire order (uint32/int32/float32 → uint16 → uint8):
 * | Offset | Type    | Field           |
 * |--------|---------|-----------------|
 * | 0      | uint32  | timeBootMs      |
 * | 4      | int32   | latInt          |
 * | 8      | int32   | lonInt          |
 * | 12     | float32 | alt             |
 * | 16     | float32 | vx              |
 * | 20     | float32 | vy              |
 * | 24     | float32 | vz              |
 * | 28     | float32 | afx             |
 * | 32     | float32 | afy             |
 * | 36     | float32 | afz             |
 * | 40     | float32 | yaw             |
 * | 44     | float32 | yawRate         |
 * | 48     | uint16  | typeMask        |
 * | 50     | uint8   | targetSystem    |
 * | 51     | uint8   | targetComponent |
 * | 52     | uint8   | coordinateFrame |
 */
export function decodeSetPositionTargetGlobalInt(dv: DataView): SetPositionTargetGlobalIntMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    latInt: dv.getInt32(4, true),
    lonInt: dv.getInt32(8, true),
    alt: dv.getFloat32(12, true),
    vx: dv.getFloat32(16, true),
    vy: dv.getFloat32(20, true),
    vz: dv.getFloat32(24, true),
    afx: dv.getFloat32(28, true),
    afy: dv.getFloat32(32, true),
    afz: dv.getFloat32(36, true),
    yaw: dv.getFloat32(40, true),
    yawRate: dv.getFloat32(44, true),
    typeMask: dv.getUint16(48, true),
    targetSystem: dv.getUint8(50),
    targetComponent: dv.getUint8(51),
    coordinateFrame: dv.getUint8(52),
  };
}

// ── TIMESYNC (ID 111) ───────────────────────────────────────

export interface TimesyncMsg {
  tc1: number;
  ts1: number;
  targetSystem: number;
}

/**
 * Decode TIMESYNC (msg ID 111).
 *
 * | Offset | Type  | Field        |
 * |--------|-------|--------------|
 * | 0      | int64 | tc1          |
 * | 8      | int64 | ts1          |
 * | 16     | uint8 | targetSystem |
 */
export function decodeTimesync(dv: DataView): TimesyncMsg {
  const tc1Lo = dv.getUint32(0, true);
  const tc1Hi = dv.getInt32(4, true);
  const ts1Lo = dv.getUint32(8, true);
  const ts1Hi = dv.getInt32(12, true);
  return {
    tc1: tc1Hi * 0x100000000 + tc1Lo,
    ts1: ts1Hi * 0x100000000 + ts1Lo,
    targetSystem: dv.byteLength > 16 ? dv.getUint8(16) : 0,
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

// ── NAMED_VALUE_FLOAT (ID 251) ──────────────────────────────

export interface NamedValueFloatMsg {
  timeBootMs: number;
  value: number;
  name: string;
}

/**
 * Decode NAMED_VALUE_FLOAT (msg ID 251).
 *
 * Wire order (uint32/float32 → char[10]):
 * | Offset | Type      | Field      |
 * |--------|-----------|------------|
 * | 0      | uint32    | timeBootMs |
 * | 4      | float32   | value      |
 * | 8      | char[10]  | name       |
 */
export function decodeNamedValueFloat(dv: DataView): NamedValueFloatMsg {
  const nameBytes = new Uint8Array(dv.buffer, dv.byteOffset + 8, 10);
  let name = "";
  for (let i = 0; i < 10; i++) {
    if (nameBytes[i] === 0) break;
    name += String.fromCharCode(nameBytes[i]);
  }
  return {
    timeBootMs: dv.getUint32(0, true),
    value: dv.getFloat32(4, true),
    name,
  };
}

// ── NAMED_VALUE_INT (ID 252) ────────────────────────────────

export interface NamedValueIntMsg {
  timeBootMs: number;
  value: number;
  name: string;
}

/**
 * Decode NAMED_VALUE_INT (msg ID 252).
 *
 * Wire order (uint32/int32 → char[10]):
 * | Offset | Type     | Field      |
 * |--------|----------|------------|
 * | 0      | uint32   | timeBootMs |
 * | 4      | int32    | value      |
 * | 8      | char[10] | name       |
 */
export function decodeNamedValueInt(dv: DataView): NamedValueIntMsg {
  const nameBytes = new Uint8Array(dv.buffer, dv.byteOffset + 8, 10);
  let name = "";
  for (let i = 0; i < 10; i++) {
    if (nameBytes[i] === 0) break;
    name += String.fromCharCode(nameBytes[i]);
  }
  return {
    timeBootMs: dv.getUint32(0, true),
    value: dv.getInt32(4, true),
    name,
  };
}

// ── DEBUG (ID 254) ──────────────────────────────────────────

export interface DebugMsg {
  timeBootMs: number;
  value: number;
  ind: number;
}

/**
 * Decode DEBUG (msg ID 254).
 *
 * Wire order (uint32/float32 → uint8):
 * | Offset | Type    | Field      |
 * |--------|---------|------------|
 * | 0      | uint32  | timeBootMs |
 * | 4      | float32 | value      |
 * | 8      | uint8   | ind        |
 */
export function decodeDebug(dv: DataView): DebugMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    value: dv.getFloat32(4, true),
    ind: dv.getUint8(8),
  };
}

// ── CAMERA_IMAGE_CAPTURED (ID 263) ──────────────────────────

export interface CameraImageCapturedMsg {
  timeBootMs: number;
  timeUtcUs: number;
  lat: number;
  lon: number;
  alt: number;
  relativeAlt: number;
  q: [number, number, number, number];
  imageIndex: number;
  captureResult: number;
}

/**
 * Decode CAMERA_IMAGE_CAPTURED (msg ID 263).
 *
 * Wire order (uint64/uint32/int32/float32 → int32 → uint8):
 * | Offset | Type       | Field         |
 * |--------|------------|---------------|
 * | 0      | uint64     | timeUtcUs     |
 * | 8      | float32[4] | q             |
 * | 24     | int32      | lat (degE7)   |
 * | 28     | int32      | lon (degE7)   |
 * | 32     | int32      | alt (mm)      |
 * | 36     | int32      | relativeAlt   |
 * | 40     | uint32     | timeBootMs    |
 * | 44     | int32      | imageIndex    |
 * | 48     | uint8      | cameraId      |
 * | 49     | int8       | captureResult |
 * | 50     | char[205]  | fileUrl       |
 */
export function decodeCameraImageCaptured(dv: DataView): CameraImageCapturedMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUtcUs: high * 0x100000000 + low,
    q: [
      dv.getFloat32(8, true),
      dv.getFloat32(12, true),
      dv.getFloat32(16, true),
      dv.getFloat32(20, true),
    ],
    lat: dv.getInt32(24, true) / 1e7,
    lon: dv.getInt32(28, true) / 1e7,
    alt: dv.getInt32(32, true) / 1000,
    relativeAlt: dv.getInt32(36, true) / 1000,
    timeBootMs: dv.getUint32(40, true),
    imageIndex: dv.getInt32(44, true),
    captureResult: dv.getInt8(49),
  };
}

// ── GIMBAL_DEVICE_ATTITUDE_STATUS (ID 284) ──────────────────

export interface GimbalDeviceAttitudeStatusMsg {
  timeBootMs: number;
  flags: number;
  q: [number, number, number, number];
  angularVelocityX: number;
  angularVelocityY: number;
  angularVelocityZ: number;
  failureFlags: number;
  targetSystem: number;
  targetComponent: number;
}

/**
 * Decode GIMBAL_DEVICE_ATTITUDE_STATUS (msg ID 284).
 *
 * Wire order (uint32/float32 → uint16 → uint8):
 * | Offset | Type       | Field            |
 * |--------|------------|------------------|
 * | 0      | uint32     | timeBootMs       |
 * | 4      | float32[4] | q                |
 * | 20     | float32    | angularVelocityX |
 * | 24     | float32    | angularVelocityY |
 * | 28     | float32    | angularVelocityZ |
 * | 32     | uint32     | failureFlags     |
 * | 36     | uint16     | flags            |
 * | 38     | uint8      | targetSystem     |
 * | 39     | uint8      | targetComponent  |
 */
export function decodeGimbalDeviceAttitudeStatus(dv: DataView): GimbalDeviceAttitudeStatusMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    q: [
      dv.getFloat32(4, true),
      dv.getFloat32(8, true),
      dv.getFloat32(12, true),
      dv.getFloat32(16, true),
    ],
    angularVelocityX: dv.getFloat32(20, true),
    angularVelocityY: dv.getFloat32(24, true),
    angularVelocityZ: dv.getFloat32(28, true),
    failureFlags: dv.getUint32(32, true),
    flags: dv.getUint16(36, true),
    targetSystem: dv.getUint8(38),
    targetComponent: dv.getUint8(39),
  };
}

// ── OBSTACLE_DISTANCE (ID 330) ──────────────────────────────

export interface ObstacleDistanceMsg {
  timeUsec: number;
  distances: number[];
  minDistance: number;
  maxDistance: number;
  sensorType: number;
  increment: number;
}

/**
 * Decode OBSTACLE_DISTANCE (msg ID 330).
 *
 * Wire order (uint64 → uint16[72] → uint16 → uint8):
 * | Offset | Type       | Field        |
 * |--------|------------|--------------|
 * | 0      | uint64     | timeUsec     |
 * | 8      | uint16[72] | distances    |
 * | 152    | uint16     | minDistance   |
 * | 154    | uint16     | maxDistance   |
 * | 156    | uint8      | sensorType   |
 * | 157    | uint8      | increment    |
 */
export function decodeObstacleDistance(dv: DataView): ObstacleDistanceMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  const distances: number[] = [];
  for (let i = 0; i < 72; i++) {
    distances.push(dv.getUint16(8 + i * 2, true));
  }
  return {
    timeUsec: high * 0x100000000 + low,
    distances,
    minDistance: dv.getUint16(152, true),
    maxDistance: dv.getUint16(154, true),
    sensorType: dv.getUint8(156),
    increment: dv.getUint8(157),
  };
}

// ── FENCE_POINT (ID 160) ────────────────────────────────────

export interface FencePointMsg {
  lat: number;
  lon: number;
  targetSystem: number;
  targetComponent: number;
  idx: number;
  count: number;
}

/**
 * Decode FENCE_POINT (msg ID 160).
 *
 * Wire order (float32 → uint8):
 * | Offset | Type    | Field           |
 * |--------|---------|-----------------|
 * | 0      | float32 | lat             |
 * | 4      | float32 | lon             |
 * | 8      | uint8   | targetSystem    |
 * | 9      | uint8   | targetComponent |
 * | 10     | uint8   | idx             |
 * | 11     | uint8   | count           |
 */
export function decodeFencePoint(dv: DataView): FencePointMsg {
  return {
    lat: dv.getFloat32(0, true),
    lon: dv.getFloat32(4, true),
    targetSystem: dv.getUint8(8),
    targetComponent: dv.getUint8(9),
    idx: dv.getUint8(10),
    count: dv.getUint8(11),
  };
}

// ── FENCE_FETCH_POINT (ID 161) ──────────────────────────────

export interface FenceFetchPointMsg {
  targetSystem: number;
  targetComponent: number;
  idx: number;
}

/**
 * Decode FENCE_FETCH_POINT (msg ID 161).
 *
 * | Offset | Type  | Field           |
 * |--------|-------|-----------------|
 * | 0      | uint8 | targetSystem    |
 * | 1      | uint8 | targetComponent |
 * | 2      | uint8 | idx             |
 */
export function decodeFenceFetchPoint(dv: DataView): FenceFetchPointMsg {
  return {
    targetSystem: dv.getUint8(0),
    targetComponent: dv.getUint8(1),
    idx: dv.getUint8(2),
  };
}
