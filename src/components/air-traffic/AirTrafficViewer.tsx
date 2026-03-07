/**
 * @module AirTrafficViewer
 * @description Composition root for the Air Traffic 3D view.
 * Renders CesiumJS globe with airspace zones, live aircraft, drone position,
 * and all control panels/overlays. Manages traffic polling lifecycle and
 * flyability assessment on globe click.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import type { Viewer as CesiumViewer } from "cesium";
import dynamic from "next/dynamic";
import { useAirspaceStore } from "@/stores/airspace-store";
import { useTrafficStore } from "@/stores/traffic-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { communityApi } from "@/lib/community-api";
import { fetchAircraft } from "@/lib/airspace/adsb-provider";
import { loadAirspaceZones } from "@/lib/airspace/airspace-provider";
import { computeAllThreats } from "@/lib/airspace/threat-calculator";
import { assessFlyability } from "@/lib/airspace/flyability";
import { isDemoMode, randomId } from "@/lib/utils";
import type { AircraftState, ThreatLevel, TrafficAlert } from "@/lib/airspace/types";

import { AirspaceVolumeEntities } from "./entities/AirspaceVolumeEntities";
import { AircraftEntities } from "./entities/AircraftEntities";
import { DronePositionEntity } from "./entities/DronePositionEntity";
import { NotamEntities } from "./entities/NotamEntities";
import { ZoneBoundaryEntities } from "./entities/ZoneBoundaryEntities";
import { LayerControlPanel } from "./panels/LayerControlPanel";
import { AirspaceInfoPanel } from "./panels/AirspaceInfoPanel";
import { AlertsPanel } from "./panels/AlertsPanel";
import { LocationSearchPanel } from "./panels/LocationSearchPanel";
import { FlyabilityOverlay } from "./overlays/FlyabilityOverlay";
import { AltitudeSlider } from "./overlays/AltitudeSlider";
import { TimelineScrubber } from "./overlays/TimelineScrubber";
import { AirTrafficMapControls } from "./controls/AirTrafficMapControls";
import { AirTrafficToolbar } from "./controls/AirTrafficToolbar";

const CesiumScene = dynamic(
  () => import("@/components/simulation/CesiumScene"),
  { ssr: false }
);

/** Fetches Cesium Ion token from Convex. */
function ConvexCesiumToken({ onToken }: { onToken: (token: string | null) => void }) {
  const config = useQuery(communityApi.clientConfig.get, {});
  useEffect(() => {
    if (config !== undefined) {
      onToken((config as { cesiumIonToken?: string } | null)?.cesiumIonToken ?? null);
    }
  }, [config, onToken]);
  return null;
}

// ── Demo mode mock aircraft ──────────────────────────────────────────

const MOCK_AIRCRAFT_SEEDS: Array<{
  icao24: string; callsign: string; lat: number; lon: number;
  alt: number; heading: number; velocity: number; country: string;
}> = [
  { icao24: "a0b1c2", callsign: "UAL123", lat: 13.22, lon: 77.68, alt: 3048, heading: 45, velocity: 120, country: "United States" },
  { icao24: "d3e4f5", callsign: "AIC456", lat: 13.18, lon: 77.73, alt: 1524, heading: 180, velocity: 90, country: "India" },
  { icao24: "f6a7b8", callsign: "BAW789", lat: 13.25, lon: 77.65, alt: 6096, heading: 270, velocity: 200, country: "United Kingdom" },
  { icao24: "c9d0e1", callsign: "SIA321", lat: 13.15, lon: 77.75, alt: 914, heading: 90, velocity: 70, country: "Singapore" },
  { icao24: "b2c3d4", callsign: "QFA654", lat: 13.21, lon: 77.71, alt: 2438, heading: 135, velocity: 150, country: "Australia" },
  { icao24: "e5f6a7", callsign: "DLH987", lat: 13.23, lon: 77.69, alt: 4572, heading: 315, velocity: 180, country: "Germany" },
  { icao24: "a8b9c0", callsign: "JAL159", lat: 13.19, lon: 77.72, alt: 762, heading: 225, velocity: 60, country: "Japan" },
];

function generateMockAircraft(tickCount: number): AircraftState[] {
  return MOCK_AIRCRAFT_SEEDS.map((seed) => {
    const headingRad = (seed.heading * Math.PI) / 180;
    const dist = tickCount * seed.velocity * 0.00001; // small movement per tick
    return {
      icao24: seed.icao24,
      callsign: seed.callsign,
      originCountry: seed.country,
      lat: seed.lat + dist * Math.cos(headingRad),
      lon: seed.lon + dist * Math.sin(headingRad),
      altitudeMsl: seed.alt + Math.sin(tickCount * 0.1) * 50,
      altitudeAgl: null,
      velocity: seed.velocity,
      heading: seed.heading,
      verticalRate: Math.sin(tickCount * 0.2) * 2,
      squawk: null,
      category: 1,
      lastSeen: Date.now(),
    };
  });
}

// ── Alert deduplication ──────────────────────────────────────────────

const ALERT_COOLDOWN_MS = 30_000;

export function AirTrafficViewer() {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const convexAvailable = useConvexAvailable();
  const [cesiumToken, setCesiumToken] = useState<string | undefined>(undefined);
  const handleCesiumToken = useCallback((t: string | null) => {
    setCesiumToken(t ?? undefined);
  }, []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(0);
  const lastAlertRef = useRef<Map<string, number>>(new Map());

  // Settings
  const cesiumImageryMode = useSettingsStore((s) => s.cesiumImageryMode);
  const cesiumBuildingsEnabled = useSettingsStore((s) => s.cesiumBuildingsEnabled);
  const terrainExaggeration = useSettingsStore((s) => s.terrainExaggeration);
  const jurisdiction = useSettingsStore((s) => s.jurisdiction);

  // Store actions
  const setZones = useAirspaceStore((s) => s.setZones);
  const setLoading = useAirspaceStore((s) => s.setLoading);
  const setError = useAirspaceStore((s) => s.setError);
  const setSelectedPoint = useAirspaceStore((s) => s.setSelectedPoint);
  const setFlyability = useAirspaceStore((s) => s.setFlyability);
  const airspaceLoading = useAirspaceStore((s) => s.loading);
  const updateAircraft = useTrafficStore((s) => s.updateAircraft);
  const setThreatLevels = useTrafficStore((s) => s.setThreatLevels);
  const addAlert = useTrafficStore((s) => s.addAlert);
  const setPolling = useTrafficStore((s) => s.setPolling);

  const handleViewerReady = useCallback((v: CesiumViewer) => setViewer(v), []);

  // ── Load airspace zones when jurisdiction changes ──
  useEffect(() => {
    if (!jurisdiction) return;

    setLoading(true);
    setError(null);

    const bbox = { south: -60, north: 70, west: -180, east: 180 };

    loadAirspaceZones(jurisdiction, bbox)
      .then((zones) => {
        setZones(zones);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load airspace data");
        setLoading(false);
      });
  }, [jurisdiction, setZones, setLoading, setError]);

  // ── Traffic polling ──
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const pollInterval = useTrafficStore.getState().pollInterval;
    const demo = isDemoMode();
    setPolling(true);

    async function poll() {
      if (viewer!.isDestroyed()) return;

      tickRef.current++;
      let aircraftResult: AircraftState[];

      if (demo) {
        // Demo mode: generate mock aircraft without hitting real APIs
        aircraftResult = generateMockAircraft(tickRef.current);
      } else {
        // Real mode: fetch from ADS-B providers
        // Runtime Cesium import for SSR-safe usage in Next.js
        const Cesium = require("cesium");
        const camera = viewer!.camera;
        const cartographic = Cesium.Cartographic.fromCartesian(camera.positionWC);
        const lat = Cesium.Math.toDegrees(cartographic.latitude);
        const lon = Cesium.Math.toDegrees(cartographic.longitude);

        try {
          const result = await fetchAircraft(lat, lon, 50);
          aircraftResult = result.aircraft;
        } catch {
          return; // Silently ignore poll failures
        }
      }

      updateAircraft(aircraftResult);

      // Compute threats relative to drone position (if connected) or camera center
      const Cesium = require("cesium");
      const cartographic = Cesium.Cartographic.fromCartesian(viewer!.camera.positionWC);
      const camLat = Cesium.Math.toDegrees(cartographic.latitude);
      const camLon = Cesium.Math.toDegrees(cartographic.longitude);

      const telPos = useTelemetryStore.getState().position.latest();
      const refLat = telPos?.lat ?? camLat;
      const refLon = telPos?.lon ?? camLon;
      const refAlt = telPos?.alt ?? 0;

      const threats = computeAllThreats(refLat, refLon, refAlt, aircraftResult);
      const threatMap = new Map<string, ThreatLevel>();
      for (const t of threats) {
        threatMap.set(t.icao24, t.level);
      }
      setThreatLevels(threatMap);

      // Generate alerts for RA/TA threats (deduplicated with 30s cooldown)
      const now = Date.now();
      for (const t of threats) {
        if (t.level !== "ra" && t.level !== "ta") continue;
        const lastAlert = lastAlertRef.current.get(t.icao24);
        if (lastAlert && now - lastAlert < ALERT_COOLDOWN_MS) continue;

        lastAlertRef.current.set(t.icao24, now);
        const ac = aircraftResult.find((a) => a.icao24 === t.icao24);
        const alert: TrafficAlert = {
          id: randomId(),
          icao24: t.icao24,
          callsign: ac?.callsign ?? null,
          level: t.level,
          distanceKm: t.cpaDistance / 1000,
          altitudeDelta: t.altitudeDelta,
          timestamp: now,
          dismissed: false,
        };
        addAlert(alert);
      }
    }

    poll();
    pollRef.current = setInterval(poll, pollInterval);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      setPolling(false);
    };
  }, [viewer, updateAircraft, setThreatLevels, addAlert, setPolling]);

  // ── Consolidated click handler (globe + aircraft) ──
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Runtime Cesium import for SSR-safe usage in Next.js
    const Cesium = require("cesium");
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handler.setInputAction((click: any) => {
      const picked = viewer.scene.pick(click.position);

      // Aircraft click: show info via Cesium's built-in info box
      if (Cesium.defined(picked) && picked.id?.id?.startsWith?.("aircraft-")) {
        // Cesium's default selectedEntity behavior handles the info box
        return;
      }

      // Entity click (zone, notam, etc): let Cesium handle it
      if (Cesium.defined(picked) && picked.id) return;

      // Globe click: flyability assessment
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;

      const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(cartographic.latitude);
      const lon = Cesium.Math.toDegrees(cartographic.longitude);

      setSelectedPoint({ lat, lon });

      const state = useAirspaceStore.getState();
      const trafficState = useTrafficStore.getState();
      const result = assessFlyability(
        lat,
        lon,
        state.zones,
        state.notams,
        state.tfrs,
        Array.from(trafficState.aircraft.values()),
        jurisdiction
      );
      setFlyability(result);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
    };
  }, [viewer, jurisdiction, setSelectedPoint, setFlyability]);

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      useAirspaceStore.getState().clear();
      useTrafficStore.getState().clear();
    };
  }, []);

  return (
    <div className="flex-1 relative min-w-0 h-full">
      {convexAvailable && <ConvexCesiumToken onToken={handleCesiumToken} />}
      <CesiumScene
        cesiumToken={cesiumToken}
        onReady={handleViewerReady}
        onError={(e) => setViewerError(e.message)}
        imageryMode={cesiumImageryMode}
        buildingsEnabled={cesiumBuildingsEnabled}
        terrainExaggeration={terrainExaggeration}
      />

      {/* Entity layers */}
      <AirspaceVolumeEntities viewer={viewer} />
      <AircraftEntities viewer={viewer} />
      <DronePositionEntity viewer={viewer} />
      <NotamEntities viewer={viewer} />
      <ZoneBoundaryEntities viewer={viewer} />

      {/* Overlays */}
      <FlyabilityOverlay />
      <AltitudeSlider />
      <TimelineScrubber />

      {/* Panels */}
      <LayerControlPanel />
      <AirspaceInfoPanel />
      <AlertsPanel />
      <LocationSearchPanel viewer={viewer} />

      {/* Controls */}
      <AirTrafficMapControls hasIonToken={!!cesiumToken} />
      <AirTrafficToolbar viewer={viewer} />

      {/* No jurisdiction selected */}
      {viewer && !jurisdiction && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-bg-primary/80 backdrop-blur-md rounded-lg px-4 py-2 border border-border-default text-center">
            <p className="text-xs text-text-secondary">
              Set your jurisdiction in <span className="text-accent-primary">Settings</span> to see airspace data
            </p>
          </div>
        </div>
      )}

      {/* Zone loading indicator */}
      {airspaceLoading && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 bg-bg-primary/80 backdrop-blur-md rounded-lg px-4 py-2 border border-border-default">
            <div className="w-3 h-3 border border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            <p className="text-xs text-text-secondary">Loading airspace zones...</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!viewer && !viewerError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent-primary/30 border-t-accent-primary rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Initializing 3D view...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {viewerError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-bg-primary/80 backdrop-blur-md rounded-lg px-6 py-4 border border-red-500/30 text-center max-w-sm">
            <p className="text-sm text-red-400">3D view failed: {viewerError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
