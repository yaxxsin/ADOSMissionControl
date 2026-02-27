# 07 — Visual Indicators

> Connection quality, telemetry freshness, sensor health, and status displays.

## Connection Quality

### Existing
- [x] Connection state badge (disconnected/connecting/connected/armed) — [Priority: HIGH]
- [x] RSSI display in radio telemetry — [Priority: MED]

### Planned
- [ ] ConnectionQualityMeter component — Signal bars + latency badge — [Priority: HIGH]
- [ ] Signal strength percentage (0-100%) — [Priority: MED]
- [ ] Latency estimate in ms — [Priority: MED]
- [ ] Packet loss percentage — [Priority: MED]
- [ ] Color-coded: green (excellent) / yellow (fair) / red (poor) — [Priority: MED]
- [ ] Placement in DroneDetailPanel header — [Priority: MED]

## Telemetry Freshness

### Existing
- [x] SensorHealthBar component (Gyro/Accel/Compass/Baro/GPS/Motors/RC/AHRS dots) — [Priority: MED]

### Planned
- [ ] TelemetryFreshnessIndicator — Per-channel freshness dots — [Priority: HIGH]
- [ ] Fresh (<2s): green dot — [Priority: HIGH]
- [ ] Stale (2-5s): yellow dot — [Priority: HIGH]
- [ ] Lost (>5s): red dot — [Priority: HIGH]
- [ ] None (never received): gray dot — [Priority: MED]
- [ ] Channels: attitude, position, battery, GPS, RC, radio, sysStatus — [Priority: HIGH]
- [ ] Placement in Overview tab sidebar or header — [Priority: MED]

## Sensor Health Grid

### Existing
- [x] SensorHealthBar — 8 sensor dots (simplified) — [Priority: MED]

### Planned — Full 32-Sensor Grid
- [ ] SensorHealthGrid component — 32-sensor icon grid from sensor-health-store — [Priority: HIGH]
- [ ] Decode MAV_SYS_STATUS_SENSOR bitmask (present/enabled/healthy) — [Priority: HIGH]
- [ ] Status colors: green (healthy), yellow (present+unhealthy), red (enabled+unhealthy), gray (not present) — [Priority: HIGH]
- [ ] Sensor labels: Gyro, Accel, Mag, Baro, GPS, OptFlow, Vision, Laser, Rate Control, etc. — [Priority: MED]
- [ ] Click to expand sensor details — [Priority: LOW]
- [ ] Placement in PreArmPanel and Overview sidebar — [Priority: MED]

## EKF Status

- [ ] EkfStatusBars component — Variance horizontal bars — [Priority: MED]
- [ ] Bars for: velocity, posHoriz, posVert, compass, terrainAlt — [Priority: MED]
- [ ] Color thresholds: green (<0.5), yellow (0.5-0.8), red (>0.8) — [Priority: MED]
- [ ] EKF flags decode — [Priority: LOW]
- [ ] Placement in Overview sidebar or Health Check panel — [Priority: MED]

## Vibration Monitoring

- [ ] VibrationGauges component — XYZ gauges with threshold lines — [Priority: MED]
- [ ] Threshold lines: 30 m/s/s (warning), 60 m/s/s (critical) — [Priority: MED]
- [ ] Clipping counter display — [Priority: LOW]
- [ ] Historical vibration trend — [Priority: LOW]
- [ ] Placement in Sensor Graphs panel — [Priority: MED]

## GPS Status

- [ ] GpsSkyView component — Satellite count, fix type, HDOP — [Priority: MED]
- [ ] Fix type display: No Fix, 2D, 3D, DGPS, RTK Float, RTK Fixed — [Priority: HIGH]
- [ ] Satellite count with quality indicator — [Priority: MED]
- [ ] HDOP value with color coding (good <1.5, ok <3.0, poor >3.0) — [Priority: MED]
- [ ] Dual GPS indicator when GPS2_RAW present — [Priority: LOW]

## Battery Indicators

### Existing
- [x] Battery bar (voltage, percentage, color) — [Priority: HIGH]
- [x] Battery telemetry in overview — [Priority: HIGH]

### Planned
- [ ] Per-cell voltage display — [Priority: MED]
- [ ] Cell voltage imbalance warning — [Priority: MED]
- [ ] Battery temperature display — [Priority: LOW]
- [ ] Estimated flight time remaining — [Priority: MED]

## Flight Mode Indicator

### Existing
- [x] Flight mode display in TelemetryReadout — [Priority: HIGH]
- [x] FlightModeSelector dropdown — [Priority: HIGH]

### Planned
- [ ] Mode change animation/highlight — [Priority: LOW]
- [ ] Mode description tooltip on hover — [Priority: LOW]

## Pre-Arm Status

- [ ] PreArmChecks component — Checklist with fix suggestions — [Priority: HIGH]
- [ ] Green checkmark for passed checks — [Priority: HIGH]
- [ ] Red X with failure message + suggested fix — [Priority: HIGH]
- [ ] "PreArm:" STATUSTEXT message parsing — [Priority: HIGH]
- [ ] Common fix database (e.g., "Compass not calibrated" → "Go to Calibration > Compass") — [Priority: MED]

## Reboot Required

- [ ] RebootRequiredBanner — Amber banner for reboot-needing params — [Priority: MED]
- [ ] Tracks param changes that need reboot from metadata — [Priority: MED]
- [ ] "Reboot Now" action button — [Priority: MED]
- [ ] Auto-dismiss after successful reboot — [Priority: MED]
