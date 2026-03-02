/**
 * @module terrain/terrain-profile
 * @description Computes terrain elevation profiles along waypoint paths
 * and adjusts waypoint altitudes for terrain-following flights.
 * @license GPL-3.0-only
 */

import type { Waypoint } from "@/lib/types";
import type { TerrainProfile, TerrainPoint } from "./types";
import { getElevations } from "./terrain-provider";
import { haversineDistance } from "@/lib/telemetry-utils";

/**
 * Compute a terrain elevation profile along a waypoint path.
 * Samples elevation at each waypoint and at intermediate points between them.
 *
 * @param waypoints Waypoint array to profile
 * @param samplesPerSegment Number of intermediate samples between each waypoint pair
 * @param signal Optional AbortSignal for cancellation
 * @returns TerrainProfile with elevation data along the path
 */
export async function computeTerrainProfile(
  waypoints: Waypoint[],
  samplesPerSegment = 10,
  signal?: AbortSignal,
): Promise<TerrainProfile> {
  if (waypoints.length === 0) {
    return { points: [], minElevation: 0, maxElevation: 0 };
  }

  // Build sample points: each waypoint + intermediate samples
  const samplePoints: Array<{ lat: number; lon: number; cumDist: number }> = [];
  let cumDist = 0;

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];

    if (i > 0) {
      const prev = waypoints[i - 1];
      const segDist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);

      // Add intermediate samples
      for (let s = 1; s <= samplesPerSegment; s++) {
        const t = s / (samplesPerSegment + 1);
        samplePoints.push({
          lat: prev.lat + (wp.lat - prev.lat) * t,
          lon: prev.lon + (wp.lon - prev.lon) * t,
          cumDist: cumDist + segDist * t,
        });
      }

      cumDist += segDist;
    }

    samplePoints.push({ lat: wp.lat, lon: wp.lon, cumDist });
  }

  // Sort by cumulative distance (intermediate points were inserted before their end waypoint)
  samplePoints.sort((a, b) => a.cumDist - b.cumDist);

  // Fetch elevations
  const elevations = await getElevations(
    samplePoints.map((p) => ({ lat: p.lat, lon: p.lon })),
    signal,
  );

  // Build profile
  let minElevation = Infinity;
  let maxElevation = -Infinity;
  const points: TerrainPoint[] = [];

  for (let i = 0; i < samplePoints.length; i++) {
    const elev = elevations[i];
    if (elev < minElevation) minElevation = elev;
    if (elev > maxElevation) maxElevation = elev;
    points.push({
      lat: samplePoints[i].lat,
      lon: samplePoints[i].lon,
      distance: samplePoints[i].cumDist,
      elevation: elev,
    });
  }

  if (!isFinite(minElevation)) minElevation = 0;
  if (!isFinite(maxElevation)) maxElevation = 0;

  return { points, minElevation, maxElevation };
}

/**
 * Adjust waypoint altitudes to maintain a constant AGL above terrain.
 * Each waypoint's alt is set to groundElevation + targetAGL.
 *
 * @param waypoints Array of waypoints to adjust
 * @param targetAGL Desired altitude above ground level in meters
 * @param signal Optional AbortSignal
 * @returns New waypoint array with adjusted altitudes and groundElevation set
 */
export async function adjustAltitudesForTerrain(
  waypoints: Waypoint[],
  targetAGL: number,
  signal?: AbortSignal,
): Promise<Waypoint[]> {
  if (waypoints.length === 0) return [];

  const elevations = await getElevations(
    waypoints.map((wp) => ({ lat: wp.lat, lon: wp.lon })),
    signal,
  );

  return waypoints.map((wp, i) => ({
    ...wp,
    alt: elevations[i] + targetAGL,
    groundElevation: elevations[i],
  }));
}
