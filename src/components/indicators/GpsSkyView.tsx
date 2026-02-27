"use client";

import { useTelemetryStore } from "@/stores/telemetry-store";
import { cn } from "@/lib/utils";
import { Satellite } from "lucide-react";

const FIX_TYPES: Record<number, { label: string; color: string }> = {
  0: { label: "No GPS", color: "text-text-tertiary" },
  1: { label: "No Fix", color: "text-status-error" },
  2: { label: "2D Fix", color: "text-status-warning" },
  3: { label: "3D Fix", color: "text-status-success" },
  4: { label: "DGPS", color: "text-status-success" },
  5: { label: "RTK Float", color: "text-accent-primary" },
  6: { label: "RTK Fixed", color: "text-accent-primary" },
};

/**
 * GPS status display: fix type, satellite count, HDOP.
 */
export function GpsSkyView({ className }: { className?: string }) {
  const gps = useTelemetryStore((s) => s.gps);
  const latest = gps.latest();

  if (!latest) {
    return (
      <div className={cn("flex items-center gap-1 text-text-tertiary", className)}>
        <Satellite size={12} />
        <span className="text-[10px] font-mono">No GPS</span>
      </div>
    );
  }

  const fix = FIX_TYPES[latest.fixType] ?? FIX_TYPES[0];
  const hdopColor = latest.hdop < 1.5 ? "text-status-success"
    : latest.hdop < 3.0 ? "text-status-warning"
    : "text-status-error";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Satellite size={12} className={fix.color} />
      <span className={cn("text-[10px] font-mono font-medium", fix.color)}>
        {fix.label}
      </span>
      <span className="text-[10px] font-mono text-text-secondary">
        {latest.satellites} sats
      </span>
      <span className={cn("text-[10px] font-mono", hdopColor)}>
        HDOP {latest.hdop.toFixed(1)}
      </span>
    </div>
  );
}
