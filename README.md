# Altnautica Command

**Open-source web GCS for autonomous drones. Configure, plan, fly, simulate.**

![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-green.svg) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue.svg) ![Next.js 16](https://img.shields.io/badge/Next.js-16-black.svg) ![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg) [![Community](https://img.shields.io/badge/Community-Join-3A82FF.svg)](https://command.altnautica.com/community)

<p align="center">
  <img src="public/screenshots/dashboard.png" alt="Fleet Dashboard" width="100%">
</p>

<p align="center">
  <strong><a href="https://command.altnautica.com">Live App</a></strong> |
  <strong><a href="https://command.altnautica.com/community/changelog">Changelog</a></strong> |
  <strong><a href="https://command.altnautica.com/community/roadmap">Roadmap</a></strong> |
  <strong><a href="https://command.altnautica.com/community/requests">Feature Requests</a></strong> |
  <strong><a href="https://command.altnautica.com/community">Community</a></strong> |
  <strong><a href="https://command.altnautica.com/community/contact">Contact</a></strong>
</p>

---

## What Is This?

Altnautica Command is a web GCS that runs in any browser and also ships as a native desktop app (Electron). Connect to a flight controller over WebSocket or USB (WebSerial), configure it, plan missions, fly, and simulate. Works on tablets, laptops, and ground stations.

It replaces desktop-only tools like QGroundControl and Mission Planner with a modern web stack: React 19, TypeScript strict, real-time Zustand stores with ring-buffered telemetry, and a custom binary MAVLink v2 parser.

~110K lines of TypeScript. 28 FC configuration panels. 7 pattern generators. 77 MAVLink message types. 31 Zustand stores. Full demo mode with zero setup.

**[Live App](https://command.altnautica.com)** · **[Website](https://altnautica.com/command)** · **[Community](https://command.altnautica.com/community)**

---

## Quick Start

Try it immediately at [command.altnautica.com](https://command.altnautica.com). No install needed.

Or run locally:

```bash
git clone https://github.com/altnautica/ADOSMissionControl.git
cd ADOSMissionControl
npm install
npm run demo
```

Open [http://localhost:4000](http://localhost:4000) for 5 simulated drones with live telemetry, mission planning, and full FC configuration. No hardware needed.

---

## Screenshots

<table>
  <tr>
    <td><img src="public/screenshots/mission-planner.png" alt="Mission Planner" width="100%"><br><sub>Mission planning with pattern generators and terrain following</sub></td>
    <td><img src="public/screenshots/flight-control.png" alt="Flight Control" width="100%"><br><sub>Gamepad and HOTAS flight controls at 50Hz</sub></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/3d-simulation.png" alt="3D Simulation" width="100%"><br><sub>Cesium 3D globe with flight path replay</sub></td>
    <td><img src="public/screenshots/configure.png" alt="FC Configuration" width="100%"><br><sub>28 panels for full flight controller setup</sub></td>
  </tr>
  <tr>
    <td><img src="public/screenshots/parameters.png" alt="FC Parameters" width="100%"><br><sub>Search, edit, and write all FC parameters</sub></td>
    <td><img src="public/screenshots/flashtool.png" alt="Firmware Flash Tool" width="100%"><br><sub>WebUSB firmware flashing for STM32 boards</sub></td>
  </tr>
</table>

---

## Features

### Flight Controller Configuration

- **28 configuration panels** covering calibration, receiver, outputs, PID tuning, failsafe, power, ports, OSD, firmware, PX4 airframe selection, PX4 actuator configuration, MAVLink shell, and more
- **AI PID tuning** with FFT noise analysis, step response, tracking quality, and motor health. AI suggestions are rate-limited on the hosted version (3/week). Self-host with your own `GROQ_API_KEY` for unlimited use
- **Board auto-detection** with 9 profiles (SpeedyBee F405 Wing/V3/V4, Matek H743, Pixhawk 4/6C/6X) and STM32 timer group maps
- **Full parameter system** for searching, editing, and writing all FC parameters with real-time validation
- **Timer group conflict detection** with a visual diagram of STM32 hardware timers, color-coded by protocol (DShot vs PWM)
- **Sensor calibration wizards** for accelerometer 6-position, compass, gyro, baro, and RC calibration with live feedback
- **Sensor graphing** for real-time visualization of IMU, baro, and GPS data
- **MAVLink inspector** showing raw decoded messages and traffic stats
- **Debug console** for protocol-level troubleshooting

### Mission Planning

- Waypoint editor with drag-and-drop on an interactive map
- Altitude profile visualization with per-waypoint AGL control
- **Drawing tools** for polygon, circle, and measure operations with geodetic math
- **7 pattern generators** covering survey (boustrophedon), orbit, corridor, SAR (expanding square, sector search, parallel track), and structure scan
- **GSD calculator** with camera profiles. Auto-computes line spacing from altitude and sidelap
- **Terrain following** via Open Elevation API with LRU cache and terrain-aware altitude adjustment
- **Geofence editor** with inclusion/exclusion polygon and circle zones. Draw on map, upload to drone
- **Rally points** for emergency landing locations. Map placement, upload/download
- **Mission validation** through a pre-upload rule engine (takeoff check, altitude limits, geofence containment, distance warnings)
- **Mission transforms** to move, rotate, and scale entire missions as geometry operations
- **Batch editing** with multi-select waypoints (Ctrl+click, Shift+click) and bulk altitude/speed/command changes
- Plan library for saving, loading, duplicating, and organizing missions (IndexedDB)
- Import/export KML, KMZ, CSV, `.waypoints`, and `.plan` file formats

### 3D Simulation

- **Cesium.js globe** with real terrain, satellite imagery, and 3D building tiles
- **Drone entity** tracking with orientation, flight path trail, and altitude ribbon
- **Playback controls** with 1x-4x speed, timeline scrubbing, and pause/resume
- **3D waypoint visualization** showing waypoints, geofences, rally points, and pattern overlays on the globe
- **Simulation HUD** displaying speed, altitude, heading, and flight mode in an overlay
- **Camera presets** for chase, orbit, top-down, and free-look perspectives
- **Simulation history** for replaying past missions from the plan library

### Live Telemetry

- Real-time dashboard with attitude, position, velocity, and battery indicators
- EKF status, GPS fix quality, vibration levels, RSSI, and sensor health monitoring
- **Alert feed** for warnings, errors, and status messages from the flight controller
- **Pre-arm check visualization** showing which checks pass or fail before arming
- **RC input monitor** for live channel values and calibration verification
- Telemetry freshness tracking. Indicators go stale when data stops arriving
- Flight history with CSV export
- Ring-buffered stores for bounded memory during long sessions

### Flight Control

- **Gamepad, HOTAS, RC transmitter, and keyboard** input at 50Hz via Web Gamepad API
- **Arm/disarm, takeoff, land, RTL, and flight mode switching** through on-screen controls or bound inputs
- **Guided flight** for click-to-go-here waypoint commands
- **Mission execution** with start, pause, resume, and mission item jump
- **Kill switch** with confirmation dialog for emergency motor stop
- **Servo and relay control** for auxiliary outputs
- **Camera trigger and gimbal control** for payload management

### Firmware Management

- **WebUSB flashing** for STM32 boards in DFU mode. No external flasher needed
- **HEX and APJ file parsing** with validation and board matching
- **ArduPilot, PX4, and Betaflight** firmware download and flash
- **Parameter backup and restore** before and after firmware updates

### Protocol Support

- **MAVLink v2** binary parser with CRC validation and 77 message types
- **ArduPilot** with full support (all panels, calibration, missions, dataflash logs)
- **PX4** with full support including airframe selection, actuator configuration, MAVLink shell, and 90+ parameter mappings
- **Betaflight / iNav** planned (MSP interface stubs)
- Multi-firmware `DroneProtocol` abstraction. Components never call MAVLink directly

### Demo Mode

- 5 simulated drones with realistic telemetry (GPS tracks, battery drain, altitude profiles)
- Full mock MAVLink. All 28 FC panels work against simulated FC responses
- Zero setup: `npm run demo` or pass `?demo=true` in the URL

---

## Connecting to Hardware

### WebSocket

Connect to any MAVLink-over-WebSocket endpoint. Works with mavlink-router on a companion computer, or the SITL bridge for simulation.

```bash
# ArduPilot SITL via the companion bridge tool
npm run cli sitl
# Then in Command: connect to ws://localhost:5762
```

See [`tools/sitl/`](tools/sitl/) for full SITL setup (requires ArduPilot built from source).

### WebSerial (Direct USB)

Connect your FC via USB, open Command in Chrome 89+, click connect, pick the port. No drivers, no intermediate software.

---

## CLI

Command includes an interactive CLI for all development workflows:

```bash
npm run cli              # Interactive menu
npm run cli dev          # Dev server (port 4000)
npm run cli demo         # Demo mode — 5 simulated drones
npm run cli sitl         # Launch ArduPilot SITL + WebSocket bridge
npm run cli deploy       # Lint → build → start
npm run cli setup        # First-time setup wizard
npm run cli config       # Configure .env.local interactively
npm run cli sitl-setup   # Clone & build ArduPilot for SITL
npm run cli info         # Check system prerequisites
```

Run `npm run cli` with no arguments for an interactive menu:

```
   _   _ _                   _   _
  /_\ | | |_ _ _  __ _ _  _| |_(_)__ __ _
 / _ \| |  _| ' \/ _` | || |  _| / _/ _` |
/_/ \_\_|\__|_||_\__,_|\_,_|\__|_\__\__,_|

  C O M M A N D
  Ground Control Station

◆  What would you like to do?
│  ○ Start dev server (port 4000)
│  ○ Start demo mode (5 simulated drones)
│  ○ Launch SITL simulator (ArduPilot + WebSocket bridge)
│  ────────────────────────────────
│  ○ Build & deploy (lint → build → start)
│  ────────────────────────────────
│  ○ First-time setup (install deps, configure env)
│  ○ Configure environment (.env.local)
│  ○ Setup ArduPilot SITL (clone + build)
│  ○ System info (check prerequisites)
└
```

---

## Desktop App

The web version at [command.altnautica.com](https://command.altnautica.com) is recommended for most users. If you need offline access or prefer a standalone window, build the desktop app from source:

```bash
npm install
npm run desktop:build:mac   # macOS .dmg
npm run desktop:build:win   # Windows .exe installer
npm run desktop:build:linux # Linux .AppImage
```

Output goes to `release/`.

**macOS note:** The app is not code-signed. On first launch: right-click the app, then Open, then Open again. This is standard for open-source projects (Betaflight Configurator and INAV Configurator ship the same way).

**Windows note:** SmartScreen may warn on first run. Click "More info" then "Run anyway".

---

## Environment Variables

All optional. Command works standalone with zero config. Use `npm run cli config` to set these interactively, or create `.env.local` manually.

### Local (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_DEMO_MODE` | `false` | 5 simulated drones with full mock MAVLink |
| `NEXT_PUBLIC_DEMO_DRONE_COUNT` | `5` | Number of simulated drones in demo mode (1, 3, 5, or 10) |
| `NEXT_PUBLIC_CONVEX_URL` | — | Convex backend for cloud fleet management |
| `GITHUB_TOKEN` | — | Raises PX4 releases API from 60 to 5000 req/hr |
| `GROQ_API_KEY` | — | AI PID tuning suggestions. Free at [console.groq.com](https://console.groq.com) |

### Convex Server (set via dashboard or `npx convex env set`)

These run inside Convex functions, not in Next.js. Only needed if you use cloud features.

| Variable | Description |
|----------|-------------|
| `CESIUM_ION_TOKEN` | 3D terrain for simulation. Free at [ion.cesium.com](https://ion.cesium.com). Without it, simulation falls back to ArcGIS elevation. |
| `GROQ_API_KEY` | AI changelog summaries + PID tuning suggestions. Free at [console.groq.com](https://console.groq.com). |
| `GITHUB_TOKEN` | GitHub API auth for changelog sync (5000 req/hr vs 60 unauthenticated). |
| `AI_PID_WEEKLY_LIMIT` | Max AI PID analyses per user per week. Default: 3. Self-hosted users can set this to any value. |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind v4 |
| State | Zustand 5 (ring-buffered telemetry) |
| Maps | Leaflet + react-leaflet |
| 3D | Cesium |
| Charts | Recharts |
| Protocol | Custom MAVLink v2 binary parser/encoder |
| Transport | WebSocket + WebSerial + WebUSB |
| Storage | IndexedDB (offline plan library) |
| Backend | Convex (optional, for cloud fleet ops) |
| Desktop | Electron |
| Language | TypeScript (strict) |

---

## Firmware Support

| Firmware | Status | Notes |
|----------|--------|-------|
| ArduPilot | **Full** | 77 message types, 20 commands, all panels, calibration, missions, logs |
| PX4 | **Full** | 90+ param mappings, airframe selection, actuator config, MAVLink shell, calibration, missions |
| Betaflight | Planned | MSP interface stub |
| iNav | Planned | MSP interface stub |

---

## By the Numbers

| Metric | Count |
|--------|-------|
| Lines of TypeScript | ~110,000 |
| FC configuration panels | 28 |
| Zustand stores | 31 |
| MAVLink message decoders | 77 |
| MAV_CMD handlers | 20 |
| Pattern generators | 7 |
| Board profiles | 9 |
| File format handlers | 5 (KML, KMZ, CSV, .waypoints, .plan) |

---

## Community

- **[Changelog](https://command.altnautica.com/community/changelog)**: What shipped and when. Auto-synced from GitHub commits
- **[Roadmap](https://command.altnautica.com/community/roadmap)**: What's planned next, organized by priority
- **[Feature Requests](https://command.altnautica.com/community/requests)**: Vote on features or submit your own
- **[Contact](https://command.altnautica.com/community/contact)**: Reach the team directly
- **[GitHub Issues](https://github.com/altnautica/ADOSMissionControl/issues)**: Bug reports and technical discussions

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

```bash
# Fork → clone → branch → code → test → PR
npm run demo   # Test against simulated drones
npm run lint   # Must pass before PR
```

Areas where help is especially useful: Betaflight/iNav MSP, new board profiles, UDP transport, unit tests, and new pattern generators.

---

## License

[GPL-3.0-only](LICENSE). Copyright 2026 Altnautica.

Free to use, modify, and distribute. Derivative works must also be GPL-3.0, same philosophy as ArduPilot.

---

## Links

- **Live app:** [command.altnautica.com](https://command.altnautica.com)
- **Website:** [altnautica.com/command](https://altnautica.com/command)
- **Community:** [command.altnautica.com/community](https://command.altnautica.com/community)
- **Issues:** [github.com/altnautica/ADOSMissionControl/issues](https://github.com/altnautica/ADOSMissionControl/issues)
- **SITL tool:** [`tools/sitl/`](tools/sitl/)
