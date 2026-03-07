/**
 * @module airspace/dgca-zones
 * @description India DGCA green/yellow/red airspace zones for MVP.
 * @license GPL-3.0-only
 */

import type { AirspaceZone, BoundingBox } from "./types";
import { circlePolygon, inBbox } from "./geo-utils";

interface AirportDef {
  name: string;
  icao: string;
  lat: number;
  lon: number;
}

const AIRPORTS: AirportDef[] = [
  { name: "Delhi (DEL)", icao: "VIDP", lat: 28.5562, lon: 77.1 },
  { name: "Bangalore (BLR)", icao: "VOBL", lat: 13.1986, lon: 77.7066 },
  { name: "Mumbai (BOM)", icao: "VABB", lat: 19.0896, lon: 72.8656 },
];

function makeZonesForAirport(airport: AirportDef): Array<{ zone: AirspaceZone; lat: number; lon: number }> {
  const { name, icao, lat, lon } = airport;
  return [
    {
      lat,
      lon,
      zone: {
        id: `dgca-${icao.toLowerCase()}-red`,
        name: `${name} Red Zone`,
        type: "dgcaRed",
        geometry: circlePolygon(lat, lon, 5),
        floorAltitude: 0,
        ceilingAltitude: 0, // no-fly
        authority: "DGCA",
        metadata: { icao, zone: "red", digitalSky: "no-fly" },
      },
    },
    {
      lat,
      lon,
      zone: {
        id: `dgca-${icao.toLowerCase()}-yellow`,
        name: `${name} Yellow Zone`,
        type: "dgcaYellow",
        geometry: circlePolygon(lat, lon, 25),
        floorAltitude: 0,
        ceilingAltitude: 60, // restricted to 60m
        authority: "DGCA",
        metadata: { icao, zone: "yellow", digitalSky: "permission-required" },
      },
    },
    {
      lat,
      lon,
      zone: {
        id: `dgca-${icao.toLowerCase()}-green`,
        name: `${name} Green Zone`,
        type: "dgcaGreen",
        geometry: circlePolygon(lat, lon, 45),
        floorAltitude: 0,
        ceilingAltitude: 120, // DGCA limit
        authority: "DGCA",
        metadata: { icao, zone: "green", digitalSky: "self-authorization" },
      },
    },
  ];
}

const INDIA_ZONES = AIRPORTS.flatMap(makeZonesForAirport);

export function getIndiaAirspaceZones(bbox: BoundingBox): AirspaceZone[] {
  return INDIA_ZONES.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
