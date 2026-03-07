/**
 * @module airspace/airspace-provider
 * @description Jurisdiction dispatcher for loading airspace zones.
 * @license GPL-3.0-only
 */

import type { Jurisdiction } from "@/lib/jurisdiction";
import type { AirspaceZone, BoundingBox } from "./types";
import { getUSAirspaceZones } from "./faa-data";
import { getIndiaAirspaceZones } from "./dgca-zones";
import { getAustraliaAirspaceZones } from "./casa-zones";
import { getICAOStandardZones } from "./icao-zones";

export async function loadAirspaceZones(
  jurisdiction: Jurisdiction | null,
  bbox: BoundingBox,
): Promise<AirspaceZone[]> {
  switch (jurisdiction) {
    case "faa":
      return getUSAirspaceZones(bbox);
    case "dgca":
      return getIndiaAirspaceZones(bbox);
    case "casa":
      return getAustraliaAirspaceZones(bbox);
    default:
      return [];
  }
}

export async function loadAllAirspaceZones(bbox: BoundingBox): Promise<AirspaceZone[]> {
  const [india, us, au] = await Promise.all([
    getIndiaAirspaceZones(bbox),
    getUSAirspaceZones(bbox),
    getAustraliaAirspaceZones(bbox),
  ]);
  const icao = getICAOStandardZones(bbox);
  return [...india, ...us, ...au, ...icao];
}
