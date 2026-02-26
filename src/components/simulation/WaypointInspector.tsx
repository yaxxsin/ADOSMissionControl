/**
 * @module WaypointInspector
 * @description Real-time waypoint timing inspector for the simulation left panel.
 * Shows active waypoint details and upcoming waypoints with ETAs.
 * @license GPL-3.0-only
 */
"use client";

import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";
import { useSimulationStore } from "@/stores/simulation-store";
import { useInterpolatedPosition } from "@/hooks/use-interpolated-position";
import { formatEta } from "@/lib/simulation-utils";
import { formatAlt } from "@/lib/telemetry-utils";

export function WaypointInspector() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const playbackState = useSimulationStore((s) => s.playbackState);
  const seek = useSimulationStore((s) => s.seek);
  const { pos, flightPlan, elapsed } = useInterpolatedPosition();

  // Memoize cumulative times — only changes when flight plan changes
  const cumulativeTimes = useMemo(() => {
    const times: number[] = [];
    for (const seg of flightPlan.segments) {
      // seg.duration already includes holdTime — don't add it again
      times.push(seg.cumulativeDuration);
    }
    return times;
  }, [flightPlan.segments]);

  if (waypoints.length < 2) {
    return (
      <div className="px-3 py-3">
        <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">
          Waypoint Inspector
        </h3>
        <p className="text-[10px] text-text-tertiary">No simulation running</p>
      </div>
    );
  }

  const currentWp = waypoints[pos.currentWaypointIndex];
  const upcomingWps = waypoints.slice(pos.currentWaypointIndex + 1, pos.currentWaypointIndex + 4);

  return (
    <div className="px-3 py-3">
      <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
        Waypoint Inspector
      </h3>

      {/* Active waypoint */}
      {currentWp && (
        <div className="bg-accent-primary/10 border border-accent-primary/30 p-2 mb-2">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin size={10} className="text-accent-primary" />
            <span className="text-xs font-mono font-semibold text-text-primary">
              WP {pos.currentWaypointIndex + 1} / {waypoints.length}
            </span>
            <span className="text-[9px] font-mono text-accent-primary ml-auto uppercase">
              {playbackState === "playing" ? "Active" : playbackState}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div>
              <span className="text-[9px] text-text-tertiary">Alt</span>
              <p className="text-[10px] font-mono text-text-primary">{formatAlt(currentWp.alt)}</p>
            </div>
            <div>
              <span className="text-[9px] text-text-tertiary">Elapsed</span>
              <p className="text-[10px] font-mono text-text-primary">{formatEta(elapsed)}</p>
            </div>
            <div>
              <span className="text-[9px] text-text-tertiary">Speed</span>
              <p className="text-[10px] font-mono text-text-primary">{pos.speed.toFixed(1)} m/s</p>
            </div>
            <div>
              <span className="text-[9px] text-text-tertiary">Heading</span>
              <p className="text-[10px] font-mono text-text-primary">{Math.round(pos.heading)}&deg;</p>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming waypoints */}
      {upcomingWps.length > 0 && (
        <div>
          <span className="text-[9px] text-text-tertiary mb-1 block">Upcoming</span>
          {upcomingWps.map((wp, i) => {
            const wpIdx = pos.currentWaypointIndex + 1 + i;
            const segIdx = Math.min(wpIdx - 1, cumulativeTimes.length - 1);
            const eta = segIdx >= 0 ? Math.max(0, cumulativeTimes[segIdx] - elapsed) : 0;

            return (
              <button
                key={wp.id}
                onClick={() => {
                  if (segIdx >= 0 && cumulativeTimes[segIdx] !== undefined) {
                    seek(cumulativeTimes[segIdx] - (flightPlan.segments[segIdx]?.duration || 0));
                  }
                }}
                className="w-full flex items-center gap-2 px-1.5 py-1 hover:bg-bg-tertiary transition-colors cursor-pointer"
              >
                <span className="text-[10px] font-mono text-text-tertiary w-8">WP {wpIdx + 1}</span>
                <span className="text-[10px] font-mono text-text-tertiary">{formatAlt(wp.alt)}</span>
                <span className="text-[10px] font-mono text-text-tertiary ml-auto">
                  ETA {formatEta(eta)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
