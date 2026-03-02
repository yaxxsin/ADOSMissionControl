/**
 * @module mission-validator
 * @description Validates mission waypoints for common issues: geofence containment,
 * altitude limits, duplicate waypoints, missing takeoff/land commands, and more.
 * @license GPL-3.0-only
 */

import type { Waypoint } from "@/lib/types";
import { haversineDistance } from "@/lib/telemetry-utils";

/** A single validation issue (error or warning). */
export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  waypointIndex?: number;
  waypointId?: string;
}

/** Complete validation result. */
export interface ValidationResult {
  valid: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

/** Options for mission validation. */
interface ValidationOptions {
  geofence?: {
    polygonPoints?: [number, number][];
    circleCenter?: [number, number];
    circleRadius?: number;
    maxAltitude?: number;
  };
  maxAltitude?: number;
  maxDistanceBetweenWps?: number;
}

/**
 * Check if a point is inside a polygon using ray-casting algorithm.
 */
function pointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [yi, xi] = polygon[i]; // yi=lat, xi=lon
    const [yj, xj] = polygon[j]; // yj=lat, xj=lon
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Validate a mission's waypoints for common issues.
 *
 * @param waypoints Array of mission waypoints
 * @param options Optional validation parameters (geofence, altitude limits, etc.)
 * @returns Validation result with errors and warnings
 */
export function validateMission(
  waypoints: Waypoint[],
  options?: ValidationOptions,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const maxDist = options?.maxDistanceBetweenWps ?? 50_000; // 50km default

  // 1. Empty mission
  if (waypoints.length === 0) {
    errors.push({
      type: "error",
      code: "EMPTY_MISSION",
      message: "Mission has no waypoints",
    });
    return { valid: false, warnings, errors };
  }

  // 2. Less than 2 waypoints
  if (waypoints.length < 2) {
    warnings.push({
      type: "warning",
      code: "TOO_FEW_WAYPOINTS",
      message: "Mission has only 1 waypoint. Add at least 2 for a meaningful mission.",
      waypointIndex: 0,
      waypointId: waypoints[0].id,
    });
  }

  // 3. First waypoint should be TAKEOFF
  const firstCmd = waypoints[0].command ?? "WAYPOINT";
  if (firstCmd !== "TAKEOFF") {
    warnings.push({
      type: "warning",
      code: "NO_TAKEOFF",
      message: "First waypoint is not TAKEOFF. The drone may not launch correctly.",
      waypointIndex: 0,
      waypointId: waypoints[0].id,
    });
  }

  // 4. Last waypoint should be LAND or RTL
  if (waypoints.length >= 2) {
    const lastCmd = waypoints[waypoints.length - 1].command ?? "WAYPOINT";
    if (lastCmd !== "LAND" && lastCmd !== "RTL") {
      warnings.push({
        type: "warning",
        code: "NO_LAND",
        message: "Last waypoint is not LAND or RTL. The drone may hover at the final waypoint.",
        waypointIndex: waypoints.length - 1,
        waypointId: waypoints[waypoints.length - 1].id,
      });
    }
  }

  // Per-waypoint checks
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];

    // 5. Valid coordinates
    if (wp.lat < -90 || wp.lat > 90 || wp.lon < -180 || wp.lon > 180) {
      errors.push({
        type: "error",
        code: "INVALID_COORDS",
        message: `WP${i + 1}: Invalid coordinates (${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)})`,
        waypointIndex: i,
        waypointId: wp.id,
      });
    }

    // 6. Altitude limit check
    const altLimit = options?.maxAltitude ?? options?.geofence?.maxAltitude;
    if (altLimit !== undefined && wp.alt > altLimit) {
      errors.push({
        type: "error",
        code: "ALTITUDE_EXCEEDED",
        message: `WP${i + 1}: Altitude ${wp.alt}m exceeds limit of ${altLimit}m`,
        waypointIndex: i,
        waypointId: wp.id,
      });
    }

    // 7. Geofence polygon check
    if (options?.geofence?.polygonPoints && options.geofence.polygonPoints.length >= 3) {
      if (!pointInPolygon(wp.lat, wp.lon, options.geofence.polygonPoints)) {
        errors.push({
          type: "error",
          code: "OUTSIDE_GEOFENCE",
          message: `WP${i + 1}: Outside geofence polygon`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 8. Geofence circle check
    if (options?.geofence?.circleCenter && options?.geofence?.circleRadius) {
      const [centerLat, centerLon] = options.geofence.circleCenter;
      const dist = haversineDistance(wp.lat, wp.lon, centerLat, centerLon);
      if (dist > options.geofence.circleRadius) {
        errors.push({
          type: "error",
          code: "OUTSIDE_GEOFENCE",
          message: `WP${i + 1}: ${Math.round(dist)}m from center, exceeds ${options.geofence.circleRadius}m radius`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 9. Duplicate consecutive waypoints (within 0.5m)
    if (i > 0) {
      const prev = waypoints[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);
      if (dist < 0.5) {
        warnings.push({
          type: "warning",
          code: "DUPLICATE_WAYPOINT",
          message: `WP${i + 1}: Duplicate of WP${i} (${dist.toFixed(1)}m apart)`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 10. Reasonable distance between consecutive waypoints
    if (i > 0) {
      const prev = waypoints[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);
      if (dist > maxDist) {
        warnings.push({
          type: "warning",
          code: "EXCESSIVE_DISTANCE",
          message: `WP${i} to WP${i + 1}: ${(dist / 1000).toFixed(1)}km apart (max: ${(maxDist / 1000).toFixed(0)}km)`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 11. DO_JUMP target validation
    if ((wp.command === "DO_JUMP") && wp.param1 !== undefined) {
      const targetIdx = wp.param1;
      if (targetIdx < 1 || targetIdx > waypoints.length) {
        errors.push({
          type: "error",
          code: "INVALID_JUMP_TARGET",
          message: `WP${i + 1}: DO_JUMP target WP${targetIdx} is out of range (1-${waypoints.length})`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
