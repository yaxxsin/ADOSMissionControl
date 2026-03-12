/**
 * @module airspace/adsb-provider
 * @description ADS-B data providers. Fetches live aircraft positions from
 * adsb.lol (primary, no auth) and OpenSky Network (fallback, rate-limited).
 * Normalizes both sources to AircraftState[].
 * @license GPL-3.0-only
 */

import type { AircraftState, AdsbFetchResult, BoundingBox } from "./types";

const FEET_TO_METERS = 0.3048;

// ── adsb.lol provider ────────────────────────────────────────────────

export async function fetchFromAdsbLol(
  lat: number,
  lon: number,
  radiusNm: number = 25,
): Promise<AdsbFetchResult> {
  try {
    const url = `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radiusNm}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      return { aircraft: [], timestamp: Date.now(), source: "adsb.lol" };
    }

    const data = await res.json();
    const ac: unknown[] = data.ac ?? [];

    const aircraft: AircraftState[] = ac
      .map((a: any) => ({
        icao24: String(a.hex ?? "").toLowerCase(),
        callsign: typeof a.flight === "string" ? a.flight.trim() || null : null,
        originCountry: "",
        lat: Number(a.lat) || 0,
        lon: Number(a.lon) || 0,
        altitudeMsl:
          a.alt_baro != null && a.alt_baro !== "ground"
            ? Number(a.alt_baro) * FEET_TO_METERS
            : null,
        altitudeAgl: null,
        velocity: a.gs != null ? Number(a.gs) * 0.514444 : null, // knots to m/s
        heading: a.track != null ? Number(a.track) : null,
        verticalRate:
          a.baro_rate != null
            ? Number(a.baro_rate) * FEET_TO_METERS / 60 // ft/min to m/s
            : null,
        squawk: a.squawk != null ? String(a.squawk) : null,
        category: Number(a.category) || 0,
        lastSeen: a.seen != null ? Date.now() - Number(a.seen) * 1000 : Date.now(),
        registration: typeof a.r === "string" ? a.r.trim() || undefined : undefined,
        aircraftType: typeof a.t === "string" ? a.t.trim() || undefined : undefined,
      }))
      .filter((a) => !(a.lat === 0 && a.lon === 0));

    return { aircraft, timestamp: Date.now(), source: "adsb.lol" };
  } catch (err) {
    console.warn("[adsb.lol] fetch failed:", err);
    return { aircraft: [], timestamp: Date.now(), source: "adsb.lol" };
  }
}

// ── OpenSky Network provider ─────────────────────────────────────────

export async function fetchFromOpenSky(
  bbox: BoundingBox,
): Promise<AdsbFetchResult> {
  try {
    const url =
      `https://opensky-network.org/api/states/all` +
      `?lamin=${bbox.south}&lomin=${bbox.west}&lamax=${bbox.north}&lomax=${bbox.east}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      return { aircraft: [], timestamp: Date.now(), source: "opensky" };
    }

    const data = await res.json();
    const states: unknown[][] = data.states ?? [];

    const aircraft: AircraftState[] = states
      .map((s: any[]) => ({
        icao24: String(s[0] ?? "").toLowerCase(),
        callsign: typeof s[1] === "string" ? s[1].trim() || null : null,
        originCountry: String(s[2] ?? ""),
        lat: Number(s[6]) || 0,
        lon: Number(s[5]) || 0,
        altitudeMsl: s[7] != null ? Number(s[7]) : null, // already meters
        altitudeAgl: null,
        velocity: s[9] != null ? Number(s[9]) : null, // already m/s
        heading: s[10] != null ? Number(s[10]) : null,
        verticalRate: s[11] != null ? Number(s[11]) : null, // already m/s
        squawk: s[14] != null ? String(s[14]) : null,
        category: Number(s[16]) || 0,
        lastSeen: s[3] != null ? Number(s[3]) * 1000 : Date.now(),
      }))
      .filter((a) => !(a.lat === 0 && a.lon === 0));

    return { aircraft, timestamp: Date.now(), source: "opensky" };
  } catch (err) {
    console.warn("[opensky] fetch failed:", err);
    return { aircraft: [], timestamp: Date.now(), source: "opensky" };
  }
}

// ── Primary fetch (adsb.lol first, OpenSky fallback) ─────────────────

const NM_TO_DEG = 1 / 60; // 1 nautical mile ~ 1/60 degree latitude

export async function fetchAircraft(
  lat: number,
  lon: number,
  radiusNm: number = 100,
): Promise<AdsbFetchResult> {
  const result = await fetchFromAdsbLol(lat, lon, radiusNm);
  if (result.aircraft.length > 0) {
    return result;
  }

  // Fallback: convert radius to bounding box for OpenSky
  const latDelta = radiusNm * NM_TO_DEG;
  const lonDelta = radiusNm * NM_TO_DEG / Math.cos((lat * Math.PI) / 180);
  const bbox: BoundingBox = {
    south: lat - latDelta,
    north: lat + latDelta,
    west: lon - lonDelta,
    east: lon + lonDelta,
  };

  return fetchFromOpenSky(bbox);
}

// ── Convex cache provider ───────────────────────────────────────────

interface ConvexCachedAircraft {
  icao24: string;
  callsign: string | null;
  lat: number;
  lon: number;
  altitudeMsl: number | null;
  velocity: number | null;
  heading: number | null;
  verticalRate: number | null;
  squawk: string | null;
  category: number;
  lastSeen: number;
  originCountry: string;
  registration: string | null;
  aircraftType: string | null;
}

export function fetchFromConvexCache(cached: {
  aircraft: ConvexCachedAircraft[];
  source: string;
  fetchedAt: number;
}): AdsbFetchResult {
  const aircraft: AircraftState[] = cached.aircraft.map((a) => ({
    icao24: a.icao24,
    callsign: a.callsign,
    originCountry: a.originCountry || "",
    lat: a.lat,
    lon: a.lon,
    altitudeMsl: a.altitudeMsl,
    altitudeAgl: null,
    velocity: a.velocity,
    heading: a.heading,
    verticalRate: a.verticalRate,
    squawk: a.squawk,
    category: a.category,
    lastSeen: a.lastSeen,
    registration: a.registration ?? undefined,
    aircraftType: a.aircraftType ?? undefined,
  }));

  return {
    aircraft,
    timestamp: cached.fetchedAt,
    source: "adsb.lol",
  };
}
