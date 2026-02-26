/**
 * @module use-interpolated-position
 * @description Shared hook for computing the interpolated drone position during simulation.
 * Deduplicates the interpolatePosition() call across SimulationHUD, SimulationPanel,
 * and WaypointInspector — module-level cache ensures only one computation per tick.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useMissionStore } from "@/stores/mission-store";
import { usePlannerStore } from "@/stores/planner-store";
import { useThrottledElapsed } from "./use-throttled-elapsed";
import {
  computeFlightPlan,
  interpolatePosition,
  type FlightPlan,
  type FlightSegment,
  type InterpolatedPosition,
} from "@/lib/simulation-utils";

// Module-level cache — deduplicates across components rendering in the same tick
let _cachedSegments: FlightSegment[] | null = null;
let _cachedElapsed = -Infinity;
let _cachedResult: InterpolatedPosition | null = null;

function interpolateCached(
  segments: FlightSegment[],
  waypoints: Parameters<typeof interpolatePosition>[1],
  elapsed: number
): InterpolatedPosition {
  if (segments === _cachedSegments && elapsed === _cachedElapsed && _cachedResult) {
    return _cachedResult;
  }
  _cachedResult = interpolatePosition(segments, waypoints, elapsed);
  _cachedSegments = segments;
  _cachedElapsed = elapsed;
  return _cachedResult;
}

export function useInterpolatedPosition(): {
  pos: InterpolatedPosition;
  flightPlan: FlightPlan;
  elapsed: number;
} {
  const waypoints = useMissionStore((s) => s.waypoints);
  const defaultSpeed = usePlannerStore((s) => s.defaultSpeed);
  const elapsed = useThrottledElapsed();

  const flightPlan = useMemo(
    () => computeFlightPlan(waypoints, defaultSpeed),
    [waypoints, defaultSpeed]
  );

  const pos = useMemo(
    () => interpolateCached(flightPlan.segments, waypoints, elapsed),
    [flightPlan, waypoints, elapsed]
  );

  return { pos, flightPlan, elapsed };
}
