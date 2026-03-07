/**
 * @module airspace/icao-zones
 * @description Generic ICAO standard airspace zone generator for airports
 * NOT in India (IN), USA (US), or Australia (AU). Generates Class B zones
 * for large airports and Class D zones for medium airports using ICAO defaults.
 * @license GPL-3.0-only
 */

import type { AirspaceZone, BoundingBox } from "./types";
import { circlePolygon, inBbox } from "./geo-utils";
import { getAirportsSync } from "./airport-database";

const NM_TO_KM = 1.852;
const EXCLUDED_COUNTRIES = new Set(["IN", "US", "AU"]);

let cachedZones: AirspaceZone[] | null = null;

/** Reset cache (for testing or after airport data reload). */
export function clearICAOZoneCache(): void {
  cachedZones = null;
}

/**
 * Get ICAO standard airspace zones for airports outside India, US, and Australia.
 * Large airports get Class B (15 NM radius, 0-10,000 ft).
 * Medium airports get Class D (5 NM radius, 0-2,500 ft).
 * Results are cached and filtered by bounding box.
 */
export function getICAOStandardZones(bbox: BoundingBox): AirspaceZone[] {
  if (!cachedZones) {
    const airports = getAirportsSync();
    cachedZones = [];

    for (const airport of airports) {
      if (EXCLUDED_COUNTRIES.has(airport.country)) continue;

      if (airport.type === "large_airport") {
        cachedZones.push({
          id: `icao-classb-${airport.icao}`,
          name: `${airport.name} Class B`,
          type: "classB",
          geometry: circlePolygon(airport.lat, airport.lon, 15 * NM_TO_KM),
          floorAltitude: 0,
          ceilingAltitude: 3048, // 10,000 ft
          authority: "ICAO",
          metadata: { icao: airport.icao, generated: "icao-standard" },
        });
      } else if (airport.type === "medium_airport") {
        cachedZones.push({
          id: `icao-classd-${airport.icao}`,
          name: `${airport.name} Class D`,
          type: "classD",
          geometry: circlePolygon(airport.lat, airport.lon, 5 * NM_TO_KM),
          floorAltitude: 0,
          ceilingAltitude: 762, // 2,500 ft
          authority: "ICAO",
          metadata: { icao: airport.icao, generated: "icao-standard" },
        });
      }
    }
  }

  // Filter to bbox using approximate zone center
  return cachedZones.filter((z) => {
    const coords =
      z.geometry.type === "Polygon"
        ? z.geometry.coordinates[0]
        : z.geometry.coordinates[0][0];
    if (!coords || coords.length === 0) return false;
    // Use first coordinate as approximate center (circle polygon starts near center latitude)
    const lon = coords[0][0];
    const lat = coords[0][1];
    return inBbox(lat, lon, bbox);
  });
}
