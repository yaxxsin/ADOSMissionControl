/**
 * @module airspace/openaip-provider
 * @description Fetches real airspace boundary polygons from the OpenAIP API.
 * Provides irregular GeoJSON polygons instead of circle approximations.
 * Data licensed CC BY-NC 4.0 (attribution required).
 * @license GPL-3.0-only
 */

import type { AirspaceZone, AirspaceZoneType, GeoJSONPolygon } from "./types";
import type { Jurisdiction } from "@/lib/jurisdiction";

// ── OpenAIP response types ───────────────────────────────────────────

interface OpenAIPLimit {
  value: number;
  unit: number;       // 0=Meter, 1=Feet, 6=Flight Level
  referenceDatum: number; // 0=GND, 1=MSL, 2=STD
}

interface OpenAIPAirspace {
  _id: string;
  name: string;
  type: number;
  icaoClass: number;
  country: string;
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  upperLimit: OpenAIPLimit;
  lowerLimit: OpenAIPLimit;
  activity?: number;
  byNotam?: boolean;
  onDemand?: boolean;
  frequencies?: Array<{ value: string; unit: number; name: string; primary: boolean }>;
  remarks?: string;
}

interface OpenAIPResponse {
  items: OpenAIPAirspace[];
  totalCount: number;
  totalPages: number;
  page: number;
  limit: number;
}

// ── Session cache ────────────────────────────────────────────────────

const cache = new Map<string, AirspaceZone[]>();

// ── Public API ───────────────────────────────────────────────────────

export async function fetchOpenAIPAirspaces(
  countries: string[],
  apiKey: string,
): Promise<AirspaceZone[]> {
  const results: AirspaceZone[] = [];

  for (const country of countries) {
    if (cache.has(country)) {
      results.push(...cache.get(country)!);
      continue;
    }

    try {
      const zones = await fetchCountryAirspaces(country, apiKey);
      if (cache.size > 20) cache.clear();
      cache.set(country, zones);
      results.push(...zones);
    } catch (err) {
      console.warn(`[openaip] Failed to fetch ${country}:`, err);
    }
  }

  return results;
}

// ── Internal helpers ─────────────────────────────────────────────────

async function fetchCountryAirspaces(
  country: string,
  apiKey: string,
): Promise<AirspaceZone[]> {
  const zones: AirspaceZone[] = [];
  let page = 1;
  const limit = 200;

  // Relevant airspace types: CTR, TMA, CTA, Restricted, Prohibited, Danger, ATZ, Alert, Warning
  const types = [1, 2, 3, 4, 7, 13, 17, 18, 26];

  while (true) {
    const params = new URLSearchParams({
      country,
      page: String(page),
      limit: String(limit),
      types: types.join(","),
    });
    if (apiKey) {
      params.set("apiKey", apiKey);
    }

    const url = `/api/airspace/openaip?${params.toString()}`;
    const resp = await fetch(url);

    if (!resp.ok) {
      throw new Error(`OpenAIP ${country} page ${page}: ${resp.status} ${resp.statusText}`);
    }

    const data: OpenAIPResponse = await resp.json();

    for (const item of data.items) {
      const zone = mapToAirspaceZone(item);
      if (zone) zones.push(zone);
    }

    if (page >= data.totalPages) break;
    page++;
  }

  console.log(`[openaip] ${country}: ${zones.length} airspace zones`);
  return zones;
}

function mapToAirspaceZone(item: OpenAIPAirspace): AirspaceZone | null {
  const type = mapOpenAIPType(item.type, item.icaoClass);
  if (!type) return null;

  const geometry: GeoJSONPolygon = {
    type: "Polygon",
    coordinates: item.geometry.coordinates,
  };

  const floorAltitude = convertAltitude(item.lowerLimit);
  const ceilingAltitude = convertAltitude(item.upperLimit);
  const jurisdiction = mapCountryToJurisdiction(item.country);

  const metadata: Record<string, string> = {
    source: "openaip",
    country: item.country,
    openAipType: String(item.type),
    icaoClass: String(item.icaoClass),
  };

  if (item.remarks) metadata.remarks = item.remarks;
  if (item.byNotam) metadata.byNotam = "true";
  if (item.onDemand) metadata.onDemand = "true";
  if (item.frequencies?.length) {
    const primary = item.frequencies.find((f) => f.primary) ?? item.frequencies[0];
    if (primary) metadata.frequency = primary.value;
  }

  return {
    id: `openaip-${item._id}`,
    name: item.name,
    type,
    geometry,
    floorAltitude,
    ceilingAltitude,
    authority: mapCountryToAuthority(item.country),
    jurisdiction,
    metadata,
  };
}

function mapOpenAIPType(type: number, icaoClass: number): AirspaceZoneType | null {
  switch (type) {
    case 4: // CTR
      if (icaoClass === 1) return "classB";
      if (icaoClass === 2) return "classC";
      if (icaoClass === 3) return "classD";
      return "ctr";
    case 7: // TMA
      return "tma";
    case 26: // CTA
      if (icaoClass === 0) return "classB"; // Class A mapped to B for vis
      if (icaoClass === 1) return "classB";
      if (icaoClass === 2) return "classC";
      if (icaoClass === 3) return "classD";
      if (icaoClass === 4) return "classE";
      return "ctr";
    case 1: // Restricted
      return "restricted";
    case 3: // Prohibited
      return "prohibited";
    case 2: // Danger
      return "danger";
    case 13: // ATZ
      return "classD";
    case 17: // Alert
      return "alert";
    case 18: // Warning
      return "warning";
    default:
      return null;
  }
}

function convertAltitude(limit: OpenAIPLimit): number {
  const { value, unit, referenceDatum } = limit;

  if (unit === 6) {
    // Flight Level (hundreds of feet, STD pressure)
    return value * 30.48;
  }

  if (unit === 1) {
    // Feet
    const meters = value * 0.3048;
    // GND reference: treat as AGL (use as-is for floor/ceiling estimate)
    if (referenceDatum === 0) return meters;
    return meters; // MSL or STD
  }

  // unit === 0: Meters
  return value;
}

function mapCountryToJurisdiction(country: string): Jurisdiction | undefined {
  const map: Record<string, Jurisdiction> = {
    US: "faa",
    IN: "dgca",
    AU: "casa",
    GB: "caa_uk",
    DE: "easa",
    FR: "easa",
    ES: "easa",
    IT: "easa",
    NL: "easa",
    BE: "easa",
    AT: "easa",
    CH: "easa",
    JP: "jcab",
    CA: "tcca",
    CN: "caac",
  };
  return map[country];
}

function mapCountryToAuthority(country: string): string {
  const map: Record<string, string> = {
    US: "FAA",
    IN: "DGCA",
    AU: "CASA",
    GB: "CAA UK",
    DE: "DFS/EASA",
    FR: "DGAC/EASA",
    ES: "AESA/EASA",
    IT: "ENAC/EASA",
    JP: "JCAB",
    CA: "TCCA",
    CN: "CAAC",
  };
  return map[country] ?? "ICAO";
}
