/**
 * @module pattern-editor-constants
 * @description Constants and option arrays for the PatternEditor component.
 * @license GPL-3.0-only
 */

import { CAMERA_PROFILES } from "@/lib/patterns/gsd-calculator";

export const PATTERN_TYPE_OPTIONS = [
  { value: "survey", label: "Survey Grid", description: "Grid/lawnmower pattern for area coverage and mapping" },
  { value: "orbit", label: "Orbit", description: "Circular flight around a point of interest" },
  { value: "corridor", label: "Corridor", description: "Linear corridor sweep along a path" },
  { value: "expandingSquare", label: "SAR: Expanding Square", description: "Search pattern expanding outward from a datum point" },
  { value: "sectorSearch", label: "SAR: Sector Search", description: "Pie-slice search radiating from a datum point" },
  { value: "parallelTrack", label: "SAR: Parallel Track", description: "Systematic parallel sweeps across a search area" },
  { value: "structureScan", label: "Structure Scan", description: "Multi-layer orbit for 3D structure inspection" },
];

export const ENTRY_LOCATION_OPTIONS = [
  { value: "topLeft", label: "Top Left" },
  { value: "topRight", label: "Top Right" },
  { value: "bottomLeft", label: "Bottom Left" },
  { value: "bottomRight", label: "Bottom Right" },
];

export const DIRECTION_OPTIONS = [
  { value: "cw", label: "Clockwise" },
  { value: "ccw", label: "Counter-clockwise" },
];

export const SCAN_DIRECTION_OPTIONS = [
  { value: "bottom-up", label: "Bottom Up" },
  { value: "top-down", label: "Top Down" },
];

export const CAMERA_OPTIONS = [
  { value: "", label: "Manual" },
  ...CAMERA_PROFILES.map((c) => ({ value: c.name, label: c.name })),
];

export const VALID_PATTERN_TYPES = new Set(PATTERN_TYPE_OPTIONS.map((o) => o.value));
