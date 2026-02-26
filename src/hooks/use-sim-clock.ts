/**
 * @module use-sim-clock
 * @description CesiumJS Clock lifecycle hook — configures clock timing,
 * binds/unbinds to simulation store, syncs elapsed on every tick,
 * and handles follow-camera per-frame tracking.
 * @license GPL-3.0-only
 */

import { useEffect, useRef } from "react";
import {
  JulianDate,
  ClockRange,
  Transforms,
  HeadingPitchRange,
  Cartesian3,
  Cartographic,
  type Viewer as CesiumViewer,
  type Clock,
} from "cesium";
import {
  useSimulationStore,
  bindSimViewer,
  unbindSimViewer,
} from "@/stores/simulation-store";
import type { SampledProperties } from "@/lib/build-sampled-properties";

/**
 * Manage CesiumJS Clock lifecycle: configure start/stop times,
 * bind to store, sync elapsed per tick, drive follow camera.
 */
export function useSimClock(
  viewer: CesiumViewer | null,
  sampled: SampledProperties | null,
  totalDuration: number
): void {
  // Refs for onTick callback (avoids stale closures)
  const sampledRef = useRef(sampled);
  sampledRef.current = sampled;

  // Effect 1: Configure Clock + bind to store
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !sampled) return;
    const { startJulian } = sampled;
    const store = useSimulationStore.getState();

    viewer.clock.startTime = JulianDate.clone(startJulian);
    viewer.clock.stopTime = JulianDate.addSeconds(
      startJulian,
      totalDuration,
      new JulianDate()
    );
    viewer.clock.currentTime = JulianDate.clone(startJulian);
    viewer.clock.clockRange = ClockRange.CLAMPED;
    viewer.clock.shouldAnimate = false;
    viewer.clock.multiplier = store.playbackSpeed;

    bindSimViewer(viewer, startJulian);

    return () => unbindSimViewer();
  }, [viewer, sampled, totalDuration]);

  // Effect 2: onTick — sync elapsed + follow camera
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const onTick = (clock: Clock) => {
      // 1. Sync elapsed to store (drives HUD, scrubber, all consumers)
      useSimulationStore.getState().syncFromClock();

      // 2. Follow camera (reads entity position directly — already interpolated by CesiumJS)
      const { cameraMode } = useSimulationStore.getState();
      const s = sampledRef.current;
      if (cameraMode === "follow" && s?.sampledPosition && s?.sampledHeading) {
        const pos = s.sampledPosition.getValue(clock.currentTime);
        const hdg = s.sampledHeading.getValue(clock.currentTime);
        if (pos) {
          // Terrain-adjust: pos altitude is AGL above ellipsoid, offset by terrain height
          const carto = Cartographic.fromCartesian(pos);
          const terrainH = viewer.scene.globe.getHeight(carto);
          const adjustedPos = terrainH !== undefined
            ? Cartesian3.fromRadians(carto.longitude, carto.latitude, carto.height + terrainH)
            : pos;
          const transform = Transforms.eastNorthUpToFixedFrame(adjustedPos);
          const rawRange = Cartesian3.magnitude(viewer.camera.position);
          const range = Math.max(20, Math.min(10000, rawRange > 0 ? rawRange : 200));
          viewer.camera.lookAtTransform(
            transform,
            new HeadingPitchRange(
              typeof hdg === "number" ? -hdg : 0,
              viewer.camera.pitch,
              range
            )
          );
        }
      }
    };

    viewer.clock.onTick.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) viewer.clock.onTick.removeEventListener(onTick);
    };
  }, [viewer]);
}
