/**
 * @module airspace/airport-database
 * @description Global airport database with spatial lookup utilities.
 * Loads ~5000+ airports (large + medium worldwide) from a static JSON file on first access.
 * @license GPL-3.0-only
 */

import type { BoundingBox } from "./types";

export interface Airport {
  icao: string;
  iata: string;
  name: string;
  lat: number;
  lon: number;
  elevation: number;
  type: "large_airport" | "medium_airport" | "small_airport";
  country: string;
  municipality: string;
}

let cachedAirports: Airport[] | null = null;

async function getAirports(): Promise<Airport[]> {
  if (cachedAirports) return cachedAirports;
  const data = await import("@/data/airports.json");
  cachedAirports = (data.default as Record<string, unknown>[]).map((a) => ({
    icao: a.icao as string,
    iata: a.iata as string,
    name: a.name as string,
    lat: a.lat as number,
    lon: a.lon as number,
    elevation: a.elevation_m as number,
    type: a.type as Airport["type"],
    country: a.country_code as string,
    municipality: a.municipality as string,
  }));
  return cachedAirports;
}

/** Synchronous access to cached airports. Returns empty array if not loaded yet. */
export function getAirportsSync(): Airport[] {
  return cachedAirports ?? [];
}

/** Preload the airport database into cache. */
export async function preloadAirports(): Promise<void> {
  await getAirports();
}

/** Haversine distance in meters between two lat/lon points. */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Find the nearest airports to a point, sorted by distance. */
export async function findNearest(lat: number, lon: number, limit = 5): Promise<Airport[]> {
  const airports = await getAirports();
  return airports
    .map((a) => ({ airport: a, dist: haversine(lat, lon, a.lat, a.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, limit)
    .map((a) => a.airport);
}

/** Find all airports within a bounding box. */
export async function findInBbox(bbox: BoundingBox): Promise<Airport[]> {
  const airports = await getAirports();
  return airports.filter(
    (a) => a.lat >= bbox.south && a.lat <= bbox.north && a.lon >= bbox.west && a.lon <= bbox.east,
  );
}

/** Find a single airport by ICAO code. */
export async function findByIcao(icao: string): Promise<Airport | null> {
  const airports = await getAirports();
  return airports.find((a) => a.icao === icao) ?? null;
}

/** Get all airports for a given country code. Async to ensure data is loaded. */
export async function getByCountry(countryCode: string): Promise<Airport[]> {
  const airports = await getAirports();
  return airports.filter((a) => a.country === countryCode);
}

/** Get all unique country codes in the database. */
export function getAllCountryCodes(): string[] {
  const airports = getAirportsSync();
  return [...new Set(airports.map((a) => a.country))].sort();
}

/** Get total airport count. */
export function getAirportCount(): number {
  return getAirportsSync().length;
}

/** Search airports by name, ICAO, IATA, or municipality. Case-insensitive. */
export function searchAirports(query: string, limit = 20): Airport[] {
  if (!query || query.length < 2) return [];
  const airports = getAirportsSync();
  const q = query.toLowerCase();
  return airports
    .filter(
      (a) =>
        a.icao.toLowerCase().includes(q) ||
        a.iata.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.municipality.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
