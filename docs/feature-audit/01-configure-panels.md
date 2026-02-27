# 01 — FC Configure Panels

> All flight controller configuration panels — existing and planned.

## Existing Panels (11)

### Outputs Panel
- [x] Servo function display per output channel — [Priority: HIGH]
- [x] Motor test with throttle slider (1000-2000 PWM) — [Priority: HIGH]
- [x] Servo min/max/trim configuration — [Priority: MED]
- [x] Reversed output toggle — [Priority: MED]
- [x] Safety timeout on motor test — [Priority: HIGH]
- [ ] Auto-load SERVO1-16_FUNCTION/MIN/MAX/TRIM/REVERSED params on mount — [Priority: HIGH]
- [ ] Motor ordering diagram per frame type — [Priority: MED]

### Receiver Panel
- [x] RC channel bar visualization — [Priority: HIGH]
- [x] Channel mapping (RC_MAP_*) — [Priority: HIGH]
- [x] Binding UI — [Priority: MED]
- [ ] Auto-load RC1-16_MIN/MAX/TRIM/REVERSED params on mount — [Priority: HIGH]
- [ ] Per-channel failsafe PWM configuration — [Priority: MED]
- [ ] RC protocol type selection — [Priority: LOW]

### Flight Modes Panel
- [x] RC channel to flight mode mapping (6 modes) — [Priority: HIGH]
- [x] Per-switch mode selection UI — [Priority: HIGH]
- [x] RcChannelHero visualization — [Priority: MED]
- [x] Mode description tooltips — [Priority: LOW]

### Failsafe Panel
- [x] Battery failsafe config (BATT_FS_*) — [Priority: HIGH]
- [x] GPS failsafe — [Priority: HIGH]
- [x] RC failsafe (short/long action) — [Priority: HIGH]
- [x] Throttle failsafe — [Priority: HIGH]
- [x] Flash commit button (DEC-046) — [Priority: HIGH]
- [ ] Auto-load FS_* params on mount — [Priority: HIGH]
- [ ] Per-channel RC failsafe (FS_CHn_OPTION/VALUE per channel 1-8) — [Priority: MED]
- [ ] GCS failsafe (FS_GCS_ENABLE) — [Priority: MED]
- [ ] Terrain failsafe — [Priority: LOW]

### Power Panel
- [x] Battery monitor type selection (BATT_MONITOR) — [Priority: HIGH]
- [x] Cell count / capacity config — [Priority: HIGH]
- [x] Voltage/current sensor calibration — [Priority: MED]
- [x] Flash commit button — [Priority: HIGH]
- [ ] Auto-load BATT_* params on mount — [Priority: HIGH]
- [ ] Dual battery support (BATT2_* params) — [Priority: MED]
- [ ] Per-battery failsafe thresholds — [Priority: MED]
- [ ] Combined voltage/current live display — [Priority: LOW]

### PID Tuning Panel
- [x] Roll/pitch/yaw P/I/D/FF editors — [Priority: HIGH]
- [x] Profile selector — [Priority: MED]
- [x] Graph visualization — [Priority: MED]
- [x] Copy/paste PIDs — [Priority: MED]
- [ ] Auto-load ATC_RAT_* params on mount — [Priority: HIGH]
- [ ] Real-time PID response graphs (desired vs actual) — [Priority: MED]
- [ ] Autotune trigger & monitor — [Priority: MED]
- [ ] Filter settings (INS_GYRO_FILTER, harmonic notch) — [Priority: MED]
- [ ] Preset profiles (Conservative/Default/Aggressive) — [Priority: LOW]
- [ ] Before/after comparison snapshot — [Priority: LOW]

### Ports Panel
- [x] UART/Serial port configuration — [Priority: HIGH]
- [x] Baud rate, protocol, function assignment — [Priority: HIGH]
- [ ] Serial port function descriptions — [Priority: LOW]

### CLI Panel
- [x] Serial CLI pass-through (SERIAL_CONTROL) — [Priority: MED]
- [x] Command input with history — [Priority: MED]

### MAVLink Inspector Panel
- [x] Raw MAVLink message viewer — [Priority: MED]
- [x] Filterable message table — [Priority: MED]
- [x] Auto-scroll toggle — [Priority: LOW]
- [ ] Message rate display per type — [Priority: LOW]
- [ ] Hex/binary payload view — [Priority: LOW]

### Firmware Panel
- [x] Firmware upload via WebSerial DFU — [Priority: HIGH]
- [x] Firmware downgrade support — [Priority: MED]
- [x] STM32 bootloader detection — [Priority: HIGH]
- [x] APJ manifest parsing — [Priority: MED]
- [x] Flash commit after restore — [Priority: HIGH]

### OSD Editor Panel
- [x] OSD element position configuration — [Priority: MED]
- [x] Font/units selection — [Priority: LOW]
- [ ] Drag-drop element placement on virtual screen grid — [Priority: MED]
- [ ] Live preview with current telemetry data — [Priority: MED]
- [ ] Multi-screen support (OSD1-4 tabs) — [Priority: LOW]
- [ ] Copy/paste between screens — [Priority: LOW]

## Planned New Panels (10)

### Geofence Panel — [Priority: HIGH]
- [ ] FENCE_* param config (ENABLE, TYPE, ALT_MAX, ALT_MIN, RADIUS, MARGIN, ACTION, TOTAL) — [Priority: HIGH]
- [ ] Circle fence: radius + center visualization — [Priority: HIGH]
- [ ] Polygon fence: download via FENCE_FETCH_POINT — [Priority: HIGH]
- [ ] Polygon fence: upload via FENCE_POINT — [Priority: HIGH]
- [ ] Altitude fence: min/max sliders — [Priority: MED]
- [ ] Breach action selector (RTL/Land/Report/Brake) — [Priority: HIGH]
- [ ] Map integration: render fence overlay — [Priority: MED]

### Frame Panel — [Priority: MED]
- [ ] Vehicle type picker (FRAME_CLASS param) — [Priority: MED]
- [ ] Visual motor ordering diagram (reuse motor-layouts.ts) — [Priority: MED]
- [ ] SVG motor numbering per frame type — [Priority: MED]
- [ ] Frame options: Quad-X, Hex-X, Hex-Y6, Octo-X, Tri, Heli, Plane, VTOL — [Priority: MED]
- [ ] Link to OutputsPanel motor test — [Priority: LOW]

### Pre-Arm / Health Check Panel — [Priority: HIGH]
- [ ] Visual 32-sensor status grid from SYS_STATUS bitmasks — [Priority: HIGH]
- [ ] Color-coded: green/yellow/red/gray — [Priority: HIGH]
- [ ] Pre-arm check trigger button — [Priority: HIGH]
- [ ] STATUSTEXT capture for "PreArm:" messages — [Priority: HIGH]
- [ ] Fix suggestions for common pre-arm failures — [Priority: MED]
- [ ] Auto-refresh every 2 seconds — [Priority: MED]

### Sensors Panel — [Priority: MED]
- [ ] Rangefinder config (RNGFND1_TYPE/PIN/MIN_CM/MAX_CM/ORIENT) — [Priority: MED]
- [ ] Live rangefinder distance from DISTANCE_SENSOR — [Priority: MED]
- [ ] Optical Flow config (FLOW_TYPE/FXSCALER/FYSCALER) — [Priority: MED]
- [ ] Airspeed config (ARSPD_TYPE/USE/OFFSET/RATIO) — [Priority: MED]
- [ ] Barometer config (GND_ABS_PRESS/TEMP) — [Priority: LOW]

### Gimbal Panel — [Priority: MED]
- [ ] Mount type selection (MNT1_TYPE) — [Priority: MED]
- [ ] 2-axis/3-axis config (PITCH/ROLL/YAW MIN/MAX) — [Priority: MED]
- [ ] RC control channel mapping — [Priority: MED]
- [ ] Stabilization mode dropdown — [Priority: MED]
- [ ] Live gimbal angle from GIMBAL_DEVICE_ATTITUDE_STATUS — [Priority: MED]
- [ ] Manual angle sliders — [Priority: LOW]
- [ ] ROI point picker on map — [Priority: LOW]

### Camera Panel — [Priority: MED]
- [ ] Camera type/trigger config (CAM1_TYPE/DURATION) — [Priority: MED]
- [ ] Distance-based trigger (CAM1_TRIGG_DIST) — [Priority: MED]
- [ ] Time-based trigger — [Priority: MED]
- [ ] Manual trigger button — [Priority: MED]
- [ ] Image count from CAMERA_IMAGE_CAPTURED — [Priority: LOW]
- [ ] Survey grid helper: overlap % to trigger distance — [Priority: LOW]

### LED Panel — [Priority: LOW]
- [ ] LED type/length/brightness config (NTF_LED_*) — [Priority: LOW]
- [ ] Pattern preview with CSS animation — [Priority: LOW]
- [ ] Color picker for custom patterns — [Priority: LOW]

### Telemetry Radio Panel — [Priority: MED]
- [ ] Radio type detection from RADIO_STATUS — [Priority: MED]
- [ ] AT command passthrough (3DR/RFD900X) — [Priority: MED]
- [ ] Serial protocol/baud config — [Priority: MED]
- [ ] Air/remote RSSI display — [Priority: MED]
- [ ] TX power, frequency settings — [Priority: LOW]

### Debug Panel — [Priority: LOW]
- [ ] NAMED_VALUE_FLOAT/INT + DEBUG message display — [Priority: LOW]
- [ ] Table view: name, value, last update — [Priority: LOW]
- [ ] Graph view: select up to 4 values, real-time chart — [Priority: LOW]
- [ ] Auto-discovery of new named values — [Priority: LOW]
- [ ] CSV export — [Priority: LOW]

### Sensor Graph Panel — [Priority: MED]
- [ ] Gyro/accel/mag waveforms from SCALED_IMU — [Priority: MED]
- [ ] Vibration levels from VIBRATION with threshold lines — [Priority: MED]
- [ ] EKF variances from EKF_STATUS_REPORT — [Priority: MED]
- [ ] Configurable time window (5s/15s/30s/60s) — [Priority: LOW]
- [ ] Freeze/resume — [Priority: LOW]

## Panel Sidebar Categories

```
--- Flight ---        Outputs, Receiver, Flight Modes, Frame
--- Safety ---        Failsafe, Geofence, Health Check
--- Sensors ---       Sensors, Power, Gimbal/Mount, Camera
--- Tuning ---        PID Tuning, Sensor Graphs
--- Display ---       OSD Editor, LED Strip
--- System ---        Ports, Radio Config, Firmware, CLI
--- Debug ---         MAVLink Inspector, Debug
```
