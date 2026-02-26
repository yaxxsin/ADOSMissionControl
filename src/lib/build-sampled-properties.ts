/**
 * @module build-sampled-properties
 * @description Builds CesiumJS SampledPositionProperty + SampledProperty<heading>
 * from a flight plan. Pure function — no React, no side effects.
 * @license GPL-3.0-only
 */

import {
  JulianDate,
  SampledPositionProperty,
  SampledProperty,
  LinearApproximation,
  Cartesian3,
  Math as CesiumMath,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import type { FlightPlan } from "@/lib/simulation-utils";

export interface SampledProperties {
  sampledPosition: SampledPositionProperty;
  sampledHeading: SampledProperty;
  startJulian: JulianDate;
}

/**
 * Build CesiumJS sampled properties from waypoints and a computed flight plan.
 * Returns null if there are no waypoints or segments.
 */
export function buildSampledProperties(
  waypoints: Waypoint[],
  flightPlan: FlightPlan
): SampledProperties | null {
  if (waypoints.length === 0 || flightPlan.segments.length === 0) return null;

  const startJulian = JulianDate.fromDate(new Date(0)); // Arbitrary epoch
  const sampledPosition = new SampledPositionProperty();
  const sampledHeading = new SampledProperty(Number);

  // Linear interpolation — drone flies in straight lines between waypoints
  sampledPosition.setInterpolationOptions({
    interpolationAlgorithm: LinearApproximation,
    interpolationDegree: 1,
  });
  sampledHeading.setInterpolationOptions({
    interpolationAlgorithm: LinearApproximation,
    interpolationDegree: 1,
  });

  let t = JulianDate.clone(startJulian);

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const pos = Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt);

    // Heading for this segment (or last segment for final waypoint)
    const segIdx = Math.min(i, flightPlan.segments.length - 1);
    const hdgRad = -CesiumMath.toRadians(flightPlan.segments[segIdx].heading);

    // Arrival sample
    sampledPosition.addSample(JulianDate.clone(t), pos);
    sampledHeading.addSample(JulianDate.clone(t), hdgRad);

    if (i < waypoints.length - 1) {
      const holdTime = wp.holdTime ?? 0;
      if (holdTime > 0) {
        // Duplicate position at departure = drone holds in place
        t = JulianDate.addSeconds(t, holdTime, new JulianDate());
        sampledPosition.addSample(JulianDate.clone(t), pos);
        sampledHeading.addSample(JulianDate.clone(t), hdgRad);
      }
      // Travel to next waypoint
      const seg = flightPlan.segments[i];
      const travelTime = seg.duration - (wp.holdTime ?? 0);
      if (travelTime > 0) {
        // Add heading sample at end of segment just before arrival
        // to prevent interpolation blending across segment boundaries
        const almostArrival = JulianDate.addSeconds(t, travelTime - 0.001, new JulianDate());
        sampledHeading.addSample(almostArrival, hdgRad);
        t = JulianDate.addSeconds(t, travelTime, new JulianDate());
      }
    } else if (wp.holdTime) {
      // Last waypoint hold
      t = JulianDate.addSeconds(t, wp.holdTime, new JulianDate());
      sampledPosition.addSample(JulianDate.clone(t), pos);
      sampledHeading.addSample(JulianDate.clone(t), hdgRad);
    }
  }

  return { sampledPosition, sampledHeading, startJulian };
}
