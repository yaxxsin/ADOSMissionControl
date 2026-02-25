/**
 * @module DroneEntity
 * @description Renders the animated drone point and neon trail polyline in the 3D scene.
 * Position updates driven by the simulation store's elapsed time.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  Math as CesiumMath,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import type { FlightSegment } from "@/lib/simulation-utils";
import { interpolatePosition } from "@/lib/simulation-utils";
import { useSimulationStore } from "@/stores/simulation-store";
import { MAP_COLORS } from "@/lib/map-constants";

interface DroneEntityProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
  segments: FlightSegment[];
}

const DRONE_ENTITY_ID = "sim-drone";
const TRAIL_ENTITY_ID = "sim-trail";

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
  <polygon points="12,2 20,20 12,16 4,20" fill="#dff140" stroke="#fff" stroke-width="1" opacity="0.95"/>
</svg>`;
const ARROW_DATA_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? btoa(ARROW_SVG) : ""}`;

export function DroneEntity({ viewer, waypoints, segments }: DroneEntityProps) {
  const elapsed = useSimulationStore((s) => s.elapsed);
  const trailPositions = useSimulationStore((s) => s.trailPositions);
  const droneRef = useRef<Entity | null>(null);
  const trailRef = useRef<Entity | null>(null);
  const lastTrailTime = useRef(0);

  // Create drone + trail entities
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length === 0) return;

    const startPos = Cartesian3.fromDegrees(waypoints[0].lon, waypoints[0].lat, waypoints[0].alt);

    const drone = viewer.entities.add({
      id: DRONE_ENTITY_ID,
      position: startPos,
      billboard: {
        image: ARROW_DATA_URL,
        width: 28,
        height: 28,
        rotation: 0,
        alignedAxis: Cartesian3.UNIT_Z,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    droneRef.current = drone;

    const trail = viewer.entities.add({
      id: TRAIL_ENTITY_ID,
      polyline: {
        positions: [startPos],
        width: 2,
        material: Color.fromCssColorString(MAP_COLORS.accentSelected).withAlpha(0.6),
        clampToGround: false,
      },
    });
    trailRef.current = trail;

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.entities.removeById(DRONE_ENTITY_ID);
        viewer.entities.removeById(TRAIL_ENTITY_ID);
      }
      droneRef.current = null;
      trailRef.current = null;
      lastTrailTime.current = 0;
    };
  }, [viewer, waypoints]);

  // Update drone position on elapsed change
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !droneRef.current || segments.length === 0) return;

    const pos = interpolatePosition(segments, waypoints, elapsed);
    const cartesian = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt);

    // Use ConstantPositionProperty for type-safe entity position update
    (droneRef.current.position as ConstantPositionProperty).setValue(cartesian);

    // Rotate billboard to match heading
    if (droneRef.current.billboard) {
      droneRef.current.billboard.rotation = new ConstantProperty(
        -CesiumMath.toRadians(pos.heading)
      );
    }

    // Append to trail every 0.25s of sim time
    if (elapsed - lastTrailTime.current >= 0.25 || elapsed === 0) {
      useSimulationStore.getState().appendTrail({ lat: pos.lat, lon: pos.lon, alt: pos.alt });
      lastTrailTime.current = elapsed;
    }
  }, [viewer, elapsed, segments, waypoints]);

  // Update trail polyline
  useEffect(() => {
    if (!trailRef.current?.polyline || !viewer || viewer.isDestroyed()) return;
    if (trailPositions.length < 2) return;

    const positions = trailPositions.map((p) =>
      Cartesian3.fromDegrees(p.lon, p.lat, p.alt)
    );
    trailRef.current.polyline.positions = new ConstantProperty(positions);
  }, [viewer, trailPositions]);

  return null;
}
