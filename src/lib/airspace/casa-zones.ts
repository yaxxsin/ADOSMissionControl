/**
 * @module airspace/casa-zones
 * @description Australia CASA airspace zones for MVP.
 * @license GPL-3.0-only
 */

import type { AirspaceZone, BoundingBox } from "./types";
import { circlePolygon, inBbox } from "./geo-utils";

const SYD_LAT = -33.9461;
const SYD_LON = 151.1772;
const MEL_LAT = -37.669;
const MEL_LON = 144.841;

const AU_ZONES: Array<{ zone: AirspaceZone; lat: number; lon: number }> = [
  {
    lat: SYD_LAT,
    lon: SYD_LON,
    zone: {
      id: "casa-syd-restricted",
      name: "SYD Aerodrome Restricted",
      type: "casaRestricted",
      geometry: circlePolygon(SYD_LAT, SYD_LON, 5.5),
      floorAltitude: 0,
      ceilingAltitude: 120,
      authority: "CASA",
      metadata: { icao: "YSSY", buffer: "5.5km aerodrome" },
    },
  },
  {
    lat: SYD_LAT,
    lon: SYD_LON,
    zone: {
      id: "casa-syd-caution",
      name: "SYD Caution Zone",
      type: "casaCaution",
      geometry: circlePolygon(SYD_LAT, SYD_LON, 10),
      floorAltitude: 0,
      ceilingAltitude: 120,
      authority: "CASA",
      metadata: { icao: "YSSY", buffer: "10km extended" },
    },
  },
  {
    lat: MEL_LAT,
    lon: MEL_LON,
    zone: {
      id: "casa-mel-restricted",
      name: "MEL Aerodrome Restricted",
      type: "casaRestricted",
      geometry: circlePolygon(MEL_LAT, MEL_LON, 5.5),
      floorAltitude: 0,
      ceilingAltitude: 120,
      authority: "CASA",
      metadata: { icao: "YMML", buffer: "5.5km aerodrome" },
    },
  },
  {
    lat: MEL_LAT,
    lon: MEL_LON,
    zone: {
      id: "casa-mel-caution",
      name: "MEL Caution Zone",
      type: "casaCaution",
      geometry: circlePolygon(MEL_LAT, MEL_LON, 10),
      floorAltitude: 0,
      ceilingAltitude: 120,
      authority: "CASA",
      metadata: { icao: "YMML", buffer: "10km extended" },
    },
  },
];

export function getAustraliaAirspaceZones(bbox: BoundingBox): AirspaceZone[] {
  return AU_ZONES.filter((z) => inBbox(z.lat, z.lon, bbox)).map((z) => z.zone);
}
