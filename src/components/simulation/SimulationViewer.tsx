/**
 * @module SimulationViewer
 * @description Composition root for the mission simulation 3D view.
 * Delegates CesiumJS concerns to focused hooks: useSimClock (clock lifecycle),
 * useSimCamera (camera state machine), useSimCompletion (history recording).
 * Entity components render renderlessly into the CesiumJS viewer.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useMemo, useCallback, useState } from "react";
import { useQuery } from "convex/react";
import type { Viewer as CesiumViewer } from "cesium";
import type { Waypoint } from "@/lib/types";
import { computeFlightPlan } from "@/lib/simulation-utils";
import { buildSampledProperties } from "@/lib/build-sampled-properties";
import { useSimulationStore } from "@/stores/simulation-store";
import { useSimClock } from "@/hooks/use-sim-clock";
import { useSimCamera } from "@/hooks/use-sim-camera";
import { useSimCompletion } from "@/hooks/use-sim-completion";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { communityApi } from "@/lib/community-api";

import CesiumScene from "./CesiumScene";
import { FlightPathEntity } from "./FlightPathEntity";
import { WaypointEntities } from "./WaypointEntities";
import { DroneEntity } from "./DroneEntity";
import { GcsEntity } from "./GcsEntity";
import { PlaybackControls } from "./PlaybackControls";
import { SimulationHUD } from "./SimulationHUD";
import { CameraModeSelector } from "./CameraModeSelector";

/** Fetches Cesium Ion token from Convex. Only mount when Convex is available. */
function ConvexCesiumToken({ onToken }: { onToken: (token: string | null) => void }) {
  const config = useQuery(communityApi.clientConfig.get, {});
  useEffect(() => {
    // config is undefined while loading, null if query not found
    if (config !== undefined) {
      onToken((config as { cesiumIonToken?: string } | null)?.cesiumIonToken ?? null);
    }
  }, [config, onToken]);
  return null;
}

interface SimulationViewerProps {
  waypoints: Waypoint[];
  defaultSpeed: number;
}

export function SimulationViewer({ waypoints, defaultSpeed }: SimulationViewerProps) {
  const [viewer, setViewer] = useState<CesiumViewer | null>(null);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const convexAvailable = useConvexAvailable();
  const [cesiumToken, setCesiumToken] = useState<string | undefined>(undefined);
  const handleCesiumToken = useCallback((t: string | null) => {
    setCesiumToken(t ?? undefined);
  }, []);

  const flightPlan = useMemo(
    () => computeFlightPlan(waypoints, defaultSpeed),
    [waypoints, defaultSpeed]
  );

  const sampled = useMemo(
    () => buildSampledProperties(waypoints, flightPlan),
    [waypoints, flightPlan]
  );

  // Reset simulation when waypoints change
  useEffect(() => {
    useSimulationStore.getState().reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints.length]);

  // Sync total duration
  useEffect(() => {
    useSimulationStore.getState().setTotalDuration(flightPlan.totalDuration);
  }, [flightPlan.totalDuration]);

  // Hooks handle all CesiumJS lifecycle
  useSimClock(viewer, sampled, flightPlan.totalDuration);
  useSimCamera(viewer, waypoints, flightPlan);
  useSimCompletion(waypoints);

  const handleViewerReady = useCallback((v: CesiumViewer) => setViewer(v), []);

  return (
    <div className="flex-1 relative min-w-0 h-full">
      {convexAvailable && <ConvexCesiumToken onToken={handleCesiumToken} />}
      <CesiumScene cesiumToken={cesiumToken} onReady={handleViewerReady} onError={(e) => setViewerError(e.message)} />

      <FlightPathEntity viewer={viewer} waypoints={waypoints} />
      <WaypointEntities viewer={viewer} waypoints={waypoints} />
      <DroneEntity
        viewer={viewer}
        positionProperty={sampled?.sampledPosition ?? null}
        headingProperty={sampled?.sampledHeading ?? null}
      />
      <GcsEntity viewer={viewer} />

      <CameraModeSelector />
      <SimulationHUD />
      <PlaybackControls waypoints={waypoints} totalDuration={flightPlan.totalDuration} />

      {/* Error state */}
      {viewerError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-bg-primary/80 backdrop-blur-md rounded-lg px-6 py-4 border border-red-500/30 text-center max-w-sm">
            <p className="text-sm text-red-400">3D view failed: {viewerError}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {waypoints.length < 2 && !viewerError && (
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
