"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((m) => m.TileLayer),
  { ssr: false }
);
const GcsMarker = dynamic(
  () => import("@/components/map/GcsMarker").then((m) => ({ default: m.GcsMarker })),
  { ssr: false }
);

interface MapWrapperProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
}

const BANGALORE_CENTER: [number, number] = [12.9716, 77.5946];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>';

export function MapWrapper({
  center = BANGALORE_CENTER,
  zoom = 12,
  className = "w-full h-full",
  children,
}: MapWrapperProps) {
  return (
    <div className="isolate w-full h-full">
      <MapContainer
        center={center}
        zoom={zoom}
        className={className}
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
      >
        <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
        {children}
        <GcsMarker />
      </MapContainer>
    </div>
  );
}
