/**
 * @module airspace/jurisdiction-lookup
 * @description Lightweight coordinate-to-jurisdiction mapper using country bounding boxes.
 * Returns the regulatory jurisdiction for a given lat/lon, or null for unmapped regions.
 * @license GPL-3.0-only
 */

import type { Jurisdiction } from "@/lib/jurisdiction";

interface BBox {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface JurisdictionMapping {
  jurisdiction: Jurisdiction;
  boxes: BBox[];
}

const MAPPINGS: JurisdictionMapping[] = [
  // India (DGCA)
  {
    jurisdiction: "dgca",
    boxes: [{ south: 6, north: 36, west: 72, east: 90 }],
  },
  // United States (FAA) — mainland + Alaska + Hawaii
  {
    jurisdiction: "faa",
    boxes: [
      { south: 24, north: 50, west: -125, east: -66 },  // CONUS
      { south: 54, north: 72, west: -170, east: -130 },  // Alaska
      { south: 18, north: 23, west: -161, east: -154 },  // Hawaii
      { south: 17, north: 19, west: -68, east: -64 },    // Puerto Rico / USVI
    ],
  },
  // Australia (CASA)
  {
    jurisdiction: "casa",
    boxes: [{ south: -45, north: -10, west: 112, east: 154 }],
  },
  // EASA — EU member states (grouped approximation)
  {
    jurisdiction: "easa",
    boxes: [
      { south: 36, north: 71, west: -10, east: 30 },     // Western/Central/Northern Europe
      { south: 34, north: 42, west: -10, east: 5 },       // Iberian Peninsula / Southern France
      { south: 36, north: 46, west: 5, east: 19 },        // Italy, Balkans west
      { south: 34, north: 42, west: 19, east: 30 },       // Greece, Bulgaria, Romania
      { south: 54, north: 70, west: 20, east: 30 },       // Baltics, Finland
    ],
  },
  // United Kingdom (CAA UK)
  {
    jurisdiction: "caa_uk",
    boxes: [
      { south: 49, north: 61, west: -8, east: 2 },       // Great Britain + Northern Ireland
    ],
  },
  // China (CAAC)
  {
    jurisdiction: "caac",
    boxes: [{ south: 18, north: 54, west: 73, east: 135 }],
  },
  // Japan (JCAB)
  {
    jurisdiction: "jcab",
    boxes: [
      { south: 24, north: 46, west: 123, east: 146 },
    ],
  },
  // Canada (TCCA)
  {
    jurisdiction: "tcca",
    boxes: [
      { south: 41, north: 84, west: -141, east: -52 },
    ],
  },
];

function pointInBox(lat: number, lon: number, box: BBox): boolean {
  return lat >= box.south && lat <= box.north && lon >= box.west && lon <= box.east;
}

/**
 * Look up the regulatory jurisdiction for a given coordinate.
 * Uses bounding-box approximations. Returns null for oceans or unmapped countries.
 */
export function lookupJurisdiction(lat: number, lon: number): Jurisdiction | null {
  for (const mapping of MAPPINGS) {
    for (const box of mapping.boxes) {
      if (pointInBox(lat, lon, box)) {
        return mapping.jurisdiction;
      }
    }
  }
  return null;
}
