# 02 — Calibration Suite

> All sensor calibration features — existing and planned.

## Existing Calibration Features

### Accelerometer Calibration
- [x] 6-position accel cal wizard (MAV_CMD_PREFLIGHT_CALIBRATION param5=1) — [Priority: HIGH]
- [x] Position confirmation (COMMAND_ACK for each axis) — [Priority: HIGH]
- [x] Visual position guide (which side to place drone on) — [Priority: MED]

### Gyroscope Calibration
- [x] One-click gyro cal (PREFLIGHT_CALIBRATION param1=1) — [Priority: HIGH]
- [x] "Keep still" instructions — [Priority: MED]

### Compass Calibration
- [x] Multi-compass rotation wizard — [Priority: HIGH]
- [x] MAG_CAL_PROGRESS monitoring (completion %, mask visualization) — [Priority: HIGH]
- [x] MAG_CAL_REPORT parsing (fitness, offsets, scale) — [Priority: MED]
- [x] Accept/cancel compass cal commands — [Priority: HIGH]

### Level Calibration
- [x] One-click level cal (PREFLIGHT_CALIBRATION param2=1) — [Priority: MED]

### Airspeed Calibration
- [x] Airspeed sensor cal (PREFLIGHT_CALIBRATION param1=3) — [Priority: MED]

## Planned Calibration Features

### Radio Calibration Wizard — [Priority: HIGH]
- [ ] Live RC channel bars during calibration — [Priority: HIGH]
- [ ] Walk-through: center sticks → move to extremes → record min/max/trim — [Priority: HIGH]
- [ ] Write RC1-16_MIN/MAX/TRIM per channel — [Priority: HIGH]
- [ ] Trim reset option — [Priority: MED]
- [ ] Channel assignment/mapping during cal — [Priority: LOW]

### ESC Calibration — [Priority: HIGH]
- [ ] MAV_CMD_PREFLIGHT_CALIBRATION param5=4 — [Priority: HIGH]
- [ ] Step-by-step wizard with safety warnings — [Priority: HIGH]
- [ ] "Remove props" confirmation step — [Priority: HIGH]
- [ ] Progress monitoring via STATUSTEXT — [Priority: MED]

### Compass Motor Compensation — [Priority: MED]
- [ ] MAV_CMD_DO_START_MAG_CAL with motor compensation flag — [Priority: MED]
- [ ] Throttle-up wizard (gradually increase throttle) — [Priority: MED]
- [ ] Interference level display — [Priority: LOW]

### Barometer Calibration — [Priority: LOW]
- [ ] One-click via PREFLIGHT_CALIBRATION param3=1 — [Priority: LOW]
- [ ] Current pressure/altitude display — [Priority: LOW]

### GPS Calibration — [Priority: LOW]
- [ ] Antenna offset configuration — [Priority: LOW]
- [ ] Multi-GPS constellation selection — [Priority: LOW]

### Servo Calibration — [Priority: LOW]
- [ ] Individual servo endpoint calibration — [Priority: LOW]
- [ ] Servo travel range configuration — [Priority: LOW]

### Calibration History
- [ ] Log all calibration attempts with results — [Priority: LOW]
- [ ] Before/after comparison (offsets, fitness) — [Priority: LOW]
