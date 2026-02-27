"use client";

import { useTelemetryStore } from "@/stores/telemetry-store";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

const THRESHOLD_WARNING = 30; // m/s/s
const THRESHOLD_CRITICAL = 60; // m/s/s
const MAX_DISPLAY = 90; // m/s/s

interface Axis {
  label: string;
  key: "vibrationX" | "vibrationY" | "vibrationZ";
}

const AXES: Axis[] = [
  { label: "X", key: "vibrationX" },
  { label: "Y", key: "vibrationY" },
  { label: "Z", key: "vibrationZ" },
];

function getColor(value: number): string {
  if (value < THRESHOLD_WARNING) return "bg-status-success";
  if (value < THRESHOLD_CRITICAL) return "bg-status-warning";
  return "bg-status-error";
}

/**
 * XYZ vibration gauges with warning/critical threshold lines.
 */
export function VibrationGauges({ className }: { className?: string }) {
  const vibration = useTelemetryStore((s) => s.vibration);
  const latest = vibration.latest();

  if (!latest) {
    return (
      <div className={cn("text-[10px] text-text-tertiary", className)}>
        No vibration data
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {AXES.map(({ label, key }) => {
        const value = latest[key];
        const pct = Math.min((value / MAX_DISPLAY) * 100, 100);
        const warnPct = (THRESHOLD_WARNING / MAX_DISPLAY) * 100;
        const critPct = (THRESHOLD_CRITICAL / MAX_DISPLAY) * 100;

        return (
          <Tooltip key={key} content={`Vibration ${label}: ${value.toFixed(1)} m/s/s (warn: ${THRESHOLD_WARNING}, crit: ${THRESHOLD_CRITICAL})`}>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-text-tertiary w-3">{label}</span>
              <div className="flex-1 h-2 bg-bg-tertiary/50 rounded-full overflow-hidden relative">
                {/* Threshold markers */}
                <div
                  className="absolute top-0 bottom-0 w-px bg-status-warning/40"
                  style={{ left: `${warnPct}%` }}
                />
                <div
                  className="absolute top-0 bottom-0 w-px bg-status-error/40"
                  style={{ left: `${critPct}%` }}
                />
                {/* Value bar */}
                <div
                  className={cn("h-full rounded-full transition-all", getColor(value))}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[9px] font-mono text-text-tertiary w-10 tabular-nums text-right">
                {value.toFixed(1)}
              </span>
            </div>
          </Tooltip>
        );
      })}

      {/* Clipping counters */}
      <div className="flex gap-2 text-[9px] font-mono text-text-tertiary">
        <span>Clip: {latest.clipping0}/{latest.clipping1}/{latest.clipping2}</span>
      </div>
    </div>
  );
}
