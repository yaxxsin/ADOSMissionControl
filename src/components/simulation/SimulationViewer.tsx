/**
 * @module SimulationViewer
 * @description Composition root for the mission simulation 3D view.
 * Builds SampledPositionProperty from flight plan, configures CesiumJS Clock,
 * syncs clock to store via onTick, and coordinates child components.
 * Zero per-frame React code — CesiumJS handles all interpolation natively.
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
  JulianDate,
  ClockRange,
  SampledPositionProperty,
  SampledProperty,
  LinearApproximation,
  type Viewer as CesiumViewer,
  type Clock,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { computeFlightPlan, interpolatePosition } from "@/lib/simulation-utils";
import {
  useSimulationStore,
  bindSimViewer,
  unbindSimViewer,
  type CameraMode,
} from "@/stores/simulation-store";
import { useSimHistoryStore } from "@/stores/simulation-history-store";
import { usePlanLibraryStore } from "@/stores/plan-library-store";

import CesiumScene from "./CesiumScene";
import { FlightPathEntity } from "./FlightPathEntity";
import { WaypointEntities } from "./WaypointEntities";
import { DroneEntity } from "./DroneEntity";
import { GcsEntity } from "./GcsEntity";
import { PlaybackControls } from "./PlaybackControls";
import { SimulationHUD } from "./SimulationHUD";
import { CameraModeSelector } from "./CameraModeSelector";

interface SimulationViewerProps {
  waypoints: Waypoint[];
  defaultSpeed: number;
}

export function SimulationViewer({ waypoints, defaultSpeed }: SimulationViewerProps) {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const prevCameraModeRef = useRef<CameraMode>("topdown");

  const cameraMode = useSimulationStore((s) => s.cameraMode);

  // Compute flight plan
  const flightPlan = useMemo(
    () => computeFlightPlan(waypoints, defaultSpeed),
    [waypoints, defaultSpeed]
  );
  const flightPlanRef = useRef(flightPlan);
  flightPlanRef.current = flightPlan;

  // Build SampledPositionProperty + SampledProperty<heading> from flight plan
  const { sampledPosition, sampledHeading, startJulian } = useMemo(() => {
    if (waypoints.length === 0 || flightPlan.segments.length === 0)
      return { sampledPosition: null, sampledHeading: null, startJulian: null };

    const startJulian = JulianDate.fromDate(new Date(0)); // Arbitrary epoch
    const sampledPosition = new SampledPositionProperty();
    const sampledHeading = new SampledProperty(Number);

    // Linear interpolation — drone flies in straight lines between waypoints
    sampledPosition.setInterpolationOptions({
      interpolationAlgorithm: LinearApproximation,
      interpolationDegree: 1,
    });
    sampledHeading.setInterpolationOptions({
      interpolationAlgorithm: LinearApproximation,
      interpolationDegree: 1,
    });

    let t = JulianDate.clone(startJulian);

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const pos = Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt);

      // Heading for this segment (or last segment for final waypoint)
      const segIdx = Math.min(i, flightPlan.segments.length - 1);
      const hdgRad = -CesiumMath.toRadians(flightPlan.segments[segIdx].heading);

      // Arrival sample
      sampledPosition.addSample(JulianDate.clone(t), pos);
      sampledHeading.addSample(JulianDate.clone(t), hdgRad);

      if (i < waypoints.length - 1) {
        const holdTime = wp.holdTime ?? 0;
        if (holdTime > 0) {
          // Duplicate position at departure = drone holds in place
          t = JulianDate.addSeconds(t, holdTime, new JulianDate());
          sampledPosition.addSample(JulianDate.clone(t), pos);
          sampledHeading.addSample(JulianDate.clone(t), hdgRad);
        }
        // Travel to next waypoint
        const seg = flightPlan.segments[i];
        const travelTime = seg.duration - (wp.holdTime ?? 0);
        if (travelTime > 0) {
          // Add heading sample at end of segment just before arrival
          // to prevent interpolation blending across segment boundaries
          const nextHdgRad = i + 1 < flightPlan.segments.length
            ? -CesiumMath.toRadians(flightPlan.segments[i + 1].heading)
            : hdgRad;
          const almostArrival = JulianDate.addSeconds(t, travelTime - 0.001, new JulianDate());
          sampledHeading.addSample(almostArrival, hdgRad);
          // If next segment has different heading, the jump happens at arrival
          t = JulianDate.addSeconds(t, travelTime, new JulianDate());
          // Next loop iteration adds the arrival sample with next segment heading
          // But we need the heading at the transition point to snap
          if (i + 1 < flightPlan.segments.length) {
            // The next iteration's arrival sample will use nextHdgRad
          }
          void nextHdgRad; // used conceptually in the loop
        }
      } else if (wp.holdTime) {
        // Last waypoint hold
        t = JulianDate.addSeconds(t, wp.holdTime, new JulianDate());
        sampledPosition.addSample(JulianDate.clone(t), pos);
        sampledHeading.addSample(JulianDate.clone(t), hdgRad);
      }
    }
    return { sampledPosition, sampledHeading, startJulian };
  }, [waypoints, flightPlan]);

  // Keep refs for onTick callback (avoids stale closures)
  const sampledPositionRef = useRef(sampledPosition);
  sampledPositionRef.current = sampledPosition;
  const sampledHeadingRef = useRef(sampledHeading);
  sampledHeadingRef.current = sampledHeading;

  // Reset simulation when waypoints change
  useEffect(() => {
    useSimulationStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints.length]);

  // Sync total duration
  useEffect(() => {
    useSimulationStore.getState().setTotalDuration(flightPlan.totalDuration);
  }, [flightPlan.totalDuration]);

  // Configure CesiumJS Clock + bind to store
  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !startJulian) return;
    const store = useSimulationStore.getState();

    viewer.clock.startTime = JulianDate.clone(startJulian);
    viewer.clock.stopTime = JulianDate.addSeconds(
      startJulian,
      flightPlan.totalDuration,
      new JulianDate()
    );
    viewer.clock.currentTime = JulianDate.clone(startJulian);
    viewer.clock.clockRange = ClockRange.CLAMPED;
    viewer.clock.shouldAnimate = false;
    viewer.clock.multiplier = store.playbackSpeed;

    bindSimViewer(viewer, startJulian);

    return () => unbindSimViewer();
  }, [viewer, startJulian, flightPlan.totalDuration]);

  // clock.onTick listener — sync elapsed to store + follow camera
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const onTick = (clock: Clock) => {
      // 1. Sync elapsed to store (drives HUD, scrubber, all consumers)
      useSimulationStore.getState().syncFromClock();

      // 2. Follow camera (reads entity position directly — already interpolated by CesiumJS)
      const { cameraMode } = useSimulationStore.getState();
      if (cameraMode === "follow" && sampledPositionRef.current && sampledHeadingRef.current) {
        const pos = sampledPositionRef.current.getValue(clock.currentTime);
        const hdg = sampledHeadingRef.current.getValue(clock.currentTime);
        if (pos) {
          const transform = Transforms.eastNorthUpToFixedFrame(pos);
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

  // Record simulation history when playback completes (elapsed reaches totalDuration)
  const completionRecorded = useRef(false);
  const playbackState = useSimulationStore((s) => s.playbackState);

  useEffect(() => {
    const { elapsed: e, totalDuration: td, playbackState: ps } = useSimulationStore.getState();
    // Reset flag when playback starts
    if (playbackState === "playing") {
      completionRecorded.current = false;
    }
    // Record when playback pauses at the end (natural completion)
    if (playbackState === "paused" && td > 0 && e >= td && !completionRecorded.current) {
      completionRecorded.current = true;
      const lib = usePlanLibraryStore.getState();
      const activePlan = lib.plans.find((p) => p.id === lib.activePlanId);
      useSimHistoryStore.getState().addEntry({
        planId: lib.activePlanId || "unknown",
        planName: activePlan?.name || "Untitled Plan",
        timestamp: Date.now(),
        duration: td,
        waypointCount: waypoints.length,
        completedFully: true,
      });
    }
  }, [playbackState, waypoints.length]);

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
        positionProperty={sampledPosition}
        headingProperty={sampledHeading}
      />
      <GcsEntity viewer={viewer} />

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
