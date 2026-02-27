# Altnautica Command GCS — Feature Audit & Coverage Checklist

> MSN-015 | Status: IN_PROGRESS | Created: 2026-02-27

## Purpose

Complete feature audit of Command GCS against professional reference applications (QGroundControl, Mission Planner, Betaflight Configurator, iNav Configurator). Each file below contains checkbox-tracked features with priority levels.

## Reading Order

| # | File | Scope | Features |
|---|------|-------|----------|
| 1 | `01-configure-panels.md` | FC config panels — existing + planned | ~120 |
| 2 | `02-calibration-suite.md` | All calibration features | ~25 |
| 3 | `03-mavlink-coverage.md` | Message decoders + MAV_CMD support | ~400 |
| 4 | `04-protocol-support.md` | Multi-firmware: ArduPilot, PX4, BF, iNav | ~40 |
| 5 | `05-qol-and-polish.md` | Quality of life features | ~30 |
| 6 | `06-safety-systems.md` | RAM/flash, armed lock, pre-arm, validation | ~25 |
| 7 | `07-visual-indicators.md` | Connection quality, freshness, sensor health | ~30 |
| 8 | `08-diagnostics-logging.md` | Protocol log, event timeline, export | ~20 |
| 9 | `09-map-and-flight-ops.md` | Geofence viz, telemetry recording, log analysis | ~30 |

## Status Summary

| Category | Implemented | Planned | Total | Coverage |
|----------|------------|---------|-------|----------|
| Configure Panels | 11 | 10 | 21 | 52% |
| Calibration | 5 | 7 | 12 | 42% |
| MAVLink Messages | 36 | 15 | 51 | 15.6% of 231 spec |
| MAV_CMDs | 33 | 10 | 43 | 19.9% of 166 spec |
| Protocol Support | 1 | 3 | 4 | 25% |
| QoL Features | 3 | 8 | 11 | 27% |
| Safety Systems | 2 | 6 | 8 | 25% |
| Visual Indicators | 3 | 8 | 11 | 27% |
| Diagnostics | 1 | 5 | 6 | 17% |
| Map/Flight Ops | 2 | 6 | 8 | 25% |

## Legend

- `[x]` — Implemented and working
- `[ ]` — Planned, not yet implemented
- Priority: `HIGH` = safety-critical or blocking, `MED` = important for feature parity, `LOW` = nice to have
