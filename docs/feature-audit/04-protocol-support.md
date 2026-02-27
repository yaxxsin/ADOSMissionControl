# 04 — Multi-Protocol Firmware Support

> Firmware detection, handler implementations, and per-firmware feature gating.

## Firmware Detection

### MAVLink-Based Detection
- [x] Detect ArduPilot from HEARTBEAT autopilot field (MAV_AUTOPILOT_ARDUPILOTMEGA=3) — [Priority: HIGH]
- [ ] Detect PX4 from HEARTBEAT autopilot field (MAV_AUTOPILOT_PX4=12) — [Priority: HIGH]
- [ ] Auto-detect vehicle class from MAV_TYPE (copter/plane/rover/sub/vtol) — [Priority: HIGH]
- [ ] ProtocolDetector: probe MAVLink (3s timeout), then MSP (2s), for WebSerial — [Priority: MED]

### Firmware Handlers

#### ArduPilot (Implemented)
- [x] ArduCopterHandler — Mode encoding/decoding, capabilities — [Priority: HIGH]
- [x] ArduPlaneHandler — Plane-specific modes — [Priority: HIGH]
- [x] ArduRoverHandler — Rover-specific modes — [Priority: MED]
- [x] ArduSubHandler — Sub-specific modes — [Priority: LOW]
- [x] Flight mode encode/decode (customMode mapping) — [Priority: HIGH]
- [x] Available modes list per vehicle class — [Priority: HIGH]
- [x] Firmware version extraction — [Priority: MED]
- [ ] Parameter name mapping (canonical → ArduPilot) — [Priority: MED]

#### PX4 (Planned)
- [ ] PX4Handler class — [Priority: HIGH]
- [ ] PX4 mode encoding (main_mode<<16 | sub_mode) — [Priority: HIGH]
- [ ] PX4 mode decoding (custom_mode to UnifiedFlightMode) — [Priority: HIGH]
- [ ] PX4 available modes list — [Priority: HIGH]
- [ ] PX4 parameter name mapping (e.g., MC_ROLLRATE_P) — [Priority: MED]
- [ ] PX4 capabilities (no OSD, no CLI, different ports config) — [Priority: MED]
- [ ] PX4 UORB topics awareness — [Priority: LOW]

#### Betaflight (Planned — Stub)
- [ ] BetaflightHandler stub class — [Priority: MED]
- [ ] Betaflight capabilities (OSD:true, PID:true, Inspector:false) — [Priority: MED]
- [ ] Betaflight mode definitions — [Priority: MED]
- [ ] MSP protocol adapter (future) — [Priority: LOW]

#### iNav (Planned — Stub)
- [ ] INavHandler stub class — [Priority: MED]
- [ ] iNav capabilities (extends BF + missionUpload:true) — [Priority: MED]
- [ ] iNav mode definitions — [Priority: MED]
- [ ] MSP-DJI protocol awareness (future) — [Priority: LOW]

## Reactive UI Panel Filtering

### Capability-Based Panel Visibility
- [ ] Each FC nav item gets `requiredCapability` field — [Priority: HIGH]
- [ ] Sidebar filters items based on detected firmware capabilities — [Priority: HIGH]
- [ ] Auto-select first visible panel if current is hidden — [Priority: MED]
- [ ] Graceful degradation: show "Not supported by [firmware]" placeholder — [Priority: MED]

### Panel Categorization with Section Headers
- [ ] Flight section: Outputs, Receiver, Flight Modes, Frame — [Priority: MED]
- [ ] Safety section: Failsafe, Geofence, Health Check — [Priority: MED]
- [ ] Sensors section: Sensors, Power, Gimbal, Camera — [Priority: MED]
- [ ] Tuning section: PID Tuning, Sensor Graphs — [Priority: MED]
- [ ] Display section: OSD Editor, LED Strip — [Priority: MED]
- [ ] System section: Ports, Radio Config, Firmware, CLI — [Priority: MED]
- [ ] Debug section: MAVLink Inspector, Debug — [Priority: LOW]

### Top-Level Tab Gating
- [ ] Calibrate tab: hide if !supportsCalibration — [Priority: MED]
- [ ] Parameters tab: hide if !supportsParameters — [Priority: MED]
- [ ] Configure tab: always visible (at least some panels always available) — [Priority: MED]

## Firmware-Specific Panel Behavior

### When PX4 Connected
- [ ] Hide: Ports, OSD — [Priority: MED]
- [ ] Show all others — [Priority: MED]
- [ ] PID param names: MC_ROLLRATE_P instead of ATC_RAT_RLL_P — [Priority: MED]

### When Betaflight Connected (Future)
- [ ] Hide: MAVLink Inspector, Ports, Log Download — [Priority: LOW]
- [ ] Show: OSD, PID, Receiver — [Priority: LOW]
- [ ] MSP-based param system instead of MAVLink PARAM_* — [Priority: LOW]

### When iNav Connected (Future)
- [ ] Same as Betaflight + Mission Upload enabled — [Priority: LOW]
- [ ] iNav-specific OSD elements — [Priority: LOW]
