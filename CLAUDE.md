# CLAUDE.md — Altnautica Command GCS

> Agentic coding instructions for AI coding agents. See [README.md](README.md) for architecture and features. See [CONTRIBUTING.md](CONTRIBUTING.md) for PR guidelines.

---

## Quick Context

- **Stack:** Next.js 16 (App Router) + React 19 + Zustand 5 + Tailwind v4 + TypeScript strict
- **Protocol:** Custom MAVLink v2 binary parser/encoder, `DroneProtocol` abstraction interface
- **Stores:** 22 Zustand stores with ring-buffered telemetry
- **FC panels:** 25 configuration panels + 10 shared infra components
- **MAVLink:** 46 message decoders, 17 MAV_CMD handlers
- **Firmware:** ArduPilot (full), PX4 (partial), Betaflight/iNav (stubs)
- **Port:** 4000 (dev, demo, and production)
- **License:** GPL-3.0-only

```bash
npm run dev      # Dev server, no demo data
npm run demo     # Dev server with 5 simulated drones
npm run build    # Production build
npm run lint     # ESLint
```

---

## File Conventions

| Type | Naming | Location |
|------|--------|----------|
| FC panel component | `PascalCase` + `Panel` suffix | `src/components/fc/` |
| Indicator component | `PascalCase` + `Indicator` suffix | `src/components/indicators/` |
| Zustand store | `kebab-case` + `-store` suffix | `src/stores/` |
| Custom hook | `use-kebab-case` | `src/hooks/` |
| Protocol types | — | `src/lib/protocol/types.ts` |
| MAVLink decoder | in `mavlink-parser.ts` | `src/lib/protocol/mavlink-parser.ts` |
| MAVLink encoder | in `mavlink-encoder.ts` | `src/lib/protocol/mavlink-encoder.ts` |
| Firmware handler | `firmware-{name}.ts` | `src/lib/protocol/` |
| Board profile | in `board-profiles.ts` | `src/lib/board-profiles.ts` |
| Mock params | in `mock-params.ts` | `src/mock/mock-params.ts` |
| Mock protocol | in `mock-protocol.ts` | `src/mock/mock-protocol.ts` |

---

## Core Rules

These are non-negotiable. Violating any of these will break the codebase or waste review cycles.

1. **Always go through `DroneProtocol`** — Never call MAVLink or MSP functions directly from components. All FC operations go through the `DroneProtocol` interface (`src/lib/protocol/types.ts`). The adapter pattern is the entire architecture.

2. **Use `usePanelParams` for FC panels** — Every panel that reads/writes FC parameters must use the `usePanelParams` hook (`src/hooks/use-panel-params.ts`). It handles batched loading, retry, dirty tracking, RAM writes, and flash commit. Never call `protocol.getParameter()` / `protocol.setParameter()` directly from panel components.

3. **Ring buffers for telemetry** — All time-series telemetry data uses `RingBuffer<T>` (`src/lib/ring-buffer.ts`). Never use unbounded arrays for telemetry. A 30-minute flight at 10 Hz = 18,000 entries per channel — without ring buffers, memory grows without bound.

4. **Mock everything in demo mode** — Every new feature must work in demo mode (`npm run demo`). New FC panels need mock params in `src/mock/mock-params.ts` (type: 9 for all). New protocol methods need stubs in `src/mock/mock-protocol.ts`. Check `isDemoMode()` from `src/lib/utils.ts` when needed.

5. **No `any` types** — TypeScript strict mode is on. Use proper types. The `DroneProtocol` interface, callback types, and store types are all fully typed. If you need a type, it probably already exists in `src/lib/protocol/types.ts` or `src/lib/types.ts`.

6. **Dark-first UI** — All components use the dark theme CSS variables. Background: `bg-surface-primary` (near-black). Text: `text-text-primary` (white). Accent: `text-accent-primary` (electric blue). Never use hardcoded colors. Never use `bg-white` or `text-black`.

7. **Safety guards are mandatory** — Any panel that writes params must respect `use-armed-lock` (blocks writes while armed) and `use-unsaved-guard` (warns on navigation with dirty params). Use `PanelHeader` (`src/components/fc/PanelHeader.tsx`) for consistent loading/error/refresh UI.

8. **ArduPilot auto-saves to EEPROM** — `PARAM_SET` triggers `vp->save()` to EEPROM immediately (confirmed from ArduPilot `GCS_Param.cpp`). `commitParamsToFlash()` fires `MAV_CMD_PREFLIGHT_STORAGE` as belt-and-suspenders but is fire-and-forget (no blocking ACK wait). Never block on the flash commit ACK.

9. **`"use client"` on all interactive components** — Next.js App Router defaults to Server Components. Any component that uses hooks, event handlers, or browser APIs needs the `"use client"` directive at the top. All FC panels, indicators, and store consumers are client components.

10. **Zustand selectors — subscribe to what you need** — Use `useStore((s) => s.field)` selector pattern, not `useStore()` which re-renders on any state change. For protocol access: `useDroneManager((s) => s.getSelectedProtocol)`.

---

## Checklist: New FC Panel

1. Create `src/components/fc/MyNewPanel.tsx` with `"use client"` directive
2. Define `paramNames` array and optional `optionalParams` array for all FC parameters the panel reads
3. Call `usePanelParams({ paramNames, optionalParams, panelId: "my-new-panel", autoLoad: false })`
4. Use `PanelHeader` component with `loading`, `loadProgress`, `hasLoaded`, `error`, `missingOptional`, and `onRead: refresh`
5. Render param values from the `params` Map. Use `setLocalValue()` for edits, `saveAllToRam()` for save, `commitToFlash()` for flash
6. Add mock params to `src/mock/mock-params.ts` — one `{ name, value, type: 9 }` entry per parameter
7. Wire the panel into the FC configuration tab navigation (check existing panels for the pattern)
8. Add `useArmedLock()` — disable all writes when the vehicle is armed
9. Test in demo mode: `npm run demo` → navigate to the panel → "Read from FC" → edit → save → flash
10. If the panel needs a new protocol method, follow the "New MAVLink Decoder" checklist below

---

## Checklist: New MAVLink Message Decoder

1. Add the message ID and `CRC_EXTRA` to the CRC map in `src/lib/protocol/mavlink-parser.ts`
2. Add a decoder case in the parser's `decodePayload()` switch — extract fields from the `DataView` using little-endian reads
3. Define the callback type in `src/lib/protocol/types.ts` (e.g., `export type MyNewCallback = (data: { ... }) => void`)
4. Add `onMyNew(callback: MyNewCallback): () => void` to the `DroneProtocol` interface
5. Implement the callback array + emit in `src/lib/protocol/mavlink-adapter.ts`
6. Add the stub implementation in `src/mock/mock-protocol.ts` (return `() => {}` for the unsubscribe)
7. If the message needs encoding (outbound), add the encoder function in `src/lib/protocol/mavlink-encoder.ts`
8. Bridge into a Zustand store via `bridgeTelemetry()` in `src/stores/drone-manager.ts` if it's telemetry data

---

## Checklist: New Zustand Store

1. Create `src/stores/my-new-store.ts`
2. Define the state interface and actions interface
3. Use `create<State>()` from `zustand` — no middleware unless genuinely needed
4. For telemetry data: use `RingBuffer<T>` with a fixed capacity (e.g., 1000 for 10 Hz × 100s)
5. Add a `clear()` method for connection reset
6. Wire into `bridgeTelemetry()` in `src/stores/drone-manager.ts` if the store receives protocol callbacks
7. Use selectors in consuming components: `useMyNewStore((s) => s.specificField)`

---

## Checklist: New Indicator Component

1. Create `src/components/indicators/MyNewIndicator.tsx` with `"use client"` directive
2. Subscribe to the relevant store with a selector
3. Use `useTelemetryFreshness()` hook for stale-data detection if the indicator shows live telemetry
4. Follow the existing indicator pattern: small, self-contained, single concern
5. Use status colors: `text-status-success` (green), `text-status-warning` (yellow), `text-status-error` (red)

---

## Checklist: New Board Profile

1. Add a new `BoardProfile` entry in `src/lib/board-profiles.ts`
2. Set `boardIds` from ArduPilot `AP_HAL_ChibiOS/hwdef/` board config for auto-detection
3. Map all outputs to their STM32 timer groups in `timerGroups` (each sub-array = outputs sharing a timer)
4. Set `protocols` per group: `'PWM'`, `'DShot'`, or `'Both'`
5. Add `outputNotes` for special outputs (solder pads, LED pads, etc.)
6. Test: connect to the board (or mock it) → open OutputsPanel → verify timer group diagram renders correctly

---

## Key Files

When you need to understand a system, read these files:

| To understand... | Read |
|-----------------|------|
| Protocol abstraction | `src/lib/protocol/types.ts` — `DroneProtocol` interface (760 lines, every FC operation) |
| MAVLink binary parsing | `src/lib/protocol/mavlink-parser.ts` — CRC_EXTRA map, frame decoder, 46 message types |
| MAVLink binary encoding | `src/lib/protocol/mavlink-encoder.ts` — outbound message construction |
| MAVLink adapter | `src/lib/protocol/mavlink-adapter.ts` — `DroneProtocol` implementation for MAVLink |
| Firmware-specific behavior | `src/lib/protocol/firmware-ardupilot.ts` — mode maps, capabilities, param names |
| FC panel param loading | `src/hooks/use-panel-params.ts` — `PanelParamOptions` interface, batch loading, dirty tracking |
| Connection lifecycle | `src/stores/drone-manager.ts` — `ManagedDrone`, `bridgeTelemetry()`, add/remove/select |
| Telemetry stores | `src/stores/telemetry-store.ts` — ring-buffered attitude, position, battery, GPS, etc. |
| Ring buffer | `src/lib/ring-buffer.ts` — `RingBuffer<T>` class (70 lines) |
| Demo mode engine | `src/mock/engine.ts` — 5 simulated drones, realistic flight data |
| Mock FC protocol | `src/mock/mock-protocol.ts` — full `DroneProtocol` impl for demo mode |
| Mock parameters | `src/mock/mock-params.ts` — ~200 realistic ArduCopter params (all type: 9) |
| Board profiles | `src/lib/board-profiles.ts` — 9 board profiles, STM32 timer groups |
| Timer group diagram | `src/components/fc/TimerGroupDiagram.tsx` — visual timer group conflict detection |
| Shared panel UI | `src/components/fc/PanelHeader.tsx` — loading/error/refresh header for all FC panels |
| Utility functions | `src/lib/utils.ts` — `cn()`, `isDemoMode()`, `formatDate()`, `clamp()` |

---

## Gotchas

- **`getParameter()` returns `{ value, type, index, count }`** — not just a number. Access `.value` for the numeric value.
- **All mock params use `type: 9`** (`MAV_PARAM_TYPE_REAL32`). Even integer-valued params like `FLTMODE1` are stored as floats — this matches real ArduPilot behavior.
- **`paramNames` must be stable** — `usePanelParams` memoizes on the array reference. Define `paramNames` as a module-level `const`, not inline in the component. Otherwise you get infinite re-render loops.
- **`optionalParams` fail silently** — They don't trigger error state when the FC doesn't have them. Use for params that exist on some firmware builds but not others (e.g., `CAM1_*`, `MNT1_*`, `BATT2_*`).
- **WebSerial is Chrome-only** — `navigator.serial` exists only in Chromium browsers (Chrome 89+, Edge 89+). Feature-detect before offering the option.
- **`commitParamsToFlash()` is fire-and-forget** — Do not `await` and check for ACK success. ArduPilot doesn't reliably ACK `MAV_CMD_PREFLIGHT_STORAGE`. The `usePanelParams` hook handles this correctly already.
- **CRC_EXTRA must match the MAVLink XML** — If you add a new message decoder and the CRC_EXTRA is wrong, every frame for that message will silently fail CRC validation and be dropped. Use the MAVLink generator or reference the XML definition.
- **Ring buffer `.toArray()` copies** — It returns a new array every call. Don't call it in render paths without memoization.
- **`isDemoMode()` checks both env var and URL param** — `NEXT_PUBLIC_DEMO_MODE=true` or `?demo=true` in the URL. Either activates the mock engine.
- **Never import from `src/mock/` in production code paths** — Mock modules should only be loaded when `isDemoMode()` is true. Use dynamic imports or conditional requires.
- **Zustand `getState()` is synchronous** — Use it in callbacks and event handlers. Use selectors (`useStore(s => s.field)`) in React components for reactivity.
- **Electron: no proxy needed for standalone** — The Next.js standalone server serves `/_next/static/*` natively when `.next/static/` is copied into the standalone directory. No HTTP proxy layer required. `server.ts` just forks the standalone server on a single port. Always use `127.0.0.1` (not `localhost`) to avoid IPv6 resolution issues on macOS.
- **Electron: always use `127.0.0.1`** — `window.ts`, `main.ts`, and `server.ts` all use `127.0.0.1` instead of `localhost`. macOS can resolve `localhost` to `::1` (IPv6), causing ECONNREFUSED when the server only listens on IPv4.
