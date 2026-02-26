"use client";

import { useState, useEffect } from "react";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DroneStatusBadge } from "@/components/shared/drone-status-badge";
import { DroneOverviewTab } from "@/components/drone-detail/DroneOverviewTab";
import { DroneFlightsTab } from "@/components/drone-detail/DroneFlightsTab";
import { DroneConfigureTab } from "@/components/drone-detail/DroneConfigureTab";
import { DroneSettingsTab } from "@/components/drone-detail/DroneSettingsTab";
import { CalibrationPanel } from "@/components/fc/CalibrationPanel";
import { ParametersPanel } from "@/components/fc/ParametersPanel";
import { X, RotateCcw } from "lucide-react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "flights", label: "Flights" },
  { id: "calibrate", label: "Calibrate" },
  { id: "parameters", label: "Parameters" },
  { id: "configure", label: "Configure" },
  { id: "settings", label: "Settings" },
];

interface DroneDetailPanelProps {
  droneId: string;
  onClose: () => void;
}

export function DroneDetailPanel({ droneId, onClose }: DroneDetailPanelProps) {
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
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Merged header + tabs bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border-default bg-bg-secondary flex-shrink-0">
        <h1 className="text-sm font-semibold text-text-primary shrink-0">{drone.name}</h1>
        <DroneStatusBadge status={drone.status} />
        <Button
          variant="ghost"
          size="sm"
          icon={<X size={14} />}
          onClick={onClose}
        />

        <div className="w-px h-5 bg-border-default shrink-0" />

        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0",
              activeTab === tab.id
                ? "text-accent-primary border-b-2 border-accent-primary"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            {tab.label}
          </button>
        ))}

        <span className="text-[10px] font-mono text-text-tertiary ml-auto shrink-0">
          ID: {drone.id}
        </span>
        {isConnected && (
          <Button
            variant="danger"
            size="sm"
            icon={<RotateCcw size={12} />}
            onClick={() => {
              const protocol = useDroneManager.getState().getSelectedProtocol();
              if (protocol) protocol.reboot();
            }}
          >
            Reboot FC
          </Button>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {activeTab === "overview" && <DroneOverviewTab drone={drone} />}
        {activeTab === "flights" && <DroneFlightsTab droneId={droneId} />}
        {activeTab === "calibrate" && <CalibrationPanel />}
        {activeTab === "parameters" && <ParametersPanel />}
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
