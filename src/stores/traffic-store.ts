/**
 * @module traffic-store
 * @description Zustand store for live ADS-B aircraft tracking, threat levels,
 * and traffic alerts for the Air Traffic tab.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type {
  AircraftState,
  TrafficAlert,
  ThreatLevel,
  BoundingBox,
} from "@/lib/airspace/types";

export type DisplayMode = "global" | "regional" | "local" | "close";

interface TrafficStoreState {
  aircraft: Map<string, AircraftState>;
  alerts: TrafficAlert[];
  threatLevels: Map<string, ThreatLevel>;
  altitudeFilter: number;
  pollInterval: number;
  boundingBox: BoundingBox | null;
  lastUpdate: number;
  polling: boolean;
  dataSource: string;
  displayMode: DisplayMode;
  connectionQuality: "good" | "degraded" | "disconnected";
  consecutiveFailures: number;
  lastError: string | null;
  selectedAircraft: string | null;
  followAircraft: string | null;
  trackedAircraft: Set<string>;
  aircraftTrails: Map<string, Array<{ lat: number; lon: number; alt: number; time: number }>>;

  updateAircraft: (aircraft: AircraftState[]) => void;
  setThreatLevels: (threats: Map<string, ThreatLevel>) => void;
  addAlert: (alert: TrafficAlert) => void;
  dismissAlert: (id: string) => void;
  setAltitudeFilter: (alt: number) => void;
  setBoundingBox: (bbox: BoundingBox | null) => void;
  setPolling: (polling: boolean) => void;
  setDataSource: (source: string) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  setConnectionQuality: (quality: "good" | "degraded" | "disconnected") => void;
  setSelectedAircraft: (icao24: string | null) => void;
  setFollowAircraft: (icao24: string | null) => void;
  toggleTracked: (icao24: string) => void;
  recordFailure: (error: string) => void;
  recordSuccess: (source: string) => void;
  clear: () => void;
}

const STALE_THRESHOLD_MS = 60_000;

export const useTrafficStore = create<TrafficStoreState>()((set, get) => ({
  aircraft: new Map<string, AircraftState>(),
  alerts: [],
  threatLevels: new Map<string, ThreatLevel>(),
  altitudeFilter: 1524,
  pollInterval: 10_000,
  boundingBox: null,
  lastUpdate: 0,
  polling: false,
  dataSource: "",
  displayMode: "global" as DisplayMode,
  connectionQuality: "disconnected",
  consecutiveFailures: 0,
  lastError: null,
  selectedAircraft: null,
  followAircraft: null,
  trackedAircraft: new Set<string>(),
  aircraftTrails: new Map<string, Array<{ lat: number; lon: number; alt: number; time: number }>>(),

  updateAircraft: (incoming) => {
    const now = Date.now();
    const merged = new Map(get().aircraft);

    for (const ac of incoming) {
      merged.set(ac.icao24, ac);
    }

    // Remove stale entries (not seen in >60s)
    // lastSeen is stored as ms-epoch from both providers
    for (const [key, ac] of merged) {
      if (now - ac.lastSeen > STALE_THRESHOLD_MS) {
        merged.delete(key);
      }
    }

    // Prune orphaned threat levels for removed aircraft
    const threats = new Map(get().threatLevels);
    for (const icao24 of threats.keys()) {
      if (!merged.has(icao24)) {
        threats.delete(icao24);
      }
    }

    // Append positions to trails for tracked aircraft
    const trails = new Map(get().aircraftTrails);
    const tracked = get().trackedAircraft;
    for (const ac of incoming) {
      if (tracked.has(ac.icao24) && ac.lat && ac.lon) {
        const trail = trails.get(ac.icao24) ?? [];
        trail.push({ lat: ac.lat, lon: ac.lon, alt: ac.altitudeMsl ?? 0, time: Date.now() });
        if (trail.length > 60) trail.shift();
        trails.set(ac.icao24, trail);
      }
    }
    // Prune trails for removed aircraft
    for (const icao24 of trails.keys()) {
      if (!merged.has(icao24)) trails.delete(icao24);
    }

    set({ aircraft: merged, threatLevels: threats, aircraftTrails: trails, lastUpdate: now });
  },

  setThreatLevels: (threatLevels) => set({ threatLevels: new Map(threatLevels) }),

  addAlert: (alert) =>
    set((s) => ({ alerts: [...s.alerts, alert] })),

  dismissAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) =>
        a.id === id ? { ...a, dismissed: true } : a
      ),
    })),

  setAltitudeFilter: (altitudeFilter) => set({ altitudeFilter }),
  setBoundingBox: (boundingBox) => set({ boundingBox }),
  setPolling: (polling) => set({ polling }),
  setDataSource: (dataSource) => set({ dataSource }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  setConnectionQuality: (connectionQuality) => set({ connectionQuality }),
  setSelectedAircraft: (selectedAircraft) => set({ selectedAircraft }),
  setFollowAircraft: (followAircraft) => set({ followAircraft }),
  toggleTracked: (icao24) => set((s) => {
    const next = new Set(s.trackedAircraft);
    if (next.has(icao24)) next.delete(icao24);
    else next.add(icao24);
    return { trackedAircraft: next };
  }),

  recordFailure: (error) => {
    const failures = get().consecutiveFailures + 1;
    set({
      consecutiveFailures: failures,
      lastError: error,
      connectionQuality: failures >= 3 ? "disconnected" : "degraded",
    });
  },

  recordSuccess: (source) =>
    set({
      consecutiveFailures: 0,
      lastError: null,
      dataSource: source,
      connectionQuality: "good",
    }),

  clear: () =>
    set({
      aircraft: new Map<string, AircraftState>(),
      alerts: [],
      threatLevels: new Map<string, ThreatLevel>(),
      altitudeFilter: 1524,
      pollInterval: 10_000,
      boundingBox: null,
      lastUpdate: 0,
      polling: false,
      dataSource: "",
      displayMode: "global" as DisplayMode,
      connectionQuality: "disconnected",
      consecutiveFailures: 0,
      lastError: null,
      selectedAircraft: null,
      followAircraft: null,
      trackedAircraft: new Set<string>(),
      aircraftTrails: new Map<string, Array<{ lat: number; lon: number; alt: number; time: number }>>(),
    }),
}));
