/**
 * @module SimulationHUD
 * @description Glassmorphism HUD overlay showing current telemetry during simulation playback.
 * Displays waypoint progress, altitude, speed, heading, and ETA.
 * @license GPL-3.0-only
 */

"use client";

import { useMissionStore } from "@/stores/mission-store";
import { useSimulationStore } from "@/stores/simulation-store";
import { useInterpolatedPosition } from "@/hooks/use-interpolated-position";
import { formatEta } from "@/lib/simulation-utils";
import { formatAlt, formatHeading } from "@/lib/telemetry-utils";

export function SimulationHUD() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const totalDuration = useSimulationStore((s) => s.totalDuration);
  const playbackState = useSimulationStore((s) => s.playbackState);
  const { pos, elapsed } = useInterpolatedPosition();

  if (waypoints.length === 0) return null;

  const remaining = Math.max(0, totalDuration - elapsed);

  const items = [
    { label: "WP", value: `${pos.currentWaypointIndex + 1}/${waypoints.length}` },
    { label: "ALT", value: formatAlt(pos.alt) },
    { label: "SPD", value: `${pos.speed.toFixed(1)} m/s` },
    { label: "HDG", value: formatHeading(pos.heading) },
    { label: "ETA", value: formatEta(remaining) },
  ];

  // Show HOLD indicator when speed is 0 and playing
  const isHolding = pos.speed === 0 && playbackState === "playing" && elapsed > 0 && elapsed < totalDuration;

  return (
    <div className="absolute top-4 right-4 z-10 min-w-[140px]">
      <div className="bg-bg-primary/70 backdrop-blur-md border border-border-default rounded-lg p-3 shadow-lg">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between items-center gap-4 py-0.5">
            <span className="text-[10px] font-mono text-text-tertiary">{item.label}</span>
            <span className="text-xs font-mono text-text-primary">{item.value}</span>
          </div>
        ))}
        {isHolding && (
          <div className="mt-1 pt-1 border-t border-border-default text-center">
            <span className="text-[10px] font-mono text-status-warning animate-pulse">HOLD</span>
          </div>
        )}
      </div>
    </div>
  );
}
