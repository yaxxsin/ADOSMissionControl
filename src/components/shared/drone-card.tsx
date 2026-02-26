"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BatteryBar } from "./battery-bar";
import { StatusDot } from "@/components/ui/status-dot";
import { cn } from "@/lib/utils";
import { useDroneMetadataStore } from "@/stores/drone-metadata-store";
import type { FleetDrone, DroneStatus } from "@/lib/types";

interface DroneCardProps {
  drone: FleetDrone;
  selected?: boolean;
  onClick?: (id: string) => void;
}

const statusToBadgeVariant: Record<DroneStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  online: "success",
  in_mission: "info",
  idle: "neutral",
  returning: "warning",
  maintenance: "error",
  offline: "neutral",
};

const statusToDot: Record<DroneStatus, "online" | "idle" | "warning" | "error" | "offline"> = {
  online: "online",
  in_mission: "online",
  idle: "idle",
  returning: "warning",
  maintenance: "error",
  offline: "offline",
};

export function DroneCard({ drone, selected, onClick }: DroneCardProps) {
  const displayName = useDroneMetadataStore((s) => s.profiles[drone.id]?.displayName) ?? drone.name;
  return (
    <Card className={cn(selected && "border-accent-primary bg-accent-primary/5")} onClick={() => onClick?.(drone.id)}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusDot status={statusToDot[drone.status]} />
          <span className="text-sm font-semibold text-text-primary">{displayName}</span>
        </div>
        <Badge variant={statusToBadgeVariant[drone.status]}>{drone.status.replace("_", " ")}</Badge>
      </div>
      <BatteryBar percentage={drone.battery?.remaining ?? 0} className="mb-2" />
      <div className="flex items-center justify-between text-[10px] text-text-tertiary">
        <span className="font-mono">{drone.flightMode}</span>
        {drone.suiteName && <span className="truncate ml-2">{drone.suiteName}</span>}
      </div>
    </Card>
  );
}
