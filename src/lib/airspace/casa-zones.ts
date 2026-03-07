/**
 * @module airspace/casa-zones
 * @description Australia CASA airspace zones generated from the global airport
 * database. Restricted (5.5km) and Caution (10km) zones for all AU airports.
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
  const airports = await getByCountry("AU");

  cachedZones = airports.flatMap((airport) => {
    const { name, icao, lat, lon } = airport;
    return [
      {
        lat,
        lon,
        zone: {
          id: `casa-${icao.toLowerCase()}-restricted`,
          name: `${name} Aerodrome Restricted`,
          type: "casaRestricted" as const,
          geometry: circlePolygon(lat, lon, 5.5),
          floorAltitude: 0,
          ceilingAltitude: 120,
          authority: "CASA",
          circle: { lat, lon, radiusM: 5_500 },
          jurisdiction: "casa" as const,
          metadata: { icao, buffer: "5.5km aerodrome" },
        },
      },
      {
        lat,
        lon,
        zone: {
          id: `casa-${icao.toLowerCase()}-caution`,
          name: `${name} Caution Zone`,
          type: "casaCaution" as const,
          geometry: circlePolygon(lat, lon, 10),
          floorAltitude: 0,
          ceilingAltitude: 120,
          authority: "CASA",
          circle: { lat, lon, radiusM: 10_000 },
          jurisdiction: "casa" as const,
          metadata: { icao, buffer: "10km extended" },
        },
      },
    ];
  });

  return cachedZones;
}

export async function getAustraliaAirspaceZones(bbox: BoundingBox): Promise<AirspaceZone[]> {
  const zones = await buildZones();
  return zones.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
