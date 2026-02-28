# Altnautica ADOS Mission Control

**Open-source web-based Ground Control Station for autonomous drones**

![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg) [![Discord](https://img.shields.io/badge/Discord-Join-5865F2.svg?logo=discord&logoColor=white)](https://discord.gg/uxbvuD4d5q)

**[Live App](https://command.altnautica.com)** | **[Website](https://altnautica.com/command)** | **[Discord](https://discord.gg/uxbvuD4d5q)** | **[Documentation](#features)**

## Screenshots

<p align="center">
  <img src="public/screenshots/dashboard.png" alt="Fleet Dashboard" width="100%">
</p>

<table>
  <tr>
    <td><img src="public/screenshots/mission-planner.png" alt="Mission Planner" width="100%"></td>
    <td><img src="public/screenshots/flight-control.png" alt="Flight Control" width="100%"></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/3d-simulation.png" alt="3D Simulation" width="100%"></td>
    <td><img src="public/screenshots/configure.png" alt="FC Configuration" width="100%"></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/parameters.png" alt="FC Parameters" width="100%"></td>
    <td></td>
  </tr>
</table>

Altnautica Command is a web-based Ground Control Station for real-time drone operations — covering FC configuration, sensor calibration, mission planning, MAVLink protocol communication, and manual flight control. Runs in any browser. Works standalone in the field with zero configuration or connected to cloud infrastructure for fleet-scale operations.

---

## Why Altnautica Command

| | QGroundControl / Mission Planner | Altnautica Command |
|---|---|---|
| **Platform** | Native desktop (Qt / WxWidgets) | Web — any browser, any OS |
| **Installation** | Required, platform-specific | None — open URL |
| **Stack** | C++ from 2010–2015 | React 19, Next.js 16, TypeScript strict |
| **Firmware** | MAVLink-focused | DroneProtocol abstraction (ArduPilot, PX4, Betaflight, iNav) |
| **Field use** | Offline binary | Zero-config standalone, sub-100ms MAVLink |
| **Extension** | C++ plugin system | TypeScript — add a store, hook, or panel |

Additional value props:

- **Web-native** — Runs in any browser, no installation. Works on tablets, laptops, and ground stations equally.
- **Deep FC config** — 25 configuration panels, timer group conflict detection, 9 board profiles, 46 MAVLink message decoders.
- **Modern DX** — Zustand 5 with ring-buffered telemetry, hot reload, TypeScript strict throughout. No C++ compilation step.
- **Demo first** — `npm run demo` launches a full simulation with 5 drones, realistic telemetry, and mock MAVLink — no hardware, no API keys.

---

## Features

### FC Configuration and Tuning

- **25 configuration panels** — CalibrationPanel, CalibrationWizard, ReceiverPanel, FlightModesPanel, OutputsPanel, PidTuningPanel, FailsafePanel, PowerPanel, PortsPanel, ParametersPanel, FirmwarePanel, FramePanel, CameraPanel, GimbalPanel, SensorsPanel, LedPanel, TelRadioPanel, GeofencePanel, OsdEditorPanel, DebugPanel, SensorGraphPanel, MavlinkInspectorPanel, PreArmPanel, CliPanel, TimerGroupDiagram
- **Timer group conflict detection** — Visual diagram showing STM32 hardware timer groups, color-coded by protocol (DShot vs PWM), with conflict highlighting and board override dropdown
- **Board profile auto-detection** — 9 profiles: SpeedyBee F405 Wing/V3/V4, Matek H743, Pixhawk 4/6C/6X, Generic F405, Unknown. Auto-detected via `AUTOPILOT_VERSION`
- **Full parameter system** — Search, edit, and flash all FC parameters with real-time validation
- **Write-to-flash pipeline** — ArduPilot auto-saves params to EEPROM on `PARAM_SET` (confirmed from `GCS_Param.cpp`). `MAV_CMD_PREFLIGHT_STORAGE` retained as belt-and-suspenders with fire-and-forget (no blocking ACK wait)

### Sensor Calibration

- Accelerometer 6-position calibration with step-by-step wizard and real-time visual feedback
- Gyroscope, barometer, and airspeed sensor calibration
- Compass calibration with live `MAG_CAL_PROGRESS` tracking and per-axis progress bars
- RC trim auto-fix — "Set Trims to Current" reads `RCMAP_ROLL/PITCH/YAW`, previews changes (e.g., `RC1_TRIM: 1500 → 1503`), and writes directly to FC
- 2-step RC calibration flow: Step 1 captures min/max extremes, Step 2 captures center trims from live stick positions
- Trim offset indicator — channel bar labels turn red when live value is outside trim ± deadzone, green when inside

### Pre-Arm and Safety

- Automated pre-arm checks that parse ArduPilot STATUSTEXT output with `Arm:` prefix matching
- Inline quick-fix actions for common failures — RC neutral, timer group protocol conflicts
- Bulk "Fix All RC Trims" action when 2 or more RC neutral failures are detected simultaneously
- Auto re-check after fix — both bulk and individual trim fixes re-run pre-arm checks 500ms after applying
- **Armed lock overlay** — blocks FC configuration changes while the vehicle is armed
- **Disconnect guard** — warns before disconnecting when there are unsaved parameter changes
- `use-firmware-capabilities` hook for feature-gating panels by detected firmware version

### MAVLink Protocol

- **46 message decoders** registered in the binary parser — HEARTBEAT, ATTITUDE, GLOBAL_POSITION_INT, GPS_RAW_INT, SYS_STATUS, BATTERY_STATUS, RC_CHANNELS, SERVO_OUTPUT_RAW, PARAM_VALUE, COMMAND_ACK, STATUSTEXT, MISSION_ITEM_INT, MAG_CAL_PROGRESS, EKF_STATUS_REPORT, VIBRATION, LOG_ENTRY, LOG_DATA, and more
- **17 MAV_CMD handlers** — COMPONENT_ARM_DISARM, DO_SET_MODE, DO_REBOOT, DO_SET_SERVO, PREFLIGHT_CALIBRATION, PREFLIGHT_STORAGE, REQUEST_AUTOPILOT_CAPABILITIES, and others
- Binary MAVLink v2 parser with CRC-16/MCRF4XX validation and sequence number tracking
- Binary encoder for outbound messages — typed, no string serialization
- Mission upload and download via `MISSION_ITEM_INT` protocol with count-handshake and per-item ACK
- Dataflash log download — full `LOG_REQUEST_LIST` / `LOG_REQUEST_DATA` / `LOG_DATA` state machine with retry logic and progress callbacks
- Serial CLI passthrough via `SERIAL_CONTROL` for direct FC terminal access
- Real-time MAVLink inspector with per-message-type filtering and rate display
- Command queue with ACK-based retry and configurable timeout

### Multi-Firmware Abstraction

The `DroneProtocol` TypeScript interface provides a firmware-agnostic API. Each firmware ships its own adapter that implements the interface — the rest of the application never calls MAVLink or MSP directly.

| Firmware | Status | Notes |
|----------|--------|-------|
| ArduPilot | Full | 46 decoders, 17 commands, all panels, flash tools |
| PX4 | Partial | Adapter designed, implementation in progress |
| Betaflight | Planned | MSP interface stub |
| iNav | Planned | MSP interface stub |

### Transport

- **WebSocket** — Connect to mavlink-router, ArduPilot SITL bridge, or any MAVLink-over-WebSocket relay
- **WebSerial** — Direct USB connection to FC (Chrome 89+). No intermediate software required
- Auto-reconnect with exponential backoff on connection drop
- STM32 serial bootloader support and DFU firmware flashing via FirmwarePanel

### Mission Planning

- Waypoint editor with drag-and-drop positioning on an interactive map
- Altitude profile visualization with per-waypoint AGL control
- Geofence editor with inclusion/exclusion zone support
- Plan library — save, load, duplicate, and organize missions locally via IndexedDB
- Import and export `.waypoints` and `.plan` file formats
- 13 mission planner components: WaypointList, WaypointInspector, AltitudeProfile, MissionActions, WaypointEntities, FlightPathEntity, GcsEntity, and more
- 9 plan library components for organization and offline storage

### Telemetry and Monitoring

- **22 Zustand stores** with ring-buffered telemetry — fixed-capacity circular arrays prevent unbounded memory growth during long flight sessions
- **9 indicator components** — vibration levels, EKF status, GPS fix quality, sensor health, battery voltage/current, RSSI, connection quality, and armed state
- Telemetry freshness tracking — indicators go stale when data stops arriving
- Flight history with CSV export (11 columns: date, drone, duration, distance, altitude, speed, battery, and more)
- Connection quality meter with per-packet latency measurement

### Demo Mode

- 5 simulated drones with realistic telemetry — GPS tracks, battery drain curves, altitude profiles, flight modes
- Zero setup: `npm run demo`
- Full mock MAVLink protocol — all 25 FC panels work against simulated FC responses
- Mock `AUTOPILOT_VERSION` emits SpeedyBee F405 Wing board ID for board profile auto-detection
- RC channel simulation with CH2 at 1538 and live `setRcChannelValues()` feed for pre-arm check testing
- Mock pre-arm check via `doPreArmCheck()` with `Arm:` prefix output matching real ArduPilot behavior

---

## Quick Start

```bash
git clone https://github.com/altnautica/ADOSMissionControl.git
cd ADOSMissionControl
npm install
npm run demo
```

Open [http://localhost:4000](http://localhost:4000). You will see five simulated drones with live telemetry, map positions, and realistic flight data. All FC configuration panels work against the mock MAVLink engine — no hardware required.

### Development Commands

```bash
npm run dev      # Dev server on port 4000, no demo data
npm run demo     # Dev server with NEXT_PUBLIC_DEMO_MODE=true (5 simulated drones)
npm run build    # Production build
npm run start    # Run production build on port 4000
npm run lint     # ESLint
```

### Connecting to Real Hardware

**WebSocket (mavlink-router or SITL bridge)**

Point Command at any MAVLink-over-WebSocket endpoint. If you are using ArduPilot SITL, the companion `altnautica-sitl` tool (in `tools/sitl/`) launches SITL and bridges the TCP output to a WebSocket that Command can connect to directly.

```bash
# Using the SITL bridge tool
cd tools/sitl
npm install
npx tsx src/index.ts
# Then in Command: connect to ws://localhost:5762
```

**WebSerial (direct USB)**

Click the connect button in Command, select "WebSerial", then choose your FC's USB port from the browser dialog. Requires Chrome 89+ or any Chromium-based browser. No drivers or intermediate software required.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) | Routing, SSR, bundling |
| UI | React 19.2.3 | Component rendering |
| State | Zustand 5 | 22 stores with ring buffers |
| Maps | Leaflet + react-leaflet 5 | Interactive map, dark tiles, offline |
| 3D Simulation | Cesium | Mission simulation and flight replay |
| Charts | Recharts | Telemetry time-series and analytics |
| Styling | Tailwind v4 | CSS-first design tokens |
| Protocol | Custom MAVLink v2 | Binary parser/encoder, 46 decoders |
| Transport | WebSocket + WebSerial | FC connectivity (field and direct) |
| Fonts | Space Grotesk, Inter, JetBrains Mono | Display, body, telemetry |
| Icons | lucide-react | UI iconography |
| Storage | idb-keyval (IndexedDB) | Offline plan library persistence |
| Backend | Convex (optional) | Cloud fleet management |
| Language | TypeScript (strict) | End-to-end type safety |

---

## Architecture

### Protocol Abstraction

The core of Command's firmware support is the `DroneProtocol` TypeScript interface. Every FC operation — read a parameter, send a command, start calibration, download a log — goes through this interface. The MAVLink adapter implements it for ArduPilot and PX4. Future MSP adapters will implement the same interface for Betaflight and iNav. The rest of the application never calls the protocol layer directly.

This pattern is inspired by QGroundControl's `FirmwarePlugin` abstraction, but implemented in TypeScript rather than C++.

```
DroneProtocol (interface)
├── MAVLinkAdapter (ArduPilot, PX4)
│   ├── MAVLinkParser (binary decoder, 46 message types)
│   ├── MAVLinkEncoder (binary encoder)
│   └── firmware/ (per-firmware command handlers + flash tools)
├── MSPAdapter (Betaflight, iNav — planned)
└── MockProtocol (demo mode — full implementation)
```

The `ProtocolCapabilities` type gates panel features by what the connected firmware actually supports — panels degrade gracefully when capabilities are absent rather than erroring.

### State Management

22 Zustand stores, each owning a distinct concern:

| Store | Responsibility |
|-------|---------------|
| `drone-store` | Fleet registry and per-drone metadata |
| `drone-manager` | Connection lifecycle, protocol instantiation |
| `telemetry-store` | Position, attitude, velocity, battery (ring-buffered) |
| `fleet-store` | Multi-drone fleet state |
| `mission-store` | Active mission, waypoints, upload/download state |
| `planner-store` | Waypoint editor state, selection, drag |
| `plan-library-store` | Saved plans, IndexedDB persistence |
| `settings-store` | User preferences, map config |
| `ui-store` | View state, panel layout, sidebar, modals |
| `input-store` | Gamepad/keyboard input, axis bindings |
| `video-store` | Stream URLs, resolution, recording state |
| `auth-store` | Authentication (Convex, optional) |
| `connect-dialog-store` | Connection dialog state |
| `simulation-store` | 3D mission simulation playback |
| `simulation-history-store` | Past simulation runs |
| `history-store` | Flight records, CSV export |
| `gcs-location-store` | Ground station GPS position |
| `trail-store` | Per-drone flight trail points (ring-buffered, rejects 0,0 GPS) |
| `drone-metadata-store` | FC board info, firmware version cache |
| `param-safety-store` | Parameter change audit, safety gate |
| `diagnostics-store` | System-level diagnostics and health |
| `sensor-health-store` | Per-sensor health and calibration state |

Telemetry stores use ring buffers — fixed-capacity circular arrays. When the buffer is full, the oldest data point is dropped automatically. This bounds memory usage for arbitrarily long flight sessions without any manual cleanup.

### Data Flow Modes

**Field mode** — Direct MAVLink connection via WebSocket or WebSerial. Sub-100ms latency. No internet required, no backend required. Single operator. Works fully offline.

**Cloud mode** — Telemetry relayed through MQTT broker into Convex reactive database. 200–500ms latency. Multi-operator, multi-site fleet management. Requires optional Convex backend.

**Hybrid mode** — Field-mode direct link for the active drone with cloud-mode fleet awareness running simultaneously. Best of both for mixed operations.

### Directory Structure

```
.
├── src/
│   ├── app/                   # Next.js App Router pages and layouts
│   │   └── plan/              # Mission planner page + route handlers
│   ├── components/            # React components
│   │   ├── fc/                # 35 FC configuration components
│   │   │   ├── CalibrationPanel.tsx
│   │   │   ├── ReceiverPanel.tsx
│   │   │   ├── OutputsPanel.tsx
│   │   │   ├── PidTuningPanel.tsx
│   │   │   ├── TimerGroupDiagram.tsx
│   │   │   ├── PreArmPanel.tsx
│   │   │   ├── MavlinkInspectorPanel.tsx
│   │   │   ├── CliPanel.tsx
│   │   │   └── ... (25 panels + 10 shared infra components)
│   │   ├── indicators/        # 9 telemetry indicator components
│   │   ├── planner/           # 13 mission planning components
│   │   ├── library/           # 9 plan library components
│   │   ├── map/               # Map overlay components (geofence, trails)
│   │   ├── simulation/        # 3D Cesium simulation components
│   │   └── ...                # Dashboard, HUD, nav, connection dialog
│   ├── hooks/                 # 17 custom React hooks
│   │   ├── use-armed-lock.ts
│   │   ├── use-auto-reconnect.ts
│   │   ├── use-connection-quality.ts
│   │   ├── use-firmware-capabilities.ts
│   │   ├── use-panel-params.ts
│   │   ├── use-telemetry-freshness.ts
│   │   ├── use-unsaved-guard.ts
│   │   └── ...
│   ├── lib/                   # Core libraries
│   │   ├── protocol/          # MAVLink parser, encoder, adapter
│   │   │   ├── mavlink-parser.ts      # Binary decoder, 46 registered types
│   │   │   ├── mavlink-encoder.ts     # Binary encoder
│   │   │   ├── mavlink-adapter.ts     # DroneProtocol implementation
│   │   │   ├── mavlink-messages.ts    # Message type definitions
│   │   │   └── firmware/             # Per-firmware handlers + flash tools
│   │   │       ├── firmware-ardupilot.ts
│   │   │       ├── firmware-px4.ts
│   │   │       ├── firmware-betaflight.ts
│   │   │       └── firmware-inav.ts
│   │   ├── board-profiles.ts          # 9 board profiles + timer group maps
│   │   ├── mission-io.ts              # .waypoints / .plan import/export
│   │   ├── dataflash-parser.ts        # Log file parsing
│   │   ├── telemetry-recorder.ts      # In-flight telemetry recording
│   │   ├── telemetry-player.ts        # Recorded telemetry playback
│   │   └── ...
│   ├── mock/                  # Demo mode engine
│   │   ├── engine.ts          # Mock flight engine, 5 simulated drones
│   │   ├── mock-protocol.ts   # Full MAVLink mock, all FC panels
│   │   ├── mock-transport.ts  # Mock WebSocket transport
│   │   └── mock-params.ts     # Simulated FC parameter set
│   └── stores/                # 22 Zustand stores
├── public/                    # Static assets
├── LICENSE                    # GPL-3.0
├── tools/
│   └── sitl/                  # ArduPilot SITL launcher + TCP→WebSocket bridge
├── CONTRIBUTING.md            # Contribution guide
└── package.json
```

---

## Firmware Support Matrix

| Firmware | Status | Protocol | Decoders | Commands | Calibration | Mission Upload |
|----------|--------|----------|----------|----------|-------------|----------------|
| ArduPilot | Full | MAVLink v2 | 46 | 17 | All sensors | Full |
| PX4 | Partial | MAVLink v2 | Designed | Designed | — | — |
| Betaflight | Planned | MSP | — | — | — | — |
| iNav | Planned | MSP | — | — | — | — |

ArduPilot is the primary target firmware. All 25 FC panels, all calibration flows, timer group detection, and the full parameter system are implemented and tested against ArduPilot running on SpeedyBee F405 Wing hardware.

---

## Board Profiles

Command auto-detects the connected board via `AUTOPILOT_VERSION` and loads the matching STM32 timer group map for conflict detection in OutputsPanel.

| Board | Detected | Timer Groups | Notes |
|-------|----------|-------------|-------|
| SpeedyBee F405 Wing | Auto | Full | Primary test board |
| SpeedyBee F405 V3 | Auto | Full | — |
| SpeedyBee F405 V4 | Auto | Full | — |
| Matek H743 | Auto | Full | — |
| Pixhawk 4 | Auto | Full | — |
| Pixhawk 6C | Auto | Full | — |
| Pixhawk 6X | Auto | Full | — |
| Generic F405 | Auto | Partial | Common STM32F405 layout |
| Unknown | Fallback | None | Manual override available |

Manual board override is available via dropdown in OutputsPanel for boards not yet in the profile list.

---

## Connecting to Hardware

### WebSocket (mavlink-router)

Install and run [mavlink-router](https://github.com/mavlink-router/mavlink-router) on a companion computer or ground station host. Configure it to expose a WebSocket endpoint. In Command, open the connect dialog, select WebSocket, and enter the endpoint URL (e.g., `ws://192.168.1.100:5760`).

### WebSerial (direct USB)

Connect the FC to your computer via USB. Open Command in Chrome 89+ or any Chromium-based browser. Click the connect button, select WebSerial, and choose the FC's COM/tty port from the browser-native port picker. No drivers, no software installation.

### SITL (ArduPilot Software-in-the-Loop)

The companion `altnautica-sitl` tool bridges ArduPilot SITL TCP output to a WebSocket. ArduPilot SITL provides full physics simulation — real autopilot, real sensors, real MAVLink. No fake data.

```bash
# From the repo root
cd tools/sitl
npm install
node sitl-bridge.js --vehicle ArduCopter --sim-vehicle gazebo

# In Command: connect to ws://localhost:5762
```

See `tools/sitl/README.md` for full SITL setup instructions including ArduPilot source build.

---

## Environment Variables

All environment variables are optional. Command works standalone with zero configuration.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_DEMO_MODE` | No | `false` | Enable mock flight engine with 5 simulated drones and full mock MAVLink |
| `NEXT_PUBLIC_CONVEX_URL` | No | — | Convex backend URL for cloud fleet management and auth |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | No | — | Cesium Ion access token for 3D mission simulation and terrain |

Set in a `.env.local` file in the `command/` directory for local development:

```bash
# command/.env.local
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_CESIUM_ION_TOKEN=your_token_here
```

---

## Codebase Stats

| Metric | Count |
|--------|-------|
| TypeScript / TSX files | ~285 |
| Approximate lines of code | ~110,000 |
| Zustand stores | 22 |
| FC configuration panels | 25 |
| FC shared infra components | 10 |
| MAVLink message decoders | 46 |
| MAVLink message types registered | 65 |
| MAV_CMD handlers | 17 |
| Indicator components | 9 |
| Custom React hooks | 17 |
| Transport implementations | 2 (WebSocket, WebSerial) |
| Firmware adapters | 4 (ArduPilot full, PX4 partial, Betaflight/iNav stubs) |
| Board profiles | 9 |
| Mission planner components | 13 |
| Plan library components | 9 |

---

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

The short version:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Write clean, typed code — the codebase uses TypeScript strict mode throughout
4. Test against demo mode (`npm run demo`) and against real hardware if your change touches the protocol layer
5. Submit a pull request with a clear description of what changed and why

For bug reports and feature requests, open an issue at [github.com/altnautica/ADOSMissionControl/issues](https://github.com/altnautica/ADOSMissionControl/issues).

Areas where contributions are particularly useful:

- **Firmware support** — PX4 adapter completion, Betaflight/iNav MSP implementation
- **Board profiles** — Adding timer group maps for boards not yet in the list
- **FC panels** — New configuration panels for ArduPilot subsystems not yet covered
- **Transport** — UDP transport, MAVLink over Bluetooth
- **Testing** — Unit tests for the MAVLink parser/encoder, integration tests for protocol flows

---

## License

[GNU General Public License v3.0](LICENSE) (GPL-3.0-only)

Copyright 2026 Altnautica.

You are free to use, modify, and distribute this software under the terms of the GPL-3.0. Derivative works must also be released under GPL-3.0. This license was chosen to ensure the GCS ecosystem stays open — the same philosophy as ArduPilot and Mission Planner.

---

## Links

- Live app: [command.altnautica.com](https://command.altnautica.com)
- Command page: [altnautica.com/command](https://altnautica.com/command)
- Website: [altnautica.com](https://altnautica.com)
- Discord: [discord.gg/uxbvuD4d5q](https://discord.gg/uxbvuD4d5q)
- Issues: [github.com/altnautica/ADOSMissionControl/issues](https://github.com/altnautica/ADOSMissionControl/issues)
- SITL tool: [`tools/sitl/`](tools/sitl/)

Altnautica builds autonomous drone systems. Command is our open-source GCS — part of a broader platform that includes the ADOS flight computer, DroneNet fleet management, and modular mission suites for survey, inspection, agriculture, cargo, and search and rescue.
