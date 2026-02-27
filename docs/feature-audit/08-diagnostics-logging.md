# 08 — Diagnostics & Logging

> Protocol message logging, event timeline, export, and debugging tools.

## Protocol Message Log

### Existing
- [x] MavlinkInspectorPanel — Real-time message viewer with filtering — [Priority: MED]

### Planned
- [ ] diagnostics-store messageLog: RingBuffer(2000) of all parsed messages — [Priority: MED]
- [ ] Log direction (inbound/outbound) — [Priority: MED]
- [ ] Message name resolution from msg ID — [Priority: MED]
- [ ] Message rate calculation per type (msgs/sec) — [Priority: LOW]
- [ ] Hex/binary payload view in inspector — [Priority: LOW]
- [ ] Export message log as CSV — [Priority: LOW]
- [ ] Pause/resume logging — [Priority: LOW]

## Event Timeline

- [ ] diagnostics-store eventTimeline: RingBuffer(500) — [Priority: MED]
- [ ] Track events: connect, disconnect, arm, disarm, mode_change, error — [Priority: MED]
- [ ] Track events: calibration, param_write, flash_commit — [Priority: MED]
- [ ] Track events: mission_upload, mission_download — [Priority: MED]
- [ ] Chronological event list view — [Priority: MED]
- [ ] Event type filtering — [Priority: LOW]
- [ ] Timestamp display (relative + absolute) — [Priority: LOW]

## Connection Log

- [ ] diagnostics-store connectionLog: timestamped connect/disconnect/error entries — [Priority: MED]
- [ ] Connection duration tracking — [Priority: LOW]
- [ ] Error categorization (timeout, CRC failure, transport error) — [Priority: LOW]
- [ ] Auto-reconnect attempt logging — [Priority: LOW]

## Calibration History

- [ ] diagnostics-store calibrationHistory: type + result + timestamp — [Priority: LOW]
- [ ] Success/failure/cancelled tracking per calibration type — [Priority: LOW]
- [ ] Calibration result details (offsets, fitness, etc.) — [Priority: LOW]
- [ ] Before/after comparison for compass offsets — [Priority: LOW]

## Export & Sharing

- [ ] Export full diagnostics report (JSON) — [Priority: LOW]
- [ ] Include: connection info, param snapshot, event timeline, errors — [Priority: LOW]
- [ ] Copy-to-clipboard for support — [Priority: LOW]
- [ ] Shareable diagnostic URL (future) — [Priority: LOW]

## Developer Tools

- [ ] WebSocket frame inspector (raw bytes) — [Priority: LOW]
- [ ] Command queue status display — [Priority: LOW]
- [ ] Ring buffer utilization display — [Priority: LOW]
- [ ] Performance metrics (parse rate, callback latency) — [Priority: LOW]
