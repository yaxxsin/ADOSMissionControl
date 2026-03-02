/**
 * @module FlightPathEntity
 * @description Renders the 3D flight path with terrain-resolved altitude,
 * ground track shadow, altitude pillars at waypoints, and distance/altitude labels.
 * Color-codes path segments by command type: transit (blue), survey (green),
 * orbit/ROI (yellow), takeoff/land (white).
 * Falls back to clamped-to-ground path when resolved positions are unavailable.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  PolylineDashMaterialProperty,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  DistanceDisplayCondition,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import type { Waypoint, WaypointCommand } from "@/lib/types";
import { MAP_COLORS } from "@/lib/map-constants";
import { haversineDistance } from "@/lib/telemetry-utils";

interface FlightPathEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
  /** Terrain-resolved absolute positions (includes intermediate sub-samples). */
  resolvedPositions: Cartesian3[] | null;
  /** Indices into resolvedPositions for each original waypoint. */
  waypointIndices?: number[];
  /** Terrain height at each original waypoint (meters above ellipsoid). */
  terrainHeights?: number[];
  /** Show distance and altitude labels at waypoints. Default: true. */
  showLabels?: boolean;
  /** True while terrain provider is loading or resolution is in progress. */
  isResolving?: boolean;
}

/** Format distance as km or m depending on magnitude. */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

/** Segment color constants. */
const SEGMENT_COLORS = {
  transit: "#3A82FF",  // blue (accent primary)
  survey: "#22C55E",   // green
  orbit: "#EAB308",    // yellow
  takeoffLand: "#FFFFFF", // white
} as const;

/**
 * Determine the color for a flight segment based on active state commands.
 * Tracks DO_SET_CAM_TRIGG and ROI activation across waypoints.
 */
function getSegmentColor(camTriggerActive: boolean, roiActive: boolean, cmd: WaypointCommand | undefined): Color {
  if (cmd === "TAKEOFF" || cmd === "LAND" || cmd === "RTL") {
    return Color.fromCssColorString(SEGMENT_COLORS.takeoffLand).withAlpha(0.9);
  }
  if (roiActive) {
    return Color.fromCssColorString(SEGMENT_COLORS.orbit).withAlpha(0.9);
  }
  if (camTriggerActive) {
    return Color.fromCssColorString(SEGMENT_COLORS.survey).withAlpha(0.9);
  }
  return Color.fromCssColorString(SEGMENT_COLORS.transit).withAlpha(0.9);
}

/**
 * Check if any waypoints have special commands that warrant color coding.
 */
function hasSpecialCommands(waypoints: Waypoint[]): boolean {
  return waypoints.some(
    (wp) =>
      wp.command === "DO_SET_CAM_TRIGG" ||
      wp.command === "DO_DIGICAM" ||
      wp.command === "ROI" ||
      wp.command === "TAKEOFF" ||
      wp.command === "LAND" ||
      wp.command === "RTL"
  );
}

export function FlightPathEntity({
  viewer,
  waypoints,
  resolvedPositions,
  waypointIndices,
  terrainHeights,
  showLabels = true,
  isResolving = false,
}: FlightPathEntityProps) {
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length < 2) return;

    const entities: Entity[] = [];
    const accentColor = Color.fromCssColorString(MAP_COLORS.accentPrimary);
    const mutedColor = Color.fromCssColorString(MAP_COLORS.muted);
    const useColorCoding = hasSpecialCommands(waypoints);

    if (resolvedPositions && resolvedPositions.length >= 2) {
      // ── Color-coded elevated 3D flight path ────────────────────
      if (useColorCoding && waypointIndices && waypointIndices.length === waypoints.length) {
        let camTriggerActive = false;
        let roiActive = false;

        for (let i = 0; i < waypoints.length - 1; i++) {
          const wp = waypoints[i];
          const cmd = wp.command ?? "WAYPOINT";

          // Track state changes
          if (cmd === "DO_SET_CAM_TRIGG") {
            camTriggerActive = (wp.param1 ?? 0) > 0;
          }
          if (cmd === "ROI") {
            roiActive = true;
          }
          // ROI is cancelled by a WAYPOINT after it
          if (cmd === "WAYPOINT" && roiActive && i > 0 && waypoints[i - 1].command !== "ROI") {
            roiActive = false;
          }

          const startIdx = waypointIndices[i];
          const endIdx = waypointIndices[i + 1];
          if (startIdx === undefined || endIdx === undefined) continue;

          // Get positions for this segment (including terrain sub-samples)
          const segPositions = resolvedPositions.slice(startIdx, endIdx + 1);
          if (segPositions.length < 2) continue;

          const segColor = getSegmentColor(camTriggerActive, roiActive, cmd);

          const segEntity = viewer.entities.add({
            polyline: {
              positions: segPositions,
              width: 3,
              material: segColor,
              clampToGround: false,
            },
          });
          entities.push(segEntity);
        }
      } else {
        // Single-color fallback
        const pathEntity = viewer.entities.add({
          polyline: {
            positions: resolvedPositions,
            width: 3,
            material: accentColor.withAlpha(0.9),
            clampToGround: false,
          },
        });
        entities.push(pathEntity);
      }

      // ── Ground track (dashed shadow) ─────────────────────────
      const groundTrack = viewer.entities.add({
        polyline: {
          positions: resolvedPositions,
          width: 2,
          material: new PolylineDashMaterialProperty({
            color: mutedColor.withAlpha(0.4),
            dashLength: 12,
          }),
          clampToGround: true,
        },
      });
      entities.push(groundTrack);

      // ── Altitude pillars + labels at each original waypoint ──
      if (waypointIndices && terrainHeights) {
        let cumulativeDistance = 0;

        for (let i = 0; i < waypoints.length; i++) {
          const wp = waypoints[i];
          const posIdx = waypointIndices[i];
          if (posIdx === undefined || !resolvedPositions[posIdx]) continue;

          const topPos = resolvedPositions[posIdx];
          const groundHeight = terrainHeights[i] ?? 0;
          const groundPos = Cartesian3.fromDegrees(wp.lon, wp.lat, groundHeight);

          // Cumulative horizontal distance from start
          if (i > 0) {
            const prev = waypoints[i - 1];
            cumulativeDistance += haversineDistance(
              prev.lat, prev.lon, wp.lat, wp.lon
            );
          }

          // Altitude pillar: thin vertical line from ground to path
          const pillar = viewer.entities.add({
            polyline: {
              positions: [groundPos, topPos],
              width: 1,
              material: mutedColor.withAlpha(0.3),
              clampToGround: false,
            },
          });
          entities.push(pillar);

          // Distance + altitude label
          if (showLabels) {
            const distText = i === 0
              ? "START"
              : formatDistance(cumulativeDistance);
            const altText = `${Math.round(wp.alt)}m AGL`;

            const label = viewer.entities.add({
              position: topPos,
              label: {
                text: `${distText}\n${altText}`,
                font: "11px monospace",
                fillColor: Color.fromCssColorString(MAP_COLORS.foreground).withAlpha(0.8),
                outlineColor: Color.fromCssColorString(MAP_COLORS.background).withAlpha(0.6),
                outlineWidth: 2,
                style: LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: VerticalOrigin.BOTTOM,
                horizontalOrigin: HorizontalOrigin.LEFT,
                pixelOffset: new Cartesian2(8, -4),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                distanceDisplayCondition: new DistanceDisplayCondition(0, 15000),
              },
            });
            entities.push(label);
          }
        }
      }
    } else {
      // ── Fallback: clamped-to-ground path ────────────────────
      // When resolving: dashed + low opacity as a loading indicator.
      // Don't pass wp.alt as the third arg to fromDegrees — without
      // terrain context, AGL values become absolute-above-ellipsoid
      // which places the path underground in elevated areas.
      const positions = waypoints.map((wp) =>
        Cartesian3.fromDegrees(wp.lon, wp.lat)
      );

      const pathEntity = viewer.entities.add({
        polyline: {
          positions,
          width: isResolving ? 2 : 3,
          material: isResolving
            ? new PolylineDashMaterialProperty({
                color: accentColor.withAlpha(0.4),
                dashLength: 16,
              })
            : accentColor.withAlpha(0.9),
          clampToGround: true,
        },
      });
      entities.push(pathEntity);
    }

    return () => {
      for (const entity of entities) {
        if (!viewer.isDestroyed()) viewer.entities.remove(entity);
      }
    };
  }, [viewer, waypoints, resolvedPositions, waypointIndices, terrainHeights, showLabels, isResolving]);

  return null;
}
