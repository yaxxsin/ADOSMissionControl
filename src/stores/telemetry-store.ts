import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";
import type { AttitudeData, PositionData, BatteryData, GpsData, VfrData, RcData, SysStatusData, RadioData, EkfData, VibrationData, ServoOutputData, WindData, TerrainData, LocalPositionData, DebugData, GimbalData, ObstacleData } from "@/lib/types";

interface TelemetryStoreState {
  attitude: RingBuffer<AttitudeData>;
  position: RingBuffer<PositionData>;
  battery: RingBuffer<BatteryData>;
  gps: RingBuffer<GpsData>;
  vfr: RingBuffer<VfrData>;
  rc: RingBuffer<RcData>;
  sysStatus: RingBuffer<SysStatusData>;
  radio: RingBuffer<RadioData>;
  ekf: RingBuffer<EkfData>;
  vibration: RingBuffer<VibrationData>;
  servoOutput: RingBuffer<ServoOutputData>;
  wind: RingBuffer<WindData>;
  terrain: RingBuffer<TerrainData>;
  localPosition: RingBuffer<LocalPositionData>;
  debug: RingBuffer<DebugData>;
  gimbal: RingBuffer<GimbalData>;
  obstacle: RingBuffer<ObstacleData>;

  pushAttitude: (data: AttitudeData) => void;
  pushPosition: (data: PositionData) => void;
  pushBattery: (data: BatteryData) => void;
  pushGps: (data: GpsData) => void;
  pushVfr: (data: VfrData) => void;
  pushRc: (data: RcData) => void;
  pushSysStatus: (data: SysStatusData) => void;
  pushRadio: (data: RadioData) => void;
  pushEkf: (data: EkfData) => void;
  pushVibration: (data: VibrationData) => void;
  pushServoOutput: (data: ServoOutputData) => void;
  pushWind: (data: WindData) => void;
  pushTerrain: (data: TerrainData) => void;
  pushLocalPosition: (data: LocalPositionData) => void;
  pushDebug: (data: DebugData) => void;
  pushGimbal: (data: GimbalData) => void;
  pushObstacle: (data: ObstacleData) => void;
  pushBatch: (batch: Partial<{
    attitude: AttitudeData;
    position: PositionData;
    battery: BatteryData;
    gps: GpsData;
    vfr: VfrData;
    rc: RcData;
    sysStatus: SysStatusData;
    radio: RadioData;
    ekf: EkfData;
    vibration: VibrationData;
    servoOutput: ServoOutputData;
    wind: WindData;
    terrain: TerrainData;
    localPosition: LocalPositionData;
    debug: DebugData;
    gimbal: GimbalData;
    obstacle: ObstacleData;
  }>) => void;
  clear: () => void;
}

export const useTelemetryStore = create<TelemetryStoreState>((set, get) => ({
  attitude: new RingBuffer<AttitudeData>(600),   // 10Hz x 60s
  position: new RingBuffer<PositionData>(300),   // 5Hz x 60s
  battery: new RingBuffer<BatteryData>(120),     // 2Hz x 60s
  gps: new RingBuffer<GpsData>(300),             // 5Hz x 60s
  vfr: new RingBuffer<VfrData>(600),             // 10Hz x 60s
  rc: new RingBuffer<RcData>(600),               // 10Hz x 60s
  sysStatus: new RingBuffer<SysStatusData>(60),  // 1Hz x 60s
  radio: new RingBuffer<RadioData>(120),         // 2Hz x 60s
  ekf: new RingBuffer<EkfData>(60),
  vibration: new RingBuffer<VibrationData>(120),
  servoOutput: new RingBuffer<ServoOutputData>(300),
  wind: new RingBuffer<WindData>(60),
  terrain: new RingBuffer<TerrainData>(60),
  localPosition: new RingBuffer<LocalPositionData>(300),  // 5Hz x 60s
  debug: new RingBuffer<DebugData>(300),                  // variable
  gimbal: new RingBuffer<GimbalData>(60),                 // 1Hz x 60s
  obstacle: new RingBuffer<ObstacleData>(30),             // 0.5Hz x 60s

  pushAttitude: (data) => {
    get().attitude.push(data);
    set({});  // trigger re-render
  },
  pushPosition: (data) => {
    get().position.push(data);
    set({});
  },
  pushBattery: (data) => {
    get().battery.push(data);
    set({});
  },
  pushGps: (data) => {
    get().gps.push(data);
    set({});
  },
  pushVfr: (data) => {
    get().vfr.push(data);
    set({});
  },
  pushRc: (data) => {
    get().rc.push(data);
    set({});
  },
  pushSysStatus: (data) => {
    get().sysStatus.push(data);
    set({});
  },
  pushRadio: (data) => {
    get().radio.push(data);
    set({});
  },
  pushEkf: (data) => { get().ekf.push(data); set({}); },
  pushVibration: (data) => { get().vibration.push(data); set({}); },
  pushServoOutput: (data) => { get().servoOutput.push(data); set({}); },
  pushWind: (data) => { get().wind.push(data); set({}); },
  pushTerrain: (data) => { get().terrain.push(data); set({}); },
  pushLocalPosition: (data) => { get().localPosition.push(data); set({}); },
  pushDebug: (data) => { get().debug.push(data); set({}); },
  pushGimbal: (data) => { get().gimbal.push(data); set({}); },
  pushObstacle: (data) => { get().obstacle.push(data); set({}); },
  pushBatch: (batch) => {
    const s = get();
    if (batch.attitude) s.attitude.push(batch.attitude);
    if (batch.position) s.position.push(batch.position);
    if (batch.battery) s.battery.push(batch.battery);
    if (batch.gps) s.gps.push(batch.gps);
    if (batch.vfr) s.vfr.push(batch.vfr);
    if (batch.rc) s.rc.push(batch.rc);
    if (batch.sysStatus) s.sysStatus.push(batch.sysStatus);
    if (batch.radio) s.radio.push(batch.radio);
    if (batch.ekf) s.ekf.push(batch.ekf);
    if (batch.vibration) s.vibration.push(batch.vibration);
    if (batch.servoOutput) s.servoOutput.push(batch.servoOutput);
    if (batch.wind) s.wind.push(batch.wind);
    if (batch.terrain) s.terrain.push(batch.terrain);
    if (batch.localPosition) s.localPosition.push(batch.localPosition);
    if (batch.debug) s.debug.push(batch.debug);
    if (batch.gimbal) s.gimbal.push(batch.gimbal);
    if (batch.obstacle) s.obstacle.push(batch.obstacle);
    set({});
  },
  clear: () =>
    set({
      attitude: new RingBuffer<AttitudeData>(600),
      position: new RingBuffer<PositionData>(300),
      battery: new RingBuffer<BatteryData>(120),
      gps: new RingBuffer<GpsData>(300),
      vfr: new RingBuffer<VfrData>(600),
      rc: new RingBuffer<RcData>(600),
      sysStatus: new RingBuffer<SysStatusData>(60),
      radio: new RingBuffer<RadioData>(120),
      ekf: new RingBuffer<EkfData>(60),
      vibration: new RingBuffer<VibrationData>(120),
      servoOutput: new RingBuffer<ServoOutputData>(300),
      wind: new RingBuffer<WindData>(60),
      terrain: new RingBuffer<TerrainData>(60),
      localPosition: new RingBuffer<LocalPositionData>(300),
      debug: new RingBuffer<DebugData>(300),
      gimbal: new RingBuffer<GimbalData>(60),
      obstacle: new RingBuffer<ObstacleData>(30),
    }),
}));
