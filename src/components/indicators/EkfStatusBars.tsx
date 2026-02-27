"use client";

import { useTelemetryStore } from "@/stores/telemetry-store";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

interface EkfBar {
  label: string;
  key: "velocityVariance" | "posHorizVariance" | "posVertVariance" | "compassVariance" | "terrainAltVariance";
}

const EKF_BARS: EkfBar[] = [
  { label: "Velocity", key: "velocityVariance" },
  { label: "Pos Horiz", key: "posHorizVariance" },
  { label: "Pos Vert", key: "posVertVariance" },
  { label: "Compass", key: "compassVariance" },
  { label: "Terrain", key: "terrainAltVariance" },
];

function getBarColor(value: number): string {
  if (value < 0.5) return "bg-status-success";
  if (value < 0.8) return "bg-status-warning";
  return "bg-status-error";
}

/**
 * Horizontal bars showing EKF variance levels.
 * Green (<0.5), yellow (0.5-0.8), red (>0.8).
 */
export function EkfStatusBars({ className }: { className?: string }) {
  const ekf = useTelemetryStore((s) => s.ekf);
  const latest = ekf.latest();

  if (!latest) {
    return (
      <div className={cn("text-[10px] text-text-tertiary", className)}>
        No EKF data
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {EKF_BARS.map(({ label, key }) => {
        const value = latest[key];
        const pct = Math.min(value * 100, 100);
        return (
          <Tooltip key={key} content={`${label}: ${value.toFixed(3)}`}>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-text-tertiary w-12 text-right truncate">
                {label.substring(0, 6)}
              </span>
              <div className="flex-1 h-1.5 bg-bg-tertiary/50 rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", getBarColor(value))}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-text-tertiary w-8 tabular-nums">
                {value.toFixed(2)}
              </span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
