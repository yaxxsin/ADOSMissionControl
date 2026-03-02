/**
 * @module SimulationPanel
 * @description Right-side panel for simulation mode showing waypoint progress list,
 * flight plan stats, and playback summary.
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import { MapPin, ChevronRight, ChevronDown, Mountain } from "lucide-react";
import type { Waypoint } from "@/lib/types";
import { formatEta } from "@/lib/simulation-utils";
import { formatAlt } from "@/lib/telemetry-utils";
import { useSimulationStore } from "@/stores/simulation-store";
import { useInterpolatedPosition } from "@/hooks/use-interpolated-position";
import { usePlannerStore } from "@/stores/planner-store";
import { cn } from "@/lib/utils";
import { AltitudeProfile } from "./AltitudeProfile";
import { TerrainProfileChart } from "@/components/planner/TerrainProfileChart";

interface SimulationPanelProps {
  waypoints: Waypoint[];
  onClose: () => void;
}

export function SimulationPanel({
  waypoints,
  onClose,
}: SimulationPanelProps) {
  const totalDuration = useSimulationStore((s) => s.totalDuration);
  const playbackState = useSimulationStore((s) => s.playbackState);
  const setSelectedWaypoint = usePlannerStore((s) => s.setSelectedWaypoint);
  const { pos, flightPlan } = useInterpolatedPosition();
  const [terrainExpanded, setTerrainExpanded] = useState(false);

  return (
    <div className="w-[320px] shrink-0 flex flex-col border-l border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <h2 className="text-sm font-display font-semibold text-text-primary">Simulation</h2>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary cursor-pointer"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Stats summary */}
      <div className="px-3 py-2 border-b border-border-default grid grid-cols-2 gap-2">
        <div>
          <span className="text-[10px] font-mono text-text-tertiary">Duration</span>
          <p className="text-xs font-mono text-text-primary">{formatEta(totalDuration)}</p>
        </div>
        <div>
          <span className="text-[10px] font-mono text-text-tertiary">Distance</span>
          <p className="text-xs font-mono text-text-primary">
            {flightPlan.totalDistance >= 1000
              ? `${(flightPlan.totalDistance / 1000).toFixed(2)} km`
              : `${Math.round(flightPlan.totalDistance)} m`}
          </p>
        </div>
        <div>
          <span className="text-[10px] font-mono text-text-tertiary">Waypoints</span>
          <p className="text-xs font-mono text-text-primary">{waypoints.length}</p>
        </div>
        <div>
          <span className="text-[10px] font-mono text-text-tertiary">State</span>
          <p className="text-xs font-mono text-text-primary capitalize">{playbackState}</p>
        </div>
      </div>

      {/* Altitude profile */}
      <div className="px-3 py-2 border-b border-border-default">
        <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">
          Altitude Profile
        </h3>
        <AltitudeProfile waypoints={waypoints} flightPlan={flightPlan} />
      </div>

      {/* Terrain profile (collapsible) */}
      {waypoints.length >= 2 && (
        <div className="border-b border-border-default">
          <button
            onClick={() => setTerrainExpanded(!terrainExpanded)}
            className="w-full flex items-center gap-1.5 px-3 py-2 cursor-pointer hover:bg-bg-tertiary transition-colors"
          >
            <Mountain size={12} className="text-text-tertiary" />
            <span className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider flex-1 text-left">
              Terrain Profile
            </span>
            <ChevronDown
              size={12}
              className={cn(
                "text-text-tertiary transition-transform",
                terrainExpanded && "rotate-180"
              )}
            />
          </button>
          {terrainExpanded && (
            <TerrainProfileChart waypoints={waypoints} />
          )}
        </div>
      )}

      {/* Waypoint progress list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-3 py-2">
          <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
            Waypoint Progress
          </h3>
          <div className="space-y-1">
            {waypoints.map((wp, i) => {
              const isCurrent = i === pos.currentWaypointIndex;
              const isCompleted = i < pos.currentWaypointIndex;
              const isUpcoming = i > pos.currentWaypointIndex;

              return (
                <button
                  key={wp.id}
                  onClick={() => setSelectedWaypoint(wp.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors cursor-pointer",
                    isCurrent && "bg-accent-primary/10 border border-accent-primary/30",
                    isCompleted && "opacity-50",
                    isUpcoming && "hover:bg-bg-tertiary"
                  )}
                >
                  <MapPin
                    size={12}
                    className={cn(
                      isCurrent
                        ? "text-accent-primary"
                        : isCompleted
                          ? "text-status-success"
                          : "text-text-tertiary"
                    )}
                  />
                  <span className="text-xs font-mono text-text-primary flex-1">
                    WP {i + 1}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    {formatAlt(wp.alt)}
                  </span>
                  {wp.holdTime && wp.holdTime > 0 && (
                    <span className="text-[9px] font-mono text-status-warning">
                      {wp.holdTime}s
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
