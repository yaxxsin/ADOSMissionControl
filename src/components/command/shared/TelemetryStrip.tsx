"use client";

/**
 * @module TelemetryStrip
 * @description Compact vertical telemetry strip for the Drone Context Rail.
 * @license GPL-3.0-only
 */

import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";

export function TelemetryStrip() {
  const status = useAgentStore((s) => s.status);
  const resources = useAgentStore((s) => s.resources);

  if (!status) return null;

  return (
    <div className="rounded border border-border-default bg-bg-tertiary p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary">Mode</span>
        <span className="text-[10px] font-mono text-accent-primary font-medium">
          {status.mode}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary">State</span>
        <span
          className={cn(
            "text-[10px] font-mono font-medium",
            status.armed ? "text-status-error" : "text-status-success"
          )}
        >
          {status.armed ? "ARMED" : "DISARMED"}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-tertiary">GPS</span>
        <span className="text-[10px] font-mono text-text-secondary">
          {status.gps_fix}D / {status.satellites} sats
        </span>
      </div>
      {resources && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">CPU</span>
            <span className="text-[10px] font-mono text-text-secondary">
              {resources.cpu_percent.toFixed(0)}%
            </span>
          </div>
          {resources.temperature !== null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-text-tertiary">Temp</span>
              <span
                className={cn(
                  "text-[10px] font-mono",
                  resources.temperature >= 80
                    ? "text-status-error"
                    : resources.temperature >= 65
                      ? "text-status-warning"
                      : "text-text-secondary"
                )}
              >
                {resources.temperature.toFixed(0)}°C
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
