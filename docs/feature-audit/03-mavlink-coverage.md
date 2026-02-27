# 03 — MAVLink Message & Command Coverage

> Decoder and command support checklist against the MAVLink common/ardupilot message sets.

## Message Decoders — Currently Implemented (36/231)

### Core Telemetry
- [x] 0: HEARTBEAT — Mode, armed state, system status — [Priority: HIGH]
- [x] 1: SYS_STATUS — CPU load, sensor bitmasks, battery — [Priority: HIGH]
- [x] 24: GPS_RAW_INT — GPS fix, satellites, HDOP, position — [Priority: HIGH]
- [x] 30: ATTITUDE — Roll, pitch, yaw, rates — [Priority: HIGH]
- [x] 33: GLOBAL_POSITION_INT — Lat, lon, alt, heading, speeds — [Priority: HIGH]
- [x] 74: VFR_HUD — Airspeed, groundspeed, heading, throttle — [Priority: HIGH]
- [x] 65: RC_CHANNELS — 18 RC channels + RSSI — [Priority: HIGH]
- [x] 147: BATTERY_STATUS — Cell voltages, current, remaining — [Priority: HIGH]

### Parameters
- [x] 22: PARAM_VALUE — Parameter name/value/type/index/count — [Priority: HIGH]

### Mission
- [x] 42: MISSION_CURRENT — Current waypoint sequence — [Priority: HIGH]
- [x] 44: MISSION_COUNT — Mission item count — [Priority: HIGH]
- [x] 46: MISSION_ITEM_REACHED — Waypoint reached notification — [Priority: HIGH]
- [x] 47: MISSION_ACK — Mission upload result — [Priority: HIGH]
- [x] 51: MISSION_REQUEST_INT — FC requesting mission item — [Priority: HIGH]
- [x] 73: MISSION_ITEM_INT — Mission item data — [Priority: HIGH]

### Commands
- [x] 76: COMMAND_LONG — Outbound command frame — [Priority: HIGH]
- [x] 77: COMMAND_ACK — Command acknowledgement — [Priority: HIGH]

### Status
- [x] 253: STATUSTEXT — Text messages from FC — [Priority: HIGH]
- [x] 109: RADIO_STATUS — Radio link quality — [Priority: HIGH]
- [x] 125: POWER_STATUS — Board voltage/servo voltage — [Priority: MED]
- [x] 162: FENCE_STATUS — Geofence breach status — [Priority: MED]
- [x] 62: NAV_CONTROLLER_OUTPUT — Navigation bearing, wp distance — [Priority: MED]

### Sensors
- [x] 26: SCALED_IMU — Accel/gyro/mag raw values — [Priority: MED]
- [x] 124: GPS2_RAW — Secondary GPS — [Priority: MED]
- [x] 132: DISTANCE_SENSOR — Rangefinder distance — [Priority: MED]
- [x] 241: VIBRATION — Vibration levels + clipping — [Priority: MED]
- [x] 335: EKF_STATUS_REPORT — EKF variances — [Priority: MED]

### Calibration
- [x] 191: MAG_CAL_PROGRESS — Compass cal progress — [Priority: MED]
- [x] 192: MAG_CAL_REPORT — Compass cal results — [Priority: MED]

### Navigation
- [x] 242: HOME_POSITION — Home lat/lon/alt — [Priority: HIGH]
- [x] 136: TERRAIN_REPORT — Terrain height data — [Priority: LOW]
- [x] 168: WIND — Wind direction/speed — [Priority: LOW]

### System
- [x] 148: AUTOPILOT_VERSION — Firmware version, capabilities — [Priority: MED]
- [x] 36: SERVO_OUTPUT_RAW — Servo/motor output PWM values — [Priority: MED]
- [x] 126: SERIAL_CONTROL — Serial passthrough data — [Priority: MED]

### Logs
- [x] 118: LOG_ENTRY — On-board log metadata — [Priority: MED]
- [x] 120: LOG_DATA — Log data chunk — [Priority: MED]

## Message Decoders — Planned (15)

- [ ] 2: SYSTEM_TIME — GPS time sync — [Priority: MED]
- [ ] 32: LOCAL_POSITION_NED — Local frame position — [Priority: MED]
- [ ] 82: SET_ATTITUDE_TARGET — Guided attitude feedback — [Priority: LOW]
- [ ] 86: SET_POSITION_TARGET_GLOBAL_INT — Guided position feedback — [Priority: LOW]
- [ ] 105: CAMERA_TRIGGER — Camera trigger event — [Priority: MED]
- [ ] 111: TIMESYNC — Clock synchronization — [Priority: LOW]
- [ ] 160: FENCE_POINT — Geofence vertex — [Priority: HIGH]
- [ ] 161: FENCE_FETCH_POINT — Request geofence vertex — [Priority: HIGH]
- [ ] 245: EXTENDED_SYS_STATE — VTOL state, landed state — [Priority: MED]
- [ ] 251: NAMED_VALUE_FLOAT — Debug float values — [Priority: LOW]
- [ ] 252: NAMED_VALUE_INT — Debug integer values — [Priority: LOW]
- [ ] 254: DEBUG — Generic debug values — [Priority: LOW]
- [ ] 263: CAMERA_IMAGE_CAPTURED — Image capture confirmation — [Priority: MED]
- [ ] 284: GIMBAL_DEVICE_ATTITUDE_STATUS — Gimbal orientation — [Priority: MED]
- [ ] 330: OBSTACLE_DISTANCE — Obstacle avoidance data — [Priority: MED]

## Message Decoders — Future (remaining ~180)

Key messages not yet planned but useful:
- [ ] 27: RAW_IMU — Raw IMU data — [Priority: LOW]
- [ ] 29: SCALED_PRESSURE — Pressure/temperature — [Priority: LOW]
- [ ] 35: RC_CHANNELS_RAW — Raw RC channel values — [Priority: LOW]
- [ ] 39: MISSION_ITEM — Legacy mission item format — [Priority: LOW]
- [ ] 70: RC_CHANNELS_OVERRIDE — RC override values — [Priority: MED]
- [ ] 111: TIMESYNC — Time sync protocol — [Priority: LOW]
- [ ] 141: ALTITUDE — Multiple altitude references — [Priority: LOW]
- [ ] 230: ESTIMATOR_STATUS — Estimator flags — [Priority: LOW]
- [ ] 231: WIND_COV — Wind covariance — [Priority: LOW]
- [ ] 246: AIS_VESSEL — AIS vessel tracking — [Priority: LOW]
- [ ] 285: GIMBAL_MANAGER_INFORMATION — Gimbal manager caps — [Priority: LOW]
- [ ] 286: GIMBAL_MANAGER_STATUS — Gimbal manager state — [Priority: LOW]

## MAV_CMD Support — Currently Implemented (33/166)

### Arm/Disarm
- [x] 400: MAV_CMD_COMPONENT_ARM_DISARM — Arm/disarm motors — [Priority: HIGH]

### Navigation
- [x] 16: MAV_CMD_NAV_WAYPOINT — Navigate to waypoint — [Priority: HIGH]
- [x] 17: MAV_CMD_NAV_LOITER_UNLIM — Loiter unlimited — [Priority: HIGH]
- [x] 18: MAV_CMD_NAV_LOITER_TURNS — Loiter turns — [Priority: MED]
- [x] 19: MAV_CMD_NAV_LOITER_TIME — Loiter time — [Priority: MED]
- [x] 20: MAV_CMD_NAV_RETURN_TO_LAUNCH — RTL — [Priority: HIGH]
- [x] 21: MAV_CMD_NAV_LAND — Land — [Priority: HIGH]
- [x] 22: MAV_CMD_NAV_TAKEOFF — Takeoff — [Priority: HIGH]

### Conditions & Do Commands
- [x] 93: MAV_CMD_NAV_DELAY — Mission delay — [Priority: MED]
- [x] 94: MAV_CMD_NAV_LAST — Last mission item marker — [Priority: LOW]
- [x] 176: MAV_CMD_DO_SET_MODE — Set flight mode — [Priority: HIGH]
- [x] 177: MAV_CMD_DO_JUMP — Jump to mission item — [Priority: MED]
- [x] 178: MAV_CMD_DO_CHANGE_SPEED — Change speed — [Priority: MED]
- [x] 179: MAV_CMD_DO_SET_HOME — Set home position — [Priority: HIGH]
- [x] 183: MAV_CMD_DO_SET_SERVO — Set servo PWM — [Priority: MED]
- [x] 184: MAV_CMD_DO_REPEAT_SERVO — Repeat servo — [Priority: LOW]
- [x] 201: MAV_CMD_DO_SET_ROI — Set region of interest — [Priority: MED]
- [x] 203: MAV_CMD_DO_DIGICAM_CONTROL — Camera control — [Priority: MED]
- [x] 205: MAV_CMD_DO_MOUNT_CONTROL — Gimbal angle control — [Priority: MED]
- [x] 206: MAV_CMD_DO_SET_CAM_TRIGG_DIST — Camera trigger distance — [Priority: MED]
- [x] 115: MAV_CMD_CONDITION_YAW — Condition yaw to angle — [Priority: MED]

### System
- [x] 241: MAV_CMD_PREFLIGHT_CALIBRATION — Start calibration — [Priority: HIGH]
- [x] 245: MAV_CMD_PREFLIGHT_STORAGE — Commit params to flash — [Priority: HIGH]
- [x] 246: MAV_CMD_OVERRIDE_GOTO — Pause/resume mission — [Priority: MED]
- [x] 252: MAV_CMD_PREFLIGHT_REBOOT_SHUTDOWN — Reboot FC — [Priority: HIGH]
- [x] 310: MAV_CMD_DO_MOTOR_TEST — Motor test — [Priority: HIGH]
- [x] 511: MAV_CMD_SET_MESSAGE_INTERVAL — Set telemetry rate — [Priority: MED]
- [x] 512: MAV_CMD_REQUEST_MESSAGE — Request single message — [Priority: MED]
- [x] 519: MAV_CMD_REQUEST_AUTOPILOT_CAPABILITIES — Request version info — [Priority: MED]

### Mission
- [x] 44: MISSION_COUNT — Mission item count (wire) — [Priority: HIGH]
- [x] 45: MISSION_CLEAR_ALL — Clear mission — [Priority: HIGH]

### Calibration-Specific
- [x] 42425: MAV_CMD_DO_ACCEPT_MAG_CAL — Accept compass cal — [Priority: MED]
- [x] 42426: MAV_CMD_DO_CANCEL_MAG_CAL — Cancel compass cal — [Priority: MED]

## MAV_CMD Support — Planned (10)

- [ ] 84: MAV_CMD_NAV_VTOL_TAKEOFF — VTOL takeoff — [Priority: MED]
- [ ] 85: MAV_CMD_NAV_VTOL_LAND — VTOL land — [Priority: MED]
- [ ] 160: MAV_CMD_DO_FENCE_ENABLE — Enable/disable geofence — [Priority: HIGH]
- [ ] 2003: MAV_CMD_DO_FENCE_CIRCLE — Geofence circle — [Priority: MED]
- [ ] 189: MAV_CMD_DO_LAND_START — Do land start — [Priority: LOW]
- [ ] 200: MAV_CMD_DO_CONTROL_VIDEO — Video control — [Priority: LOW]
- [ ] 204: MAV_CMD_DO_MOUNT_CONFIGURE — Mount config — [Priority: MED]
- [ ] 186: MAV_CMD_DO_SET_RELAY — Set relay — [Priority: LOW]
- [ ] 243: MAV_CMD_START_RX_PAIR — RC bind — [Priority: LOW]
- [ ] 42429: MAV_CMD_ACCELCAL_VEHICLE_POS — Accel cal position confirm — [Priority: MED]
