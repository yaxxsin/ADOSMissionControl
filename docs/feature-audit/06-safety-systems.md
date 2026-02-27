# 06 — Safety Systems

> RAM/flash management, armed state protection, pre-arm checks, parameter validation.

## RAM vs Flash Parameter Safety (DEC-046)

### Existing
- [x] Per-panel "Write to Flash" button after RAM writes — [Priority: HIGH]
- [x] WriteConfirmDialog with flash commit option — [Priority: HIGH]

### Planned — Global Flash Tracking
- [ ] Global param-safety-store tracking all RAM writes across panels — [Priority: HIGH]
- [ ] FlashCommitBanner: persistent banner showing pending RAM-only writes — [Priority: HIGH]
- [ ] Yellow border for pending changes — [Priority: HIGH]
- [ ] Red + pulse for critical safety params pending (FS_*, BATT_FS_*, FENCE_*, MOT_*) — [Priority: HIGH]
- [ ] Expandable view showing each pending param (panel, name, value, timestamp) — [Priority: MED]
- [ ] Flash commit log: last 10 commits — [Priority: LOW]
- [ ] "Commit All" button in banner — [Priority: HIGH]
- [ ] "View Changes" button in banner — [Priority: MED]

### Disconnect Guard
- [ ] Modal on disconnect with pending RAM writes — [Priority: HIGH]
- [ ] Options: "Commit & Disconnect" / "Disconnect Without Saving" / "Cancel" — [Priority: HIGH]
- [ ] List pending params in modal — [Priority: MED]

## Armed State Lock

- [ ] Detect armed state from heartbeat (drone-store.armState) — [Priority: HIGH]
- [ ] Full-panel overlay when armed: semi-transparent + "Vehicle is armed" message — [Priority: HIGH]
- [ ] Disable all input elements in FC panels when armed — [Priority: HIGH]
- [ ] Allow read-only viewing of current values while armed — [Priority: MED]
- [ ] Exception: MAVLink Inspector (read-only by nature) — [Priority: MED]
- [ ] Exception: Overview/telemetry panels (read-only) — [Priority: MED]

## Critical Parameter Warnings

- [ ] Red warning icon for critical param prefixes in WriteConfirmDialog — [Priority: HIGH]
- [ ] Critical prefixes: FS_, BATT_FS_, FENCE_, MOT_, BRD_SAFETY, ARMING_ — [Priority: HIGH]
- [ ] Warning text: "This parameter affects flight safety" — [Priority: MED]
- [ ] Require explicit confirmation for critical param changes — [Priority: MED]

## Parameter Range Validation

- [ ] Inline warning when value is outside min/max from ParamMetadata — [Priority: HIGH]
- [ ] Yellow border on out-of-range input fields — [Priority: MED]
- [ ] Confirmation dialog for out-of-range values — [Priority: MED]
- [ ] Prevent saving values that would be dangerous (e.g., negative battery capacity) — [Priority: HIGH]
- [ ] Show valid range in tooltip/label — [Priority: LOW]

## Reboot Required Indicator

- [ ] Track params with rebootRequired:true in param-metadata — [Priority: MED]
- [ ] Persistent amber banner: "Reboot required for changes to take effect" — [Priority: MED]
- [ ] List which params need reboot — [Priority: LOW]
- [ ] "Reboot Now" button in banner — [Priority: MED]
- [ ] Clear banner after successful reboot — [Priority: MED]

## Pre-Arm Safety Checks

- [ ] Pre-arm check display panel (PreArmPanel) — [Priority: HIGH]
- [ ] Decode SYS_STATUS sensor bitmask to 32-sensor grid — [Priority: HIGH]
- [ ] Capture STATUSTEXT messages with "PreArm:" prefix — [Priority: HIGH]
- [ ] Parse pre-arm failure messages into actionable fix suggestions — [Priority: MED]
- [ ] Auto-trigger pre-arm check on panel open — [Priority: MED]
- [ ] Color-coded checklist: green (pass), red (fail), gray (not checked) — [Priority: MED]
