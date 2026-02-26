/**
 * @module DroneEntity
 * @description Renders the animated drone arrow billboard in the 3D scene.
 * Position and heading driven entirely by CesiumJS SampledPositionProperty
 * and SampledProperty — zero per-frame React code.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Cartesian3,
  type Viewer as CesiumViewer,
  type Entity,
  type SampledPositionProperty,
  type SampledProperty,
} from "cesium";

interface DroneEntityProps {
  viewer: CesiumViewer | null;
  positionProperty: SampledPositionProperty | null;
  headingProperty: SampledProperty | null;
}

const DRONE_ENTITY_ID = "sim-drone";

const ARROW_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
  <polygon points="12,2 20,20 12,16 4,20" fill="#dff140" stroke="#fff" stroke-width="1" opacity="0.95"/>
</svg>`;
const ARROW_DATA_URL = `data:image/svg+xml;base64,${typeof window !== "undefined" ? btoa(ARROW_SVG) : ""}`;

export function DroneEntity({ viewer, positionProperty, headingProperty }: DroneEntityProps) {
  const droneRef = useRef<Entity | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !positionProperty) return;

    const drone = viewer.entities.add({
      id: DRONE_ENTITY_ID,
      position: positionProperty, // CesiumJS evaluates at clock.currentTime every frame
      billboard: {
        image: ARROW_DATA_URL,
        width: 28,
        height: 28,
        // SampledProperty IS a Property — CesiumJS evaluates it natively
        rotation: headingProperty ?? undefined,
        alignedAxis: Cartesian3.UNIT_Z,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    droneRef.current = drone;

    return () => {
      if (viewer && !viewer.isDestroyed()) viewer.entities.removeById(DRONE_ENTITY_ID);
      droneRef.current = null;
    };
  }, [viewer, positionProperty, headingProperty]);

  return null;
}
