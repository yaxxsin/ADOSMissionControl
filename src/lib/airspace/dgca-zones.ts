/**
 * @module airspace/dgca-zones
 * @description India DGCA green/yellow/red airspace zones generated from the
 * global airport database. Covers all Indian airports.
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
  const airports = await getByCountry("IN");

  cachedZones = airports.flatMap((airport) => {
    const { name, icao, lat, lon } = airport;
    const label = `${name} (${airport.iata})`;
    return [
      {
        lat,
        lon,
        zone: {
          id: `dgca-${icao.toLowerCase()}-red`,
          name: `${label} Red Zone`,
          type: "dgcaRed" as const,
          geometry: circlePolygon(lat, lon, 5),
          floorAltitude: 0,
          ceilingAltitude: 0,
          authority: "DGCA",
          circle: { lat, lon, radiusM: 5_000 },
          jurisdiction: "dgca" as const,
          metadata: { icao, zone: "red", digitalSky: "no-fly" },
        },
      },
      {
        lat,
        lon,
        zone: {
          id: `dgca-${icao.toLowerCase()}-yellow`,
          name: `${label} Yellow Zone`,
          type: "dgcaYellow" as const,
          geometry: circlePolygon(lat, lon, 25),
          floorAltitude: 0,
          ceilingAltitude: 60,
          authority: "DGCA",
          circle: { lat, lon, radiusM: 25_000 },
          jurisdiction: "dgca" as const,
          metadata: { icao, zone: "yellow", digitalSky: "permission-required" },
        },
      },
      {
        lat,
        lon,
        zone: {
          id: `dgca-${icao.toLowerCase()}-green`,
          name: `${label} Green Zone`,
          type: "dgcaGreen" as const,
          geometry: circlePolygon(lat, lon, 45),
          floorAltitude: 0,
          ceilingAltitude: 120,
          authority: "DGCA",
          circle: { lat, lon, radiusM: 45_000 },
          jurisdiction: "dgca" as const,
          metadata: { icao, zone: "green", digitalSky: "self-authorization" },
        },
      },
    ];
  });

  return cachedZones;
}

export async function getIndiaAirspaceZones(bbox: BoundingBox): Promise<AirspaceZone[]> {
  const zones = await buildZones();
  return zones.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
