/**
 * @module FlightPathEntity
 * @description Renders the flight path polyline at altitude with vertical altitude poles
 * (drop lines) from ground to each waypoint. Uses CesiumJS primitives.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian3,
  Color,
  PolylineDashMaterialProperty,
  type Viewer as CesiumViewer,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { MAP_COLORS } from "@/lib/map-constants";

interface FlightPathEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
}

export function FlightPathEntity({ viewer, waypoints }: FlightPathEntityProps) {
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length < 2) return;

    const entities: ReturnType<typeof viewer.entities.add>[] = [];

    // Flight path polyline at altitude
    const positions = waypoints.map((wp) =>
      Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
    );

    const pathEntity = viewer.entities.add({
      polyline: {
        positions,
        width: 3,
        material: Color.fromCssColorString(MAP_COLORS.accentPrimary).withAlpha(0.9),
        clampToGround: false,
      },
    });
    entities.push(pathEntity);

    // Altitude poles (vertical drop lines from ground to waypoint)
    for (const wp of waypoints) {
      const groundPos = Cartesian3.fromDegrees(wp.lon, wp.lat, 0);
      const airPos = Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt);

      const poleEntity = viewer.entities.add({
        polyline: {
          positions: [groundPos, airPos],
          width: 1,
          material: new PolylineDashMaterialProperty({
            color: Color.fromCssColorString(MAP_COLORS.accentPrimary).withAlpha(0.5),
            dashLength: 8,
          }),
          clampToGround: false,
        },
      });
      entities.push(poleEntity);
    }

    return () => {
      for (const entity of entities) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
      }
    };
  }, [viewer, waypoints]);

  return null;
}
