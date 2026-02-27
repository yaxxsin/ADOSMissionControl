"use client";

import { useTelemetryFreshness } from "@/hooks/use-telemetry-freshness";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

type TelemetryChannel = "attitude" | "position" | "battery" | "gps" | "vfr" | "rc" | "sysStatus" | "radio";

const DISPLAY_CHANNELS: { key: TelemetryChannel; label: string; short: string }[] = [
  { key: "attitude", label: "Attitude", short: "ATT" },
  { key: "position", label: "Position", short: "POS" },
  { key: "battery", label: "Battery", short: "BAT" },
  { key: "gps", label: "GPS", short: "GPS" },
  { key: "rc", label: "RC Input", short: "RC" },
  { key: "radio", label: "Radio", short: "RAD" },
];

const FRESHNESS_COLORS = {
  fresh: "bg-status-success",
  stale: "bg-status-warning",
  lost: "bg-status-error",
  none: "bg-bg-tertiary",
} as const;

/**
 * Row of per-channel freshness dots for key telemetry channels.
 * Green = receiving data, yellow = stale, red = lost, gray = never received.
 */
export function TelemetryFreshnessIndicator({ className }: { className?: string }) {
  const { getFreshness } = useTelemetryFreshness();

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {DISPLAY_CHANNELS.map(({ key, label, short }) => {
        const freshness = getFreshness(key);
        return (
          <Tooltip key={key} content={`${label}: ${freshness}`}>
            <div className="flex flex-col items-center gap-0.5">
              <div className={cn("w-1.5 h-1.5 rounded-full transition-colors", FRESHNESS_COLORS[freshness])} />
              <span className="text-[7px] font-mono text-text-tertiary leading-none">{short}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
