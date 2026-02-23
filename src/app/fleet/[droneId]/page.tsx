"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DroneStatusBadge } from "@/components/shared/drone-status-badge";
import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { DroneArchitectureTab } from "@/components/drone-detail/DroneArchitectureTab";
import { DroneTelemetryTab } from "@/components/drone-detail/DroneTelemetryTab";
import { DroneFlightsTab } from "@/components/drone-detail/DroneFlightsTab";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { DroneSettingsTab } from "@/components/drone-detail/DroneSettingsTab";
import { ArrowLeft } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "telemetry", label: "Telemetry" },
  { id: "flights", label: "Flights" },
  { id: "configure", label: "Configure" },
  { id: "settings", label: "Settings" },
];

export default function DroneDetailPage({
  params,
}: {
  params: Promise<{ droneId: string }>;
}) {
  const { droneId } = use(params);
  const router = useRouter();
  const drones = useFleetStore((s) => s.drones);
  const [activeTab, setActiveTab] = useState("overview");

  const drone = drones.find((d) => d.id === droneId);
  const managedDrones = useDroneManager((s) => s.drones);
  const isConnected = managedDrones.has(droneId);

  // Select this drone in drone-manager so getSelectedProtocol() returns the right protocol
  useEffect(() => {
    if (isConnected) {
      useDroneManager.getState().selectDrone(droneId);
    }
  }, [droneId, isConnected]);

  if (!drone) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-text-secondary">
          Drone &quot;{droneId}&quot; not found
        </p>
        <Button
          variant="secondary"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => router.push("/fleet")}
        >
          Back to Fleet
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border-default bg-bg-secondary">
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => router.push("/fleet")}
        >
          Fleet
        </Button>
        <div className="w-px h-5 bg-border-default" />
        <h1 className="text-sm font-semibold text-text-primary">{drone.name}</h1>
        <DroneStatusBadge status={drone.status} />
        <span className="text-[10px] font-mono text-text-tertiary ml-auto">
          ID: {drone.id}
        </span>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "overview" && <DroneOverviewTab drone={drone} />}
        {activeTab === "architecture" && <DroneArchitectureTab />}
        {activeTab === "telemetry" && <DroneTelemetryTab drone={drone} />}
        {activeTab === "flights" && <DroneFlightsTab droneId={droneId} />}
        {activeTab === "configure" && (
          <DroneConfigureTab
            droneId={droneId}
            droneName={drone.name}
            isConnected={isConnected}
          />
        )}
        {activeTab === "settings" && <DroneSettingsTab drone={drone} />}
      </div>
    </div>
  );
}
