# ArduPilot Parameter Compatibility Reference

> Canonical reference for deprecated/renamed ArduPilot parameters and which Command GCS panels they affect.
> Updated: 2026-02-27

## Deprecated Parameters

| Parameter | Deprecated In | Replacement | Affected Panel | Fix Applied |
|-----------|--------------|-------------|----------------|-------------|
| `BRD_PWM_COUNT` | ArduPilot 4.2+ | `SERVOx_FUNCTION = -1` for GPIO | OutputsPanel | Removed — GPIO detected via function value |

## Renamed Parameters

| Old Name | Correct Name | ArduPilot Docs | Affected Panel | Fix Applied |
|----------|-------------|----------------|----------------|-------------|
| `RC_MAP_ROLL` | `RCMAP_ROLL` | [RCMAP docs](https://ardupilot.org/copter/docs/common-rcmap.html) | ReceiverPanel | Renamed |
| `RC_MAP_PITCH` | `RCMAP_PITCH` | Same | ReceiverPanel | Renamed |
| `RC_MAP_THROTTLE` | `RCMAP_THROTTLE` | Same | ReceiverPanel | Renamed |
| `RC_MAP_YAW` | `RCMAP_YAW` | Same | ReceiverPanel | Renamed |
| `GPS_TYPE` | `GPS1_TYPE` | ArduPilot 4.6+ | — | Both in mock data |

## Vehicle-Specific Parameters

Parameters that only exist on specific vehicle types (Copter vs Plane/VTOL).

### Copter-Only Failsafe Params

| Parameter | Purpose |
|-----------|---------|
| `FS_SHORT_ACTN` | Short failsafe action |
| `FS_SHORT_TIMEOUT` | Short failsafe timeout |
| `FS_LONG_ACTN` | Long failsafe action |
| `FS_LONG_TIMEOUT` | Long failsafe timeout |
| `FS_GCS_ENABL` | GCS failsafe enable |

### Plane-Only Failsafe Params

| Parameter | Purpose |
|-----------|---------|
| `THR_FAILSAFE` | Throttle failsafe enable |
| `THR_FS_VALUE` | Throttle failsafe PWM threshold |

### Cross-Vehicle (Shared) Params

| Parameter | Purpose |
|-----------|---------|
| `BATT_FS_VOLTSRC` | Battery voltage source |
| `BATT_FS_LOW_VOLT` | Low battery voltage threshold |
| `BATT_FS_LOW_ACT` | Low battery action |
| `FENCE_*` | Geofence params — standard across all vehicles |
| `RCn_OPTION` | Per-channel RC switch options |

## Panel Audit Status

| Panel | Status | Notes |
|-------|--------|-------|
| OutputsPanel | Fixed | BRD_PWM_COUNT removed, GPIO detection via SERVOx_FUNCTION=-1 |
| ReceiverPanel | Fixed | RC_MAP_* → RCMAP_* |
| FailsafePanel | Fixed | Vehicle-type detection, optional params for cross-vehicle |
| PidTuningPanel | OK | Already has vehicle-type detection |
| PowerPanel | OK | Battery params are cross-vehicle |
| GeofencePanel | OK | FENCE_* standard |
| LedPanel | OK | NTF_LED_* standard |
| TelRadioPanel | OK | SERIAL1/2 standard |
| CalibrationPanel | OK | Command-based (no params) |
| DebugPanel | OK | Telemetry-based (no params) |
| FramePanel | Low | Copter enum labels on Plane — future fix |
| SensorsPanel | Low | ARSPD/FLOW/RNGFND board-specific — mark as optional |
| OsdEditorPanel | Low | OSD params absent on non-OSD boards — mark as optional |
| GimbalPanel | Low | MNT1 only — future multi-mount |
| CameraPanel | Low | CAM1 only — future multi-camera |

## `usePanelParams` Optional Params Pattern

When a panel loads params that may not exist on all firmware/vehicle types, use:

```ts
const { params, missingOptional, ... } = usePanelParams({
  paramNames: [...REQUIRED_PARAMS, ...MAYBE_PARAMS],
  optionalParams: MAYBE_PARAMS,
  panelId: "my-panel",
});
```

Optional params that fail to load will appear in `missingOptional` (a `Set<string>`) instead of triggering a red error badge. PanelHeader displays a yellow warning badge for these.
