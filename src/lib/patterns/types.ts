/**
 * @module patterns/types
 * @description Configuration and result types for automated flight pattern generators
 * (survey grid, orbit, corridor scan).
 * @license GPL-3.0-only
 */

// ── Survey (grid / lawnmower) ────────────────────────────────

export interface SurveyConfig {
  /** Polygon vertices as [lat, lon] pairs. */
  polygon: [number, number][];
  /** Grid rotation angle in degrees (0 = north-south lines, 90 = east-west). */
  gridAngle: number;
  /** Distance between parallel transects in meters. */
  lineSpacing: number;
  /** Overshoot distance past polygon boundary at each transect end, in meters. */
  turnAroundDistance: number;
  /** Which corner of the bounding box to start from. */
  entryLocation: "topLeft" | "topRight" | "bottomLeft" | "bottomRight";
  /** Skip every other transect (useful for double-pass surveys). */
  flyAlternateTransects: boolean;
  /** Distance between camera triggers in meters (0 = disabled). */
  cameraTriggerDistance: number;
  /** Enable crosshatch: run survey twice at gridAngle and gridAngle+90. */
  crosshatch?: boolean;
  /** Altitude AGL for generated waypoints, in meters. */
  altitude: number;
  /** Cruise speed for generated waypoints, in m/s. */
  speed: number;
}

// ── Orbit (circle / point-of-interest) ───────────────────────

export interface OrbitConfig {
  /** Circle center as [lat, lon]. */
  center: [number, number];
  /** Circle radius in meters. */
  radius: number;
  /** Orbit direction. */
  direction: "cw" | "ccw";
  /** Number of full orbits. */
  turns: number;
  /** Start angle in degrees from north (0 = north, 90 = east). */
  startAngle: number;
  /** Altitude AGL in meters. */
  altitude: number;
  /** Cruise speed in m/s. */
  speed: number;
}

// ── Corridor (path scan) ─────────────────────────────────────

export interface CorridorConfig {
  /** Center line of the corridor as [lat, lon] waypoints. */
  pathPoints: [number, number][];
  /** Total corridor width in meters (extends half on each side). */
  corridorWidth: number;
  /** Distance between perpendicular transects in meters. */
  lineSpacing: number;
  /** Altitude AGL in meters. */
  altitude: number;
  /** Cruise speed in m/s. */
  speed: number;
}

// ── SAR patterns (re-exported from sar-generators) ───────────

export type { ExpandingSquareConfig, SectorSearchConfig, ParallelTrackConfig } from "./sar-generators";

// ── Structure scan (re-exported from structure-scan-generator) ─

export type { StructureScanConfig } from "./structure-scan-generator";

// ── Discriminated union config ───────────────────────────────

import type { ExpandingSquareConfig, SectorSearchConfig, ParallelTrackConfig } from "./sar-generators";
import type { StructureScanConfig } from "./structure-scan-generator";

export type PatternConfig =
  | { type: "survey"; config: SurveyConfig }
  | { type: "orbit"; config: OrbitConfig }
  | { type: "corridor"; config: CorridorConfig }
  | { type: "expandingSquare"; config: ExpandingSquareConfig }
  | { type: "sectorSearch"; config: SectorSearchConfig }
  | { type: "parallelTrack"; config: ParallelTrackConfig }
  | { type: "structureScan"; config: StructureScanConfig };

// ── Result types ─────────────────────────────────────────────

export interface PatternStats {
  /** Total flight distance in meters. */
  totalDistance: number;
  /** Estimated flight time in seconds. */
  estimatedTime: number;
  /** Number of camera trigger events (0 if triggers disabled). */
  photoCount: number;
  /** Covered area in square meters. */
  coveredArea: number;
  /** Number of transects generated. */
  transectCount: number;
}

export interface PatternWaypoint {
  lat: number;
  lon: number;
  alt: number;
  speed: number;
  command: string;
  param1?: number;
  param2?: number;
}

export interface PatternResult {
  waypoints: PatternWaypoint[];
  stats: PatternStats;
  /** Transect preview lines for map overlay: [[startLat, startLon], [endLat, endLon]]. */
  previewLines?: [[number, number], [number, number]][];
}
