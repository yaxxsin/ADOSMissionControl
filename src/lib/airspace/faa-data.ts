/**
 * @module airspace/faa-data
 * @description US FAA airspace zones generated from the global airport database.
 * Large airports get Class B (30nm radius), medium airports get Class D (5nm radius).
 * @license GPL-3.0-only
 */

import type { AirspaceZone, BoundingBox } from "./types";
import { circlePolygon, inBbox } from "./geo-utils";
import { getByCountry, preloadAirports } from "./airport-database";

interface ZoneEntry {
  zone: AirspaceZone;
  lat: number;
  lon: number;
}

let cachedZones: ZoneEntry[] | null = null;

async function buildZones(): Promise<ZoneEntry[]> {
  if (cachedZones) return cachedZones;

  await preloadAirports();
  const airports = await getByCountry("US");

  cachedZones = airports
    .filter((a) => a.type === "large_airport" || a.type === "medium_airport")
    .map((airport) => {
      const { name, icao, lat, lon } = airport;
      const isLarge = airport.type === "large_airport";
      const radiusKm = isLarge ? 55.56 : 9.26; // 30nm or 5nm
      const zoneType = isLarge ? "classB" : "classD";
      const ceiling = isLarge ? 2134 : 762; // 7000ft or 2500ft
      const laancCeiling = isLarge ? 122 : 61; // 400ft or 200ft

      return {
        lat,
        lon,
        zone: {
          id: `faa-${icao.toLowerCase()}-${zoneType.toLowerCase()}`,
          name: `${name} ${isLarge ? "Class B" : "Class D"}`,
          type: zoneType as AirspaceZone["type"],
          geometry: circlePolygon(lat, lon, radiusKm),
          circle: { lat, lon, radiusM: radiusKm * 1000 },
          floorAltitude: 0,
          ceilingAltitude: ceiling,
          authority: "FAA",
          jurisdiction: "faa" as const,
          laancCeiling,
          metadata: { icao, facility: `${airport.municipality} ${isLarge ? "TRACON" : "Tower"}` },
        },
      };
    });

  return cachedZones;
}

export async function getUSAirspaceZones(bbox: BoundingBox): Promise<AirspaceZone[]> {
  const zones = await buildZones();
  return zones.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
