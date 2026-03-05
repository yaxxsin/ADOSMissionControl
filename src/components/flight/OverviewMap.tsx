"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useTrailStore } from "@/stores/trail-store";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useMissionStore } from "@/stores/mission-store";
import { Pause, Play } from "lucide-react";
import { useDefaultCenter } from "@/hooks/use-default-center";
import {
  MapContainer,
  Circle,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import dynamic from "next/dynamic";
const GcsMarker = dynamic(
  () => import("@/components/map/GcsMarker").then((m) => ({ default: m.GcsMarker })),
  { ssr: false }
);
const TileLayerSwitcher = dynamic(
  () => import("@/components/map/TileLayerSwitcher").then((m) => ({ default: m.TileLayerSwitcher })),
  { ssr: false }
);
const MapContextMenu = dynamic(
  () => import("@/components/map/MapContextMenu").then((m) => ({ default: m.MapContextMenu })),
  { ssr: false }
);
const AltitudeTrail = dynamic(
  () => import("@/components/map/AltitudeTrail").then((m) => ({ default: m.AltitudeTrail })),
  { ssr: false }
);
const EditableGeofenceOverlay = dynamic(
  () => import("@/components/map/EditableGeofenceOverlay").then((m) => ({ default: m.EditableGeofenceOverlay })),
  { ssr: false }
);
const PlannedVsActualOverlay = dynamic(
  () => import("@/components/logs/PlannedVsActualOverlay").then((m) => ({ default: m.PlannedVsActualOverlay })),
  { ssr: false }
);
const LocateControl = dynamic(
  () => import("@/components/map/LocateControl").then((m) => ({ default: m.LocateControl })),
  { ssr: false }
);

/** SVG arrow icon for the drone marker, rotated by heading. */
function createDroneIcon(heading: number): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" style="transform:rotate(${heading}deg)">
      <polygon points="12,2 20,20 12,16 4,20" fill="#00ff41" fill-opacity="0.9" stroke="#00ff41" stroke-width="1"/>
    </svg>`,
  });
}

/** Tells Leaflet to recalculate its size when the container resizes. */
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);

  return null;
}

/** Auto-follows the drone position on the map. */
function MapFollower({ position, follow }: { position: [number, number] | null; follow: boolean }) {
  const map = useMap();

  useEffect(() => {
    if (follow && position) {
      map.setView(position, map.getZoom(), { animate: true, duration: 0.3 });
    }
  }, [map, position, follow]);

  return null;
}

export function OverviewMap() {
  const [follow, setFollow] = useState(true);
  const [showPlannedPath, setShowPlannedPath] = useState(false);
  const mapReadyRef = useRef(false);

  // Mission pause/resume state
  const flightMode = useDroneStore((s) => s.flightMode);
  const previousMode = useDroneStore((s) => s.previousMode);
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const missionState = useMissionStore((s) => s.activeMission?.state);
  const isAutoMode = flightMode === "AUTO";
  const isPausedFromAuto = flightMode === "LOITER" && previousMode === "AUTO";
  const showMissionControls = isAutoMode || isPausedFromAuto || missionState === "running" || missionState === "paused";

  // Subscribe to position updates
  const pos = useTelemetryStore((s) => s.position.latest());
  const trail = useTrailStore((s) => s.trail);

  const dronePos: [number, number] | null =
    pos && pos.lat !== 0 && pos.lon !== 0 ? [pos.lat, pos.lon] : null;

  const heading = pos?.heading ?? 0;
  const droneIcon = useMemo(() => createDroneIcon(heading), [heading]);

  // Home position = first trail point
  const homePos: [number, number] | null =
    trail.length > 0 ? [trail[0].lat, trail[0].lon] : null;

  const defaultCenter = useDefaultCenter();
  const hasGps = dronePos !== null;

  return (
    <div className="relative w-full h-full border border-border-default overflow-hidden bg-[#0a0a0a] isolate">
      <span className="absolute top-2 left-2 z-[1000] text-[9px] font-mono text-text-tertiary">
        Position
      </span>

      {/* No GPS overlay */}
      {!hasGps && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center pointer-events-none">
          <span className="text-xs font-mono text-text-tertiary bg-bg-secondary/80 px-3 py-1.5 border border-border-default">
            NO GPS FIX
          </span>
        </div>
      )}

      <MapContainer
        center={dronePos ?? defaultCenter}
        zoom={17}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
        whenReady={() => { mapReadyRef.current = true; }}
      >
        <TileLayerSwitcher />

        <MapResizer />
        <MapFollower position={dronePos} follow={follow} />
        <MapContextMenu />

        {/* Altitude-coded trail (falls back to blue when no alt data) */}
        <AltitudeTrail />

        {/* Interactive geofence editing */}
        <EditableGeofenceOverlay />

        {/* Planned vs actual path comparison */}
        {showPlannedPath && <PlannedVsActualOverlay />}

        {/* Home marker — dashed blue circle */}
        {homePos && (
          <Circle
            center={homePos}
            radius={3}
            pathOptions={{
              color: "#3A82FF",
              weight: 1.5,
              dashArray: "4 4",
              fillColor: "#3A82FF",
              fillOpacity: 0.15,
            }}
          />
        )}

        {/* Drone marker */}
        {dronePos && (
          <Marker position={dronePos} icon={droneIcon} />
        )}

        <GcsMarker />
        <LocateControl style={{ marginBottom: 40 }} />
      </MapContainer>

      {/* Mission pause/resume overlay — top right */}
      {showMissionControls && (
        <button
          onClick={() => {
            const protocol = getProtocol();
            if (isAutoMode) {
              if (protocol) protocol.pauseMission();
              else setFlightMode("LOITER");
            } else {
              if (protocol) protocol.resumeMission();
              else setFlightMode("AUTO");
            }
          }}
          className={`absolute top-2 right-2 z-[1000] flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-mono font-semibold border transition-colors ${
            isAutoMode
              ? "border-status-warning text-status-warning bg-status-warning/10 hover:bg-status-warning/20"
              : "border-status-success text-status-success bg-status-success/10 hover:bg-status-success/20"
          }`}
        >
          {isAutoMode ? <Pause size={12} /> : <Play size={12} />}
          {isAutoMode ? "PAUSE" : "RESUME"}
        </button>
      )}

      {/* Follow toggle + plan overlay — bottom right */}
      <div className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1">
        <button
          onClick={() => setShowPlannedPath((v) => !v)}
          className={`text-[9px] font-mono px-2 py-1 border transition-colors ${
            showPlannedPath
              ? "border-[#3A82FF] text-[#3A82FF] bg-[#3A82FF]/10"
              : "border-border-default text-text-tertiary bg-bg-secondary/80"
          }`}
        >
          PLAN
        </button>
        <button
          onClick={() => setFollow((f) => !f)}
          className={`text-[9px] font-mono px-2 py-1 border transition-colors ${
            follow
              ? "border-[#3A82FF] text-[#3A82FF] bg-[#3A82FF]/10"
              : "border-border-default text-text-tertiary bg-bg-secondary/80"
          }`}
        >
          {follow ? "FOLLOW" : "FREE"}
        </button>
      </div>

      {/* Coordinates — bottom left */}
      {dronePos && (
        <div className="absolute bottom-2 left-2 z-[1000] text-[9px] font-mono text-text-tertiary bg-bg-secondary/80 px-2 py-1 border border-border-default">
          {dronePos[0].toFixed(6)}, {dronePos[1].toFixed(6)}
        </div>
      )}
    </div>
  );
}
