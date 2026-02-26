/**
 * @module FlightPathEntity
 * @description Renders the flight path polyline clamped to terrain surface.
 * Waypoint altitude visualization comes from WaypointEntities (RELATIVE_TO_GROUND).
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian3,
  Color,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { MAP_COLORS } from "@/lib/map-constants";

interface FlightPathEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
}

export function FlightPathEntity({ viewer, waypoints }: FlightPathEntityProps) {
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const entities: Entity[] = [];

    if (waypoints.length >= 2) {
      // Flight path polyline — draped on terrain surface
      const positions = waypoints.map((wp) =>
        Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );

      const pathEntity = viewer.entities.add({
        polyline: {
          positions,
          width: 3,
          material: Color.fromCssColorString(MAP_COLORS.accentPrimary).withAlpha(0.9),
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
  }, [viewer, waypoints]);

  return null;
}
