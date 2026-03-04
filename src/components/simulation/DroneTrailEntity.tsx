/**
 * @module DroneTrailEntity
 * @description Renders a fading lime trail behind the drone during simulation playback.
 * Uses a CallbackProperty to accumulate positions from the sampled position property.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  CallbackProperty,
  Cartesian3,
  Color,
  type Viewer as CesiumViewer,
  type Entity,
  type SampledPositionProperty,
} from "cesium";

interface DroneTrailEntityProps {
  viewer: CesiumViewer | null;
  positionProperty: SampledPositionProperty | null;
}

const TRAIL_ENTITY_ID = "sim-drone-trail";
const TRAIL_COLOR = Color.fromCssColorString("#dff140").withAlpha(0.5);
const UPDATE_INTERVAL = 500; // ms between position samples

export function DroneTrailEntity({ viewer, positionProperty }: DroneTrailEntityProps) {
  const positionsRef = useRef<Cartesian3[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !positionProperty) return;

    positionsRef.current = [];

    const positionsCallback = new CallbackProperty(() => {
      return positionsRef.current.length >= 2 ? positionsRef.current.slice() : [];
    }, false);

    const entity: Entity = viewer.entities.add({
      id: TRAIL_ENTITY_ID,
      polyline: {
        positions: positionsCallback,
        width: 2,
        material: TRAIL_COLOR,
        clampToGround: false,
      },
    });

    // Sample position at regular intervals
    intervalRef.current = setInterval(() => {
      if (!viewer || viewer.isDestroyed() || !viewer.clock.shouldAnimate) return;
      const time = viewer.clock.currentTime;
      const pos = positionProperty.getValue(time);
      if (pos) {
        positionsRef.current.push(Cartesian3.clone(pos));
        viewer.scene.requestRender();
      }
    }, UPDATE_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (!viewer.isDestroyed()) viewer.entities.removeById(TRAIL_ENTITY_ID);
      positionsRef.current = [];
    };
  }, [viewer, positionProperty]);

  return null;
}
