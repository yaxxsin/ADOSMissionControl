/**
 * @module airspace/faa-data
 * @description Sample US FAA airspace zones for MVP.
 * @license GPL-3.0-only
 */

import type { AirspaceZone, BoundingBox } from "./types";
import { circlePolygon, inBbox } from "./geo-utils";

const JFK_LAT = 40.6413;
const JFK_LON = -73.7781;
const LAX_LAT = 33.9425;
const LAX_LON = -118.4081;
const SFO_LAT = 37.6213;
const SFO_LON = -122.379;
const ORD_LAT = 41.9742;
const ORD_LON = -87.9073;

const US_ZONES: Array<{ zone: AirspaceZone; lat: number; lon: number }> = [
  {
    lat: JFK_LAT,
    lon: JFK_LON,
    zone: {
      id: "faa-jfk-classb",
      name: "JFK Class B",
      type: "classB",
      geometry: circlePolygon(JFK_LAT, JFK_LON, 55.56), // ~30nm
      floorAltitude: 0,
      ceilingAltitude: 2134, // 7000ft
      authority: "FAA",
      laancCeiling: 122, // 400ft — standard LAANC ceiling for Class B
      metadata: { icao: "KJFK", facility: "New York TRACON" },
    },
  },
  {
    lat: LAX_LAT,
    lon: LAX_LON,
    zone: {
      id: "faa-lax-classb",
      name: "LAX Class B",
      type: "classB",
      geometry: circlePolygon(LAX_LAT, LAX_LON, 55.56),
      floorAltitude: 0,
      ceilingAltitude: 3048, // 10000ft
      authority: "FAA",
      laancCeiling: 122, // 400ft — standard LAANC ceiling for Class B
      metadata: { icao: "KLAX", facility: "SoCal TRACON" },
    },
  },
  {
    lat: SFO_LAT,
    lon: SFO_LON,
    zone: {
      id: "faa-sfo-classd",
      name: "SFO Class D",
      type: "classD",
      geometry: circlePolygon(SFO_LAT, SFO_LON, 9.26), // ~5nm
      floorAltitude: 0,
      ceilingAltitude: 762, // 2500ft
      authority: "FAA",
      laancCeiling: 61, // 200ft
      metadata: { icao: "KSFO", facility: "San Francisco Tower" },
    },
  },
  {
    lat: ORD_LAT,
    lon: ORD_LON,
    zone: {
      id: "faa-ord-classd",
      name: "ORD Class D",
      type: "classD",
      geometry: circlePolygon(ORD_LAT, ORD_LON, 9.26),
      floorAltitude: 0,
      ceilingAltitude: 762,
      authority: "FAA",
      laancCeiling: 61,
      metadata: { icao: "KORD", facility: "Chicago O'Hare Tower" },
    },
  },
];

export function getUSAirspaceZones(bbox: BoundingBox): AirspaceZone[] {
  return US_ZONES.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
