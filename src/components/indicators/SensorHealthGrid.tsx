"use client";

import { useSensorHealthStore } from "@/stores/sensor-health-store";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import {
  Check, X, AlertTriangle, Minus,
} from "lucide-react";

const STATUS_CONFIG = {
  healthy: { color: "text-status-success", bg: "bg-status-success/10", Icon: Check },
  unhealthy: { color: "text-status-warning", bg: "bg-status-warning/10", Icon: AlertTriangle },
  error: { color: "text-status-error", bg: "bg-status-error/10", Icon: X },
  not_present: { color: "text-text-tertiary", bg: "bg-bg-tertiary/50", Icon: Minus },
} as const;

/**
 * 32-sensor status grid decoded from MAV_SYS_STATUS_SENSOR bitmask.
 * Shows only present sensors by default, expandable to show all.
 */
export function SensorHealthGrid({
  showAll = false,
  compact = false,
  className,
}: {
  showAll?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const sensors = useSensorHealthStore((s) => s.sensors);
  const healthyCount = useSensorHealthStore((s) => s.getHealthySensorCount());
  const totalPresent = useSensorHealthStore((s) => s.getTotalPresentCount());

  const displayed = showAll ? sensors : sensors.filter((s) => s.present);

  if (displayed.length === 0) {
    return (
      <div className={cn("text-xs text-text-tertiary", className)}>
        No sensor data
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <span className="text-[10px] font-mono text-text-secondary">
          {healthyCount}/{totalPresent}
        </span>
        <div className="flex gap-px">
          {displayed.map((sensor) => {
            const cfg = STATUS_CONFIG[sensor.status];
            return (
              <Tooltip key={sensor.bit} content={`${sensor.label}: ${sensor.status}`}>
                <div className={cn("w-1.5 h-1.5 rounded-sm", cfg.color.replace("text-", "bg-"))} />
              </Tooltip>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-4 gap-1", className)}>
      {displayed.map((sensor) => {
        const cfg = STATUS_CONFIG[sensor.status];
        const Icon = cfg.Icon;
        return (
          <Tooltip key={sensor.bit} content={`${sensor.label}: ${sensor.status}${sensor.enabled ? "" : " (disabled)"}`}>
            <div className={cn(
              "flex items-center gap-1 px-1.5 py-1 rounded text-[10px]",
              cfg.bg,
            )}>
              <Icon size={10} className={cfg.color} />
              <span className={cn("truncate", cfg.color)}>{sensor.label}</span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}
