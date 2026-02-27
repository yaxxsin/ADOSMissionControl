# 09 — Map Integration & Flight Operations

> Geofence visualization, telemetry recording, log analysis, and map features.

## Geofence Visualization

### Existing
- [x] GeofenceEditor component in planner (basic) — [Priority: MED]
- [x] FENCE_STATUS decoder — [Priority: MED]

### Planned
- [ ] Download fence polygon on connect — [Priority: HIGH]
- [ ] Render circle fence overlay on Leaflet map — [Priority: HIGH]
- [ ] Render polygon fence overlay on Leaflet map — [Priority: HIGH]
- [ ] Altitude band visualization (min/max altitude as horizontal planes) — [Priority: MED]
- [ ] Real-time breach indicator from FENCE_STATUS — [Priority: HIGH]
- [ ] Breach type display (altitude, boundary, combined) — [Priority: MED]
- [ ] Interactive editing: click/drag fence points — [Priority: MED]
- [ ] Sync interactive edits back to GeofencePanel params — [Priority: MED]
- [ ] Fence inclusion/exclusion zone support — [Priority: LOW]

## Telemetry Recording & Replay

### Recording
- [ ] telemetry-recorder.ts: Capture all telemetry pushes with timestamps — [Priority: HIGH]
- [ ] Storage to IndexedDB — [Priority: HIGH]
- [ ] Start/stop button in app header — [Priority: HIGH]
- [ ] Recording indicator (red dot + duration) — [Priority: MED]
- [ ] Auto-start recording option — [Priority: LOW]
- [ ] Max recording duration / size limit — [Priority: MED]
- [ ] Export to .tlog format (MAVLink binary log) — [Priority: MED]
- [ ] Export to CSV (selected channels) — [Priority: LOW]

### Replay
- [ ] telemetry-player.ts: Load recorded session — [Priority: MED]
- [ ] Playback speed: 0.5x, 1x, 2x, 4x — [Priority: MED]
- [ ] Seek slider (timeline) — [Priority: MED]
- [ ] Pause/resume playback — [Priority: MED]
- [ ] All stores update during playback (HUD, map, indicators) — [Priority: MED]
- [ ] Visual indicator that replay is active (not live) — [Priority: MED]

## Log Analysis

### DataFlash Log Parser
- [ ] Parse .bin log files (DataFlash format) — [Priority: MED]
- [ ] FMT header parsing (message format definitions) — [Priority: MED]
- [ ] Named field extraction — [Priority: MED]
- [ ] Handle large files (streaming parser) — [Priority: MED]

### Log Viewer
- [ ] Filtered message table (select message types) — [Priority: MED]
- [ ] Column sorting and filtering — [Priority: LOW]
- [ ] Search within log messages — [Priority: LOW]

### Quick Graphs
- [ ] Altitude over time — [Priority: MED]
- [ ] GPS track on map — [Priority: MED]
- [ ] Battery voltage/current over time — [Priority: LOW]
- [ ] Vibration levels over time — [Priority: LOW]
- [ ] RC inputs over time — [Priority: LOW]

### External Integration
- [ ] "Open in UAV Log Viewer" link (plot.ardupilot.org) — [Priority: LOW]
- [ ] "Open in Log Viewer Online" link — [Priority: LOW]

## Map Features

### Existing
- [x] Drone position marker with heading on Leaflet map — [Priority: HIGH]
- [x] Vehicle trail (flight path polyline) — [Priority: HIGH]
- [x] Dark tile layer — [Priority: MED]
- [x] Dashboard fleet map — [Priority: MED]
- [x] Mission planner map with waypoints — [Priority: HIGH]

### Planned
- [ ] Multi-drone markers on single map — [Priority: MED]
- [ ] Click-to-navigate (GUIDED mode goto) — [Priority: MED]
- [ ] Distance/bearing measurement tool — [Priority: LOW]
- [ ] Offline tile caching — [Priority: MED]
- [ ] Multiple tile layer options (satellite, terrain, etc.) — [Priority: LOW]
- [ ] No-fly zone overlays (future: digital sky integration) — [Priority: LOW]

## Mission Execution Monitoring

### Existing
- [x] Mission progress display (current waypoint) — [Priority: HIGH]
- [x] Waypoint reached notification — [Priority: MED]

### Planned
- [ ] Real-time mission path vs planned path comparison — [Priority: MED]
- [ ] ETA to next waypoint — [Priority: LOW]
- [ ] Cross-track error display — [Priority: LOW]
- [ ] Mission pause/resume controls on map — [Priority: MED]
