# Altnautica Command

Open-source Ground Control Station for autonomous drones.

Built for operators who need real-time fleet visibility, mission planning, and manual flight control in a single web-based interface. Runs standalone in the field or connected to cloud infrastructure for fleet-scale operations.

## Features

- **Real-time fleet monitoring** — Live telemetry from multiple drones on a single map with battery, GPS, altitude, and flight mode indicators
- **Immersive flight view** — Full-screen first-person video feed with heads-up display overlay (altitude, speed, heading, battery, GPS, signal strength)
- **Mission planning** — Waypoint-based mission editor with takeoff/landing sequences, altitude profiles, and speed constraints on an interactive map
- **Analytics dashboard** — Flight time, distance, battery consumption, and fleet utilization charts with historical trend analysis
- **Hardware architecture diagrams** — Interactive node-graph visualization of drone hardware topology (sensors, compute, power, comms) using React Flow
- **Demo mode** — Five simulated drones flying realistic patterns over Bangalore. No hardware, no backend, no setup — just `npm run demo`

## Quick Start

```bash
git clone https://github.com/altnautica/command.git
cd command
npm install
npm run demo
```

Open [http://localhost:4000](http://localhost:4000). You'll see five simulated drones with live telemetry, map positions, and flight data.

`npm run demo` starts the dev server with `NEXT_PUBLIC_DEMO_MODE=true`, which activates the mock flight engine. No external services, no API keys, no drone hardware required.

For development without demo data:

```bash
npm run dev        # Dev server on port 4000
npm run build      # Production build
npm run start      # Run production build on port 4000
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 16 (App Router, Turbopack) | Routing, SSR, bundling |
| UI | React 19 | Component rendering |
| State | Zustand 5 | Telemetry stores with ring buffers |
| Maps | Leaflet + react-leaflet | Interactive map with dark tiles, offline support |
| Charts | Recharts | Telemetry time-series and fleet analytics |
| Diagrams | @xyflow/react (React Flow) | Hardware architecture node graphs |
| Styling | Tailwind v4 | CSS-first design tokens |
| Fonts | Space Grotesk, Inter, JetBrains Mono | Display, body, telemetry |
| Icons | lucide-react | UI iconography |

## Architecture

### State Management

Zustand stores manage all application state. Telemetry data flows through ring buffers — fixed-capacity circular arrays that retain the last N data points per drone, preventing unbounded memory growth during long flight sessions.

Store slices:

| Store | Responsibility |
|-------|---------------|
| `droneStore` | Fleet registry, connection state, selection |
| `telemetryStore` | Position, attitude, velocity, battery (ring-buffered) |
| `missionStore` | Waypoints, mission state, progress tracking |
| `alertStore` | Warnings, errors, geofence violations |
| `videoStore` | Stream URLs, resolution, latency, recording state |
| `mapStore` | Viewport, layers, tile source, offline regions |
| `uiStore` | View state, panel layout, theme, sidebar |
| `hardwareStore` | Component topology, health, connections |

### Data Flow Modes

**Field mode (standalone)** — Direct MAVLink connection to drone via WebSocket bridge. Sub-100ms latency. No internet or backend required. Single operator, single drone or small fleet.

**Cloud mode (fleet scale)** — Telemetry relayed through MQTT broker to Convex reactive database. 200-500ms latency. Multi-operator, multi-site fleet management. Requires Convex backend (optional, not included in this repo).

**Hybrid mode** — Field-mode direct link for the active drone, cloud-mode for fleet awareness. Best of both worlds.

### Mock Engine

The mock flight engine generates realistic telemetry for demo and development. Five drones follow pre-programmed flight patterns over Bangalore with accurate GPS tracks, altitude profiles, battery drain curves, and sensor noise. The engine runs entirely client-side — no server, no WebSocket, no external dependencies.

## Directory Structure

```
src/
  app/            # Next.js App Router — pages and layouts
  stores/         # Zustand store slices (telemetry, drones, missions)
  mock/           # Mock flight engine and simulated drone data
  lib/            # Shared utilities (ring buffer, formatters, protocol layer)
  components/     # React UI components
public/           # Static assets (favicon, map tiles)
```

## Demo Mode

Demo mode activates the mock flight engine, which simulates a fleet of five drones operating in Bangalore airspace.

**Enable via environment variable:**

```bash
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

**Enable via URL parameter:**

```
http://localhost:4000?demo=true
```

The `npm run demo` script is a shortcut that sets the environment variable automatically.

Demo drones simulate:
- Realistic GPS movement patterns (patrol orbits, survey grids, point-to-point transit)
- Battery drain curves matching real LiPo discharge profiles
- Altitude variations with takeoff and landing sequences
- Telemetry update rates at 10Hz
- Occasional warnings (low battery, GPS degradation, signal loss)

## Contributing

Contributions are welcome. This project follows standard open-source practices:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Write clean, typed code — the codebase uses TypeScript strict mode
4. Test your changes with `npm run demo` to verify against simulated data
5. Submit a pull request with a clear description of what changed and why

For bug reports and feature requests, open an issue on GitHub.

## License

[GNU General Public License v3.0](LICENSE) (GPL-3.0-only)

You are free to use, modify, and distribute this software under the terms of the GPLv3. Derivative works must also be released under GPLv3.

Copyright 2026 Altnautica.

## Altnautica

Altnautica builds autonomous drone systems. Command is our open-source GCS — part of a broader platform that includes the ADOS flight computer, DroneNet fleet management, and modular mission suites for survey, inspection, agriculture, cargo, and search & rescue.

Learn more at [altnautica.com](https://altnautica.com).
