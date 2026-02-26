"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { FcDisconnectedPlaceholder } from "@/components/fc/FcDisconnectedPlaceholder";
import { OutputsPanel } from "@/components/fc/OutputsPanel";
import { ReceiverPanel } from "@/components/fc/ReceiverPanel";
import { FlightModesPanel } from "@/components/fc/FlightModesPanel";
import { FailsafePanel } from "@/components/fc/FailsafePanel";
import { PowerPanel } from "@/components/fc/PowerPanel";
import { CliPanel } from "@/components/fc/CliPanel";
import { PidTuningPanel } from "@/components/fc/PidTuningPanel";
import { PortsPanel } from "@/components/fc/PortsPanel";
import { MavlinkInspectorPanel } from "@/components/fc/MavlinkInspectorPanel";
import { OsdEditorPanel } from "@/components/fc/OsdEditorPanel";
import { FirmwarePanel } from "@/components/fc/FirmwarePanel";
import type { ReactNode } from "react";
import {
  Cpu,
  Radio,
  SlidersHorizontal,
  ShieldAlert,
  Battery,
  Terminal,
  Activity,
  Cable,
  Monitor,
  Zap,
  Layers,
} from "lucide-react";

interface FcNavItem {
  id: string;
  label: string;
  icon: ReactNode;
}

const FC_NAV_ITEMS: FcNavItem[] = [
  { id: "outputs", label: "Outputs", icon: <Cpu size={14} /> },
  { id: "receiver", label: "Receiver", icon: <Radio size={14} /> },
  { id: "modes", label: "Flight Modes", icon: <SlidersHorizontal size={14} /> },
  { id: "failsafe", label: "Failsafe", icon: <ShieldAlert size={14} /> },
  { id: "power", label: "Power", icon: <Battery size={14} /> },
  { id: "cli", label: "CLI", icon: <Terminal size={14} /> },
  { id: "pid", label: "PID Tuning", icon: <Activity size={14} /> },
  { id: "ports", label: "Ports", icon: <Cable size={14} /> },
  { id: "mavlink", label: "MAVLink Inspector", icon: <Monitor size={14} /> },
  { id: "firmware", label: "Firmware", icon: <Zap size={14} /> },
  { id: "osd", label: "OSD Editor", icon: <Layers size={14} /> },
];

interface DroneConfigureTabProps {
  droneId: string;
  droneName: string;
  isConnected: boolean;
}

export function DroneConfigureTab({ droneId, droneName, isConnected }: DroneConfigureTabProps) {
  const [activePanel, setActivePanel] = useState("outputs");

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      {/* Sidebar */}
      <nav className="w-[200px] border-r border-border-default bg-bg-secondary flex-shrink-0 overflow-y-auto">
        <div className="px-3 py-3 border-b border-border-default">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Flight Controller
          </h2>
        </div>
        <div className="flex flex-col py-1">
          {FC_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => isConnected && setActivePanel(item.id)}
              disabled={!isConnected}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors cursor-pointer",
                !isConnected && "opacity-40 cursor-not-allowed",
                isConnected && activePanel === item.id
                  ? "text-accent-primary bg-accent-primary/10 border-l-2 border-l-accent-primary"
                  : "text-text-secondary hover:text-text-primary hover:bg-bg-tertiary border-l-2 border-l-transparent",
                !isConnected && "hover:bg-transparent hover:text-text-secondary"
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!isConnected ? (
          <FcDisconnectedPlaceholder droneName={droneName} />
        ) : (
          <>
            {activePanel === "outputs" && <OutputsPanel />}
            {activePanel === "receiver" && <ReceiverPanel />}
            {activePanel === "modes" && <FlightModesPanel />}
            {activePanel === "failsafe" && <FailsafePanel />}
            {activePanel === "power" && <PowerPanel />}
            {activePanel === "cli" && <CliPanel />}
            {activePanel === "pid" && <PidTuningPanel />}
            {activePanel === "ports" && <PortsPanel />}
            {activePanel === "mavlink" && <MavlinkInspectorPanel />}
            {activePanel === "firmware" && <FirmwarePanel />}
            {activePanel === "osd" && <OsdEditorPanel />}
          </>
        )}
      </div>
    </div>
  );
}
