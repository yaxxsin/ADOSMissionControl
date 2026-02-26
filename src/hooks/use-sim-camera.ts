/**
 * @module use-sim-camera
 * @description 4-mode camera state machine for simulation view.
 * Handles transitions between topdown, follow, orbit, and free camera modes.
 * Runs once per mode change, NOT per frame.
 * @license GPL-3.0-only
 */

import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Cartographic,
  BoundingSphere,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix4,
  Transforms,
  type Viewer as CesiumViewer,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import type { FlightPlan } from "@/lib/simulation-utils";
import { interpolatePosition } from "@/lib/simulation-utils";
import { useSimulationStore, type CameraMode } from "@/stores/simulation-store";

/**
 * Camera mode transition hook — positions camera on mode change.
 * Follow-camera per-frame tracking is handled by useSimClock's onTick.
 */
export function useSimCamera(
  viewer: CesiumViewer | null,
  waypoints: Waypoint[],
  flightPlan: FlightPlan
): void {
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const prevModeRef = useRef<CameraMode>("topdown");
  const flightPlanRef = useRef(flightPlan);
  flightPlanRef.current = flightPlan;

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length === 0) return;

    const prev = prevModeRef.current;
    prevModeRef.current = cameraMode;

    // When leaving follow mode, unlock the camera transform so
    // ScreenSpaceCameraController (scroll/pan/rotate) works again
    if (prev === "follow" && cameraMode !== "follow") {
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    }

    if (cameraMode === "topdown") {
      const positions = waypoints.map((wp) =>
        Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );
      const sphere = BoundingSphere.fromPoints(positions);
      const range = Math.max(sphere.radius * 3, 500);
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: 0.8,
        offset: new HeadingPitchRange(0, CesiumMath.toRadians(-90), range),
      });
    } else if (cameraMode === "follow") {
      // Instant lookAtTransform setup — ScreenSpaceCameraController respects this
      const elapsed = useSimulationStore.getState().elapsed;
      const pos = interpolatePosition(flightPlanRef.current.segments, waypoints, elapsed);
      // Terrain-adjust: pos.alt is AGL, offset by terrain height for correct world position
      const carto = Cartographic.fromDegrees(pos.lon, pos.lat);
      const terrainH = viewer.scene.globe.getHeight(carto) ?? 0;
      const target = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt + terrainH);
      const transform = Transforms.eastNorthUpToFixedFrame(target);
      viewer.camera.lookAtTransform(
        transform,
        new HeadingPitchRange(
          CesiumMath.toRadians(pos.heading),
          CesiumMath.toRadians(-30),
          200
        )
      );
    } else if (cameraMode === "orbit") {
      const positions = waypoints.map((wp) =>
        Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt)
      );
      const sphere = BoundingSphere.fromPoints(positions);
      viewer.camera.flyToBoundingSphere(sphere, {
        duration: 0.8,
        offset: new HeadingPitchRange(
          CesiumMath.toRadians(45),
          CesiumMath.toRadians(-45),
          Math.max(sphere.radius * 4, 800)
        ),
      });
    } else if (cameraMode === "free") {
      viewer.camera.lookAtTransform(Matrix4.IDENTITY);
    }
  }, [viewer, cameraMode, waypoints]);
}
