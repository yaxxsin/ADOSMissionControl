/**
 * Telemetry MAVLink v2 message decoders: Attitude, GPS, GlobalPosition,
 * VfrHud, RcChannels, BatteryStatus, RadioStatus, LocalPositionNed,
 * ScaledImu, PowerStatus.
 *
 * @module protocol/messages/telemetry
 */

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

// ── SCALED_PRESSURE (ID 29) ──────────────────────────────────

export interface ScaledPressureMsg {
  timeBootMs: number;
  pressAbs: number;
  pressDiff: number;
  temperature: number;
}

/**
 * Decode SCALED_PRESSURE (msg ID 29).
 *
 * Wire order (uint32 → float32 → int16):
 * | Offset | Type    | Field        |
 * |--------|---------|--------------|
 * | 0      | uint32  | timeBootMs   |
 * | 4      | float32 | pressAbs     | (hPa)
 * | 8      | float32 | pressDiff    | (hPa)
 * | 12     | int16   | temperature  | (cdegC)
 */
export function decodeScaledPressure(dv: DataView): ScaledPressureMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    pressAbs: dv.getFloat32(4, true),
    pressDiff: dv.getFloat32(8, true),
    temperature: dv.getInt16(12, true),
  };
}

// ── ESTIMATOR_STATUS (ID 230) ─────────────────────────────────

export interface EstimatorStatusMsg {
  timeUsec: number;
  velRatio: number;
  posHorizRatio: number;
  posVertRatio: number;
  magRatio: number;
  haglRatio: number;
  tasRatio: number;
  posHorizAccuracy: number;
  posVertAccuracy: number;
  flags: number;
}

/**
 * Decode ESTIMATOR_STATUS (msg ID 230).
 *
 * Wire order (uint64 → float32 → uint16):
 * | Offset | Type    | Field             |
 * |--------|---------|-------------------|
 * | 0      | uint64  | timeUsec          |
 * | 8      | float32 | velRatio          |
 * | 12     | float32 | posHorizRatio     |
 * | 16     | float32 | posVertRatio      |
 * | 20     | float32 | magRatio          |
 * | 24     | float32 | haglRatio         |
 * | 28     | float32 | tasRatio          |
 * | 32     | float32 | posHorizAccuracy  |
 * | 36     | float32 | posVertAccuracy   |
 * | 40     | uint16  | flags             |
 */
export function decodeEstimatorStatus(dv: DataView): EstimatorStatusMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    velRatio: dv.getFloat32(8, true),
    posHorizRatio: dv.getFloat32(12, true),
    posVertRatio: dv.getFloat32(16, true),
    magRatio: dv.getFloat32(20, true),
    haglRatio: dv.getFloat32(24, true),
    tasRatio: dv.getFloat32(28, true),
    posHorizAccuracy: dv.getFloat32(32, true),
    posVertAccuracy: dv.getFloat32(36, true),
    flags: dv.getUint16(40, true),
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

// ── RAW_IMU (ID 27) ──────────────────────────────────────────

export interface RawImuMsg {
  timeUsec: number;
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
 * Decode RAW_IMU (msg ID 27).
 *
 * Wire order (uint64 → int16):
 * | Offset | Type   | Field      |
 * |--------|--------|------------|
 * | 0      | uint64 | timeUsec   |
 * | 8      | int16  | xacc       |
 * | 10     | int16  | yacc       |
 * | 12     | int16  | zacc       |
 * | 14     | int16  | xgyro      |
 * | 16     | int16  | ygyro      |
 * | 18     | int16  | zgyro      |
 * | 20     | int16  | xmag       |
 * | 22     | int16  | ymag       |
 * | 24     | int16  | zmag       |
 */
export function decodeRawImu(dv: DataView): RawImuMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    xacc: dv.getInt16(8, true),
    yacc: dv.getInt16(10, true),
    zacc: dv.getInt16(12, true),
    xgyro: dv.getInt16(14, true),
    ygyro: dv.getInt16(16, true),
    zgyro: dv.getInt16(18, true),
    xmag: dv.getInt16(20, true),
    ymag: dv.getInt16(22, true),
    zmag: dv.getInt16(24, true),
  };
}

// ── RC_CHANNELS_RAW (ID 35) ──────────────────────────────────

export interface RcChannelsRawMsg {
  timeBootMs: number;
  chan1Raw: number;
  chan2Raw: number;
  chan3Raw: number;
  chan4Raw: number;
  chan5Raw: number;
  chan6Raw: number;
  chan7Raw: number;
  chan8Raw: number;
  port: number;
  rssi: number;
}

/**
 * Decode RC_CHANNELS_RAW (msg ID 35).
 *
 * Wire order (uint32 → uint16 → uint8):
 * | Offset | Type   | Field      |
 * |--------|--------|------------|
 * | 0      | uint32 | timeBootMs |
 * | 4      | uint16 | chan1_raw  |
 * | 6      | uint16 | chan2_raw  |
 * | 8      | uint16 | chan3_raw  |
 * | 10     | uint16 | chan4_raw  |
 * | 12     | uint16 | chan5_raw  |
 * | 14     | uint16 | chan6_raw  |
 * | 16     | uint16 | chan7_raw  |
 * | 18     | uint16 | chan8_raw  |
 * | 20     | uint8  | port       |
 * | 21     | uint8  | rssi       |
 */
export function decodeRcChannelsRaw(dv: DataView): RcChannelsRawMsg {
  return {
    timeBootMs: dv.getUint32(0, true),
    chan1Raw: dv.getUint16(4, true),
    chan2Raw: dv.getUint16(6, true),
    chan3Raw: dv.getUint16(8, true),
    chan4Raw: dv.getUint16(10, true),
    chan5Raw: dv.getUint16(12, true),
    chan6Raw: dv.getUint16(14, true),
    chan7Raw: dv.getUint16(16, true),
    chan8Raw: dv.getUint16(18, true),
    port: dv.getUint8(20),
    rssi: dv.getUint8(21),
  };
}

// ── RC_CHANNELS_OVERRIDE (ID 70) — decoder ───────────────────

export interface RcChannelsOverrideMsg {
  chan1Raw: number;
  chan2Raw: number;
  chan3Raw: number;
  chan4Raw: number;
  chan5Raw: number;
  chan6Raw: number;
  chan7Raw: number;
  chan8Raw: number;
  targetSystem: number;
  targetComponent: number;
}

/**
 * Decode RC_CHANNELS_OVERRIDE (msg ID 70).
 *
 * Wire order (uint16 → uint8):
 * | Offset | Type   | Field           |
 * |--------|--------|-----------------|
 * | 0      | uint16 | chan1_raw       |
 * | 2      | uint16 | chan2_raw       |
 * | 4      | uint16 | chan3_raw       |
 * | 6      | uint16 | chan4_raw       |
 * | 8      | uint16 | chan5_raw       |
 * | 10     | uint16 | chan6_raw       |
 * | 12     | uint16 | chan7_raw       |
 * | 14     | uint16 | chan8_raw       |
 * | 16     | uint8  | targetSystem    |
 * | 17     | uint8  | targetComponent |
 */
export function decodeRcChannelsOverride(dv: DataView): RcChannelsOverrideMsg {
  return {
    chan1Raw: dv.getUint16(0, true),
    chan2Raw: dv.getUint16(2, true),
    chan3Raw: dv.getUint16(4, true),
    chan4Raw: dv.getUint16(6, true),
    chan5Raw: dv.getUint16(8, true),
    chan6Raw: dv.getUint16(10, true),
    chan7Raw: dv.getUint16(12, true),
    chan8Raw: dv.getUint16(14, true),
    targetSystem: dv.getUint8(16),
    targetComponent: dv.getUint8(17),
  };
}

// ── ALTITUDE (ID 141) ────────────────────────────────────────

export interface AltitudeMsg {
  timeUsec: number;
  altitudeMonotonic: number;
  altitudeAmsl: number;
  altitudeLocal: number;
  altitudeRelative: number;
  altitudeTerrain: number;
  bottomClearance: number;
}

/**
 * Decode ALTITUDE (msg ID 141).
 *
 * Wire order (uint64 → float32):
 * | Offset | Type    | Field             |
 * |--------|---------|-------------------|
 * | 0      | uint64  | timeUsec          |
 * | 8      | float32 | altitudeMonotonic |
 * | 12     | float32 | altitudeAmsl      |
 * | 16     | float32 | altitudeLocal     |
 * | 20     | float32 | altitudeRelative  |
 * | 24     | float32 | altitudeTerrain   |
 * | 28     | float32 | bottomClearance   |
 */
export function decodeAltitude(dv: DataView): AltitudeMsg {
  const low = dv.getUint32(0, true);
  const high = dv.getUint32(4, true);
  return {
    timeUsec: high * 0x100000000 + low,
    altitudeMonotonic: dv.getFloat32(8, true),
    altitudeAmsl: dv.getFloat32(12, true),
    altitudeLocal: dv.getFloat32(16, true),
    altitudeRelative: dv.getFloat32(20, true),
    altitudeTerrain: dv.getFloat32(24, true),
    bottomClearance: dv.getFloat32(28, true),
  };
}
