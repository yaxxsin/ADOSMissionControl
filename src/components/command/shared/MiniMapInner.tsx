"use client";

/**
 * @module MiniMapInner
 * @description Inner Leaflet map component for MiniMapView (dynamically imported, no SSR).
 * @license GPL-3.0-only
 */

import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

export default function MiniMapInner() {
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={15}
      style={{ width: "100%", height: "100%" }}
      zoomControl={false}
      attributionControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <CircleMarker
        center={DEFAULT_CENTER}
        radius={5}
        pathOptions={{ color: "#3A82FF", fillColor: "#3A82FF", fillOpacity: 1, weight: 2 }}
      />
    </MapContainer>
  );
}
