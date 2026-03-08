/**
 * @module airspace/notam-provider
 * @description Fetches NOTAMs from the FAA NOTAM Search API.
 * Parses structured NOTAM text to extract geospatial data.
 * @license GPL-3.0-only
 */

import type { BoundingBox, Notam } from "./types";

// Server-side proxy bypasses FAA's missing CORS headers
const NOTAM_PROXY_URL = "/api/airspace/notams";

// Major US airports for NOTAM queries (ICAO codes)
const US_AIRPORTS = [
  "KJFK", "KLAX", "KORD", "KATL", "KDFW",
  "KDEN", "KSFO", "KLAS", "KMIA", "KSEA",
];

/**
 * Fetch NOTAMs for the given bounding box.
 * Currently queries FAA NOTAM Search for major US airports.
 */
export async function fetchNotams(bbox: BoundingBox): Promise<Notam[]> {
  // Only fetch if bbox overlaps continental US
  const usOverlap =
    bbox.south < 50 && bbox.north > 24 &&
    bbox.west < -66 && bbox.east > -125;

  if (!usOverlap) return [];

  const results: Notam[] = [];

  // Fetch from a subset of airports to avoid rate limits
  const airportsToQuery = US_AIRPORTS.slice(0, 5);

  for (const icao of airportsToQuery) {
    try {
      const notams = await fetchAirportNotams(icao);
      results.push(...notams);
    } catch {
      // Individual airport failures are non-fatal
    }
  }

  return results;
}

async function fetchAirportNotams(icao: string): Promise<Notam[]> {
  const resp = await fetch(`${NOTAM_PROXY_URL}?icao=${encodeURIComponent(icao)}`);

  if (!resp.ok) return [];

  const text = await resp.text();
  return parseNotamResponse(text, icao);
}

/** Parse FAA NOTAM response HTML/text into structured Notam objects. */
function parseNotamResponse(responseText: string, icao: string): Notam[] {
  const notams: Notam[] = [];

  // FAA returns NOTAMs as text blocks with standard ICAO format
  // Match NOTAM IDs like "A1234/24" or "FDC 4/1234"
  const notamBlocks = responseText.split(/(?=\b[A-Z]\d{4}\/\d{2}\b|(?=\bFDC\s+\d+\/\d+\b))/);

  for (const block of notamBlocks) {
    if (block.trim().length < 20) continue;

    const notam = parseNotamBlock(block, icao);
    if (notam) notams.push(notam);
  }

  return notams;
}

function parseNotamBlock(block: string, icao: string): Notam | null {
  // Extract NOTAM ID
  const idMatch = block.match(/([A-Z]\d{4}\/\d{2}|FDC\s+\d+\/\d+)/);
  if (!idMatch) return null;

  const id = idMatch[1].replace(/\s+/g, "-");

  // Extract effective dates (FROM/TO)
  const fromMatch = block.match(/FROM\s+(\d{10})/i) ?? block.match(/B\)\s*(\d{10})/);
  const toMatch = block.match(/TO\s+(\d{10})/i) ?? block.match(/C\)\s*(\d{10})/);

  const effectiveFrom = fromMatch ? parseNotamDate(fromMatch[1]) : new Date().toISOString();
  const effectiveTo = toMatch ? parseNotamDate(toMatch[1]) : new Date(Date.now() + 86400000 * 30).toISOString();

  // Extract coordinates if present
  const coordMatch = block.match(/(\d{4,6}[NS])\s*(\d{5,7}[EW])/);
  let lat: number | undefined;
  let lon: number | undefined;

  if (coordMatch) {
    lat = parseNotamCoord(coordMatch[1], "NS");
    lon = parseNotamCoord(coordMatch[2], "EW");
  } else {
    // Use airport coordinates as fallback
    const airportCoords = AIRPORT_COORDS[icao];
    if (airportCoords) {
      lat = airportCoords[0];
      lon = airportCoords[1];
    }
  }

  // Extract radius (nautical miles to km)
  const radiusMatch = block.match(/(\d+(?:\.\d+)?)\s*NM/i);
  const radius = radiusMatch ? parseFloat(radiusMatch[1]) * 1.852 : undefined;

  // Extract altitude
  const floorMatch = block.match(/SFC|GND/i) ? 0 : undefined;
  const ceilMatch = block.match(/(\d+)\s*FT/i);
  const ceilingAltitude = ceilMatch ? parseInt(ceilMatch[1]) * 0.3048 : undefined;

  // Extract meaningful title (first 80 chars of E) field or first line)
  const eFieldMatch = block.match(/E\)\s*(.+?)(?:\n|$)/);
  const title = (eFieldMatch?.[1] ?? block.slice(0, 80)).trim().replace(/<[^>]+>/g, "");

  return {
    id: `faa-${id}`,
    title: title.slice(0, 120),
    text: block.trim().slice(0, 500).replace(/<[^>]+>/g, ""),
    issuer: "FAA",
    effectiveFrom,
    effectiveTo,
    lat,
    lon,
    radius,
    floorAltitude: floorMatch,
    ceilingAltitude,
  };
}

/** Parse NOTAM date format YYMMDDHHMM to ISO 8601 */
function parseNotamDate(dateStr: string): string {
  if (dateStr.length < 10) return new Date().toISOString();
  const yy = parseInt(dateStr.slice(0, 2));
  const mm = parseInt(dateStr.slice(2, 4)) - 1;
  const dd = parseInt(dateStr.slice(4, 6));
  const hh = parseInt(dateStr.slice(6, 8));
  const min = parseInt(dateStr.slice(8, 10));
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, mm, dd, hh, min)).toISOString();
}

/** Parse NOTAM coordinate like 4038N or 07352W */
function parseNotamCoord(coord: string, ref: "NS" | "EW"): number {
  const dir = coord.slice(-1);
  const num = coord.slice(0, -1);

  let degrees: number;
  let minutes = 0;
  let seconds = 0;

  if (ref === "NS") {
    // DDMM or DDMMSS
    degrees = parseInt(num.slice(0, 2));
    if (num.length >= 4) minutes = parseInt(num.slice(2, 4));
    if (num.length >= 6) seconds = parseInt(num.slice(4, 6));
  } else {
    // DDDMM or DDDMMSS
    degrees = parseInt(num.slice(0, 3));
    if (num.length >= 5) minutes = parseInt(num.slice(3, 5));
    if (num.length >= 7) seconds = parseInt(num.slice(5, 7));
  }

  let value = degrees + minutes / 60 + seconds / 3600;
  if (dir === "S" || dir === "W") value = -value;
  return value;
}

// Fallback airport coordinates for NOTAMs without embedded coords
const AIRPORT_COORDS: Record<string, [number, number]> = {
  KJFK: [40.6413, -73.7781],
  KLAX: [33.9425, -118.4081],
  KORD: [41.9742, -87.9073],
  KATL: [33.6407, -84.4277],
  KDFW: [32.8998, -97.0403],
  KDEN: [39.8561, -104.6737],
  KSFO: [37.6213, -122.3790],
  KLAS: [36.0840, -115.1537],
  KMIA: [25.7959, -80.2870],
  KSEA: [47.4502, -122.3088],
};
