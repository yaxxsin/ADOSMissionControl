/**
 * @module SimulationViewer
 * @description Composition root for the mission simulation 3D view.
 * Manages the CesiumJS viewer lifecycle, animation loop, camera updates,
 * and coordinates all child simulation components.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, useMemo, useCallback, useState } from "react";
import {
  Cartesian3,
  Math as CesiumMath,
  BoundingSphere,
  HeadingPitchRange,
  Matrix4,
  Transforms,
  type Viewer as CesiumViewer,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { computeFlightPlan, interpolatePosition } from "@/lib/simulation-utils";
import { useSimulationStore, type CameraMode } from "@/stores/simulation-store";

import CesiumScene from "./CesiumScene";
import { FlightPathEntity } from "./FlightPathEntity";
import { WaypointEntities } from "./WaypointEntities";
import { DroneEntity } from "./DroneEntity";
import { PlaybackControls } from "./PlaybackControls";
import { SimulationHUD } from "./SimulationHUD";
import { CameraModeSelector } from "./CameraModeSelector";

interface SimulationViewerProps {
  waypoints: Waypoint[];
  defaultSpeed: number;
}

export function SimulationViewer({ waypoints, defaultSpeed }: SimulationViewerProps) {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const prevCameraModeRef = useRef<CameraMode>("topdown");

  const playbackState = useSimulationStore((s) => s.playbackState);
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const elapsed = useSimulationStore((s) => s.elapsed);

  // Compute flight plan
  const flightPlan = useMemo(
    () => computeFlightPlan(waypoints, defaultSpeed),
    [waypoints, defaultSpeed]
  );
  const flightPlanRef = useRef(flightPlan);
  flightPlanRef.current = flightPlan;

  // Reset simulation when waypoints change (runs first)
  useEffect(() => {
    useSimulationStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints.length]);

  // Sync total duration (runs after reset)
  useEffect(() => {
    useSimulationStore.getState().setTotalDuration(flightPlan.totalDuration);
  }, [flightPlan.totalDuration]);

  // Animation loop
  useEffect(() => {
    if (playbackState !== "playing") return;
    lastTimeRef.current = performance.now();

    function frame(now: number) {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      useSimulationStore.getState().tick(delta);
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playbackState]);

  // Camera mode transition — runs once per mode change, NOT per frame
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || waypoints.length === 0) return;

    const prev = prevCameraModeRef.current;
    prevCameraModeRef.current = cameraMode;

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
      const target = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt);
      const transform = Transforms.eastNorthUpToFixedFrame(target);
      viewer.camera.lookAtTransform(
        transform,
        new HeadingPitchRange(
          CesiumMath.toRadians(pos.heading),
          CesiumMath.toRadians(-30),
          200
        )
      );
    }
  }, [viewer, cameraMode, waypoints]);

  // Follow-mode per-frame tracking — chase cam locked to drone heading
  // Heading always matches drone travel direction (auto-rotates behind drone at turns)
  // Range and pitch read from camera state so user can scroll-zoom and tilt
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || cameraMode !== "follow" || waypoints.length === 0) return;

    const pos = interpolatePosition(flightPlanRef.current.segments, waypoints, elapsed);
    const target = Cartesian3.fromDegrees(pos.lon, pos.lat, pos.alt);

    // Read user-adjustable offset (scroll = zoom, drag = tilt)
    const rawRange = Cartesian3.magnitude(viewer.camera.position);
    const range = (rawRange > 0 && rawRange < 10000) ? rawRange : 200;
    const pitch = viewer.camera.pitch;

    // Chase cam: heading locked to drone direction, pitch/range user-adjustable
    const transform = Transforms.eastNorthUpToFixedFrame(target);
    viewer.camera.lookAtTransform(
      transform,
      new HeadingPitchRange(CesiumMath.toRadians(pos.heading), pitch, range)
    );
  }, [viewer, elapsed, cameraMode, waypoints]);

  // Setting viewer triggers the cameraMode effect which handles initial view
  const handleViewerReady = useCallback((v: CesiumViewer) => {
    setViewer(v);
  }, []);

  return (
    <div className="flex-1 relative min-w-0 h-full">
      <CesiumScene onReady={handleViewerReady} />

      <FlightPathEntity viewer={viewer} waypoints={waypoints} />
      <WaypointEntities viewer={viewer} waypoints={waypoints} />
      <DroneEntity
        viewer={viewer}
        waypoints={waypoints}
        segments={flightPlan.segments}
      />

      <CameraModeSelector />
      <SimulationHUD waypoints={waypoints} segments={flightPlan.segments} />
      <PlaybackControls waypoints={waypoints} totalDuration={flightPlan.totalDuration} />

      {/* Empty state */}
      {waypoints.length < 2 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-bg-primary/80 backdrop-blur-md rounded-lg px-6 py-4 border border-border-default text-center">
            <p className="text-sm text-text-secondary">
              Add at least 2 waypoints in the Plan tab to simulate
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
