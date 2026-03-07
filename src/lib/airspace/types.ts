/**
 * @module airspace/types
 * @description Type definitions for the Air Traffic tab: aircraft tracking,
 * airspace zones, threat classification, and flyability assessment.
 * @license GPL-3.0-only
 */

import type { Jurisdiction } from "@/lib/jurisdiction";

// ── Aircraft State (from ADS-B providers) ──────────────────────────

export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lat: number;
  lon: number;
  altitudeMsl: number | null;
  altitudeAgl: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  squawk: string | null;
  category: number;
  lastSeen: number;
  registration?: string;
  aircraftType?: string;
}

// ── Airspace Zone Types ────────────────────────────────────────────

export type AirspaceZoneType =
  | "classB"
  | "classC"
  | "classD"
  | "classE"
  | "restricted"
  | "prohibited"
  | "moa"
  | "tfr"
  | "dgcaGreen"
  | "dgcaYellow"
  | "dgcaRed"
  | "casaRestricted"
  | "casaCaution"
  | "ctr"
  | "tma"
  | "danger"
  | "alert"
  | "warning";

export interface AirspaceZone {
  id: string;
  name: string;
  type: AirspaceZoneType;
  geometry: GeoJSONPolygon | GeoJSONMultiPolygon;
  floorAltitude: number;
  ceilingAltitude: number;
  authority: string;
  jurisdiction?: Jurisdiction;
  validFrom?: string;
  validTo?: string;
  laancCeiling?: number;
  /** Original circle parameters for geodetically correct rendering. */
  circle?: { lat: number; lon: number; radiusM: number };
  metadata: Record<string, string>;
}

/** Minimal GeoJSON polygon (avoids full GeoJSON dependency). */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface GeoJSONMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

// ── Threat Classification ──────────────────────────────────────────

export type ThreatLevel = "ra" | "ta" | "proximate" | "other";

export interface ThreatAssessment {
  icao24: string;
  level: ThreatLevel;
  cpaDistance: number;
  cpaTime: number;
  altitudeDelta: number;
}

// ── NOTAM / TFR ────────────────────────────────────────────────────

export interface Notam {
  id: string;
  title: string;
  text: string;
  issuer: string;
  effectiveFrom: string;
  effectiveTo: string;
  lat?: number;
  lon?: number;
  radius?: number;
  floorAltitude?: number;
  ceilingAltitude?: number;
}

export interface TemporaryRestriction {
  id: string;
  name: string;
  type: "tfr" | "temporary";
  geometry: GeoJSONPolygon;
  floorAltitude: number;
  ceilingAltitude: number;
  validFrom: string;
  validTo: string;
  authority: string;
  description: string;
}

// ── Traffic Alert ──────────────────────────────────────────────────

export interface TrafficAlert {
  id: string;
  icao24: string;
  callsign: string | null;
  level: ThreatLevel;
  distanceKm: number;
  altitudeDelta: number;
  timestamp: number;
  dismissed: boolean;
}

// ── Flyability Assessment ──────────────────────────────────────────

export type FlyabilityVerdict = "clear" | "advisory" | "restricted";

export interface NearestAirport {
  name: string;
  icao: string;
  distanceKm: number;
  bearing: number;
}

export interface Flyability {
  verdict: FlyabilityVerdict;
  maxAltitudeAgl: number;
  zones: AirspaceZone[];
  nearestAirport: NearestAirport | null;
  activeNotams: Notam[];
  activeTfrs: TemporaryRestriction[];
  trafficCount: number;
  guidance: string;
  ctaLinks: CtaLink[];
}

export interface CtaLink {
  label: string;
  url: string;
}

// ── Bounding Box ───────────────────────────────────────────────────

export interface BoundingBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

// ── Layer Visibility ───────────────────────────────────────────────

export interface AirTrafficLayers {
  airspace: boolean;
  traffic: boolean;
  restrictions: boolean;
  advisory: boolean;
  ownDrone: boolean;
  terrain: boolean;
  heatmap: boolean;
  trails: boolean;
}

export const DEFAULT_LAYERS: AirTrafficLayers = {
  airspace: true,
  traffic: true,
  restrictions: true,
  advisory: false,
  ownDrone: true,
  terrain: true,
  heatmap: false,
  trails: false,
};

// ── Zone Color Config ──────────────────────────────────────────────

export interface ZoneColorConfig {
  fill: string;
  fillOpacity: number;
  border: string;
  borderOpacity: number;
}

export const ZONE_COLORS: Record<AirspaceZoneType, ZoneColorConfig> = {
  classB: { fill: "#3A82FF", fillOpacity: 0.08, border: "#3A82FF", borderOpacity: 0.8 },
  classC: { fill: "#C850C0", fillOpacity: 0.08, border: "#C850C0", borderOpacity: 0.8 },
  classD: { fill: "#3A82FF", fillOpacity: 0.06, border: "#3A82FF", borderOpacity: 0.6 },
  classE: { fill: "#C850C0", fillOpacity: 0.04, border: "#C850C0", borderOpacity: 0.4 },
  restricted: { fill: "#3A82FF", fillOpacity: 0.06, border: "#3A82FF", borderOpacity: 0.7 },
  prohibited: { fill: "#FF4444", fillOpacity: 0.12, border: "#FF4444", borderOpacity: 0.9 },
  moa: { fill: "#FF8C00", fillOpacity: 0.05, border: "#FF8C00", borderOpacity: 0.5 },
  tfr: { fill: "#FF4444", fillOpacity: 0.15, border: "#FF4444", borderOpacity: 0.9 },
  dgcaGreen: { fill: "#44FF44", fillOpacity: 0.05, border: "#44FF44", borderOpacity: 0.5 },
  dgcaYellow: { fill: "#FFDD44", fillOpacity: 0.1, border: "#FFDD44", borderOpacity: 0.7 },
  dgcaRed: { fill: "#FF4444", fillOpacity: 0.15, border: "#FF4444", borderOpacity: 0.8 },
  casaRestricted: { fill: "#FF4444", fillOpacity: 0.1, border: "#FF4444", borderOpacity: 0.8 },
  casaCaution: { fill: "#FF8C00", fillOpacity: 0.08, border: "#FF8C00", borderOpacity: 0.7 },
  ctr:     { fill: "#3A82FF", fillOpacity: 0.06, border: "#3A82FF", borderOpacity: 0.6 },
  tma:     { fill: "#C850C0", fillOpacity: 0.08, border: "#C850C0", borderOpacity: 0.7 },
  danger:  { fill: "#FF8C00", fillOpacity: 0.1,  border: "#FF8C00", borderOpacity: 0.7 },
  alert:   { fill: "#FF8C00", fillOpacity: 0.06, border: "#FF8C00", borderOpacity: 0.5 },
  warning: { fill: "#FF8C00", fillOpacity: 0.08, border: "#FF8C00", borderOpacity: 0.6 },
};

// ── Threat level display config ────────────────────────────────────

export const THREAT_COLORS: Record<ThreatLevel, string> = {
  ra: "#FF4444",
  ta: "#FF8C00",
  proximate: "#3A82FF",
  other: "#888888",
};

export const THREAT_LABELS: Record<ThreatLevel, string> = {
  ra: "Resolution Advisory",
  ta: "Traffic Advisory",
  proximate: "Proximate",
  other: "Other Traffic",
};

// ── Provider result types ──────────────────────────────────────────

export interface AdsbFetchResult {
  aircraft: AircraftState[];
  timestamp: number;
  source: "adsb.lol" | "opensky";
}

export interface AirspaceFetchResult {
  zones: AirspaceZone[];
  jurisdiction: Jurisdiction;
  timestamp: number;
}
