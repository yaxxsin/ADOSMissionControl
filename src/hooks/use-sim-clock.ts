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

/** Distance threshold for terrain cache invalidation (~10m in radians). */
const CACHE_THRESHOLD_RAD = 10 / 6_371_000;

/**
 * Manage CesiumJS Clock lifecycle: configure start/stop times,
 * bind to store, sync elapsed per tick, drive follow camera.
 */
export function useSimClock(
  viewer: CesiumViewer | null,
  sampled: SampledProperties | null,
  totalDuration: number,
  /** When true, sampled positions are absolute — skip terrain adjustment in follow cam. */
  useAbsolutePositions = false
): void {
  // Refs for onTick callback (avoids stale closures)
  const sampledRef = useRef(sampled);
  sampledRef.current = sampled;
  const absoluteRef = useRef(useAbsolutePositions);
  absoluteRef.current = useAbsolutePositions;

  // Terrain height cache — avoids per-frame globe.getHeight() calls
  const terrainCache = useRef({ lon: 0, lat: 0, height: 0 });

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

    return () => unbindSimViewer(viewer);
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
          let adjustedPos: Cartesian3;

          if (absoluteRef.current) {
            // Positions are already absolute — no terrain adjustment needed
            adjustedPos = pos;
          } else {
            // AGL mode: offset by terrain height with caching
            const carto = Cartographic.fromCartesian(pos);
            const cache = terrainCache.current;
            const dLon = Math.abs(carto.longitude - cache.lon);
            const dLat = Math.abs(carto.latitude - cache.lat);

            if (dLon > CACHE_THRESHOLD_RAD || dLat > CACHE_THRESHOLD_RAD) {
              const h = viewer.scene.globe.getHeight(carto);
              if (h !== undefined) {
                cache.lon = carto.longitude;
                cache.lat = carto.latitude;
                cache.height = h;
              }
            }

            adjustedPos = Cartesian3.fromRadians(
              carto.longitude,
              carto.latitude,
              carto.height + cache.height
            );
          }

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

      // 3. Request render for requestRenderMode support
      viewer.scene.requestRender();
    };

    viewer.clock.onTick.addEventListener(onTick);
    return () => {
      if (!viewer.isDestroyed()) viewer.clock.onTick.removeEventListener(onTick);
    };
  }, [viewer]);
}
