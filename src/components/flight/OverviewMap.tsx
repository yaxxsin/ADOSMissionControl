"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { useTrailStore } from "@/stores/trail-store";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
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

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

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
  const mapReadyRef = useRef(false);

  // Subscribe to position updates
  const pos = useTelemetryStore((s) => s.position.latest());
  const trail = useTrailStore((s) => s.trail);

  const dronePos: [number, number] | null =
    pos && pos.lat !== 0 && pos.lon !== 0 ? [pos.lat, pos.lon] : null;

  const heading = pos?.heading ?? 0;
  const droneIcon = useMemo(() => createDroneIcon(heading), [heading]);

  const trailPositions: [number, number][] = useMemo(
    () => trail.map((p) => [p.lat, p.lon] as [number, number]),
    [trail]
  );

  // Home position = first trail point
  const homePos: [number, number] | null =
    trail.length > 0 ? [trail[0].lat, trail[0].lon] : null;

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
        center={dronePos ?? BANGALORE_CENTER}
        zoom={17}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
        whenReady={() => { mapReadyRef.current = true; }}
      >
        <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />

        <MapFollower position={dronePos} follow={follow} />

        {/* Trail polyline */}
        {trailPositions.length >= 2 && (
          <Polyline
            positions={trailPositions}
            pathOptions={{ color: "#3A82FF", weight: 2, opacity: 0.7 }}
          />
        )}

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
      </MapContainer>

      {/* Follow toggle — bottom right */}
      <button
        onClick={() => setFollow((f) => !f)}
        className={`absolute bottom-2 right-2 z-[1000] text-[9px] font-mono px-2 py-1 border transition-colors ${
          follow
            ? "border-[#3A82FF] text-[#3A82FF] bg-[#3A82FF]/10"
            : "border-border-default text-text-tertiary bg-bg-secondary/80"
        }`}
      >
        {follow ? "FOLLOW" : "FREE"}
      </button>

      {/* Coordinates — bottom left */}
      {dronePos && (
        <div className="absolute bottom-2 left-2 z-[1000] text-[9px] font-mono text-text-tertiary bg-bg-secondary/80 px-2 py-1 border border-border-default">
          {dronePos[0].toFixed(6)}, {dronePos[1].toFixed(6)}
        </div>
      )}
    </div>
  );
}
