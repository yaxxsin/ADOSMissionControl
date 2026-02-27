"use client";

import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import { FcDisconnectedPlaceholder } from "@/components/fc/FcDisconnectedPlaceholder";
import { FlashCommitBanner } from "@/components/fc/FlashCommitBanner";
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
import { GeofencePanel } from "@/components/fc/GeofencePanel";
import { FramePanel } from "@/components/fc/FramePanel";
import { PreArmPanel } from "@/components/fc/PreArmPanel";
import { DebugPanel } from "@/components/fc/DebugPanel";
import { SensorGraphPanel } from "@/components/fc/SensorGraphPanel";
import { SensorsPanel } from "@/components/fc/SensorsPanel";
import { GimbalPanel } from "@/components/fc/GimbalPanel";
import { CameraPanel } from "@/components/fc/CameraPanel";
import { LedPanel } from "@/components/fc/LedPanel";
import { TelRadioPanel } from "@/components/fc/TelRadioPanel";
import type { ReactNode } from "react";
import type { ProtocolCapabilities } from "@/lib/protocol/types";
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
  Box,
  Shield,
  HeartPulse,
  Gauge,
  Move3d,
  Camera,
  BarChart3,
  Lightbulb,
  Wifi,
  Bug,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Nav item type with capability gating and sections
// ---------------------------------------------------------------------------

interface FcNavItem {
  id: string;
  label: string;
  icon: ReactNode;
  requiredCapability?: keyof ProtocolCapabilities;
  section?: string;
}

const FC_NAV_ITEMS: FcNavItem[] = [
  // --- Flight ---
  { id: "outputs", label: "Outputs", icon: <Cpu size={14} />, section: "Flight" },
  { id: "receiver", label: "Receiver", icon: <Radio size={14} />, requiredCapability: "supportsReceiver", section: "Flight" },
  { id: "modes", label: "Flight Modes", icon: <SlidersHorizontal size={14} />, requiredCapability: "supportsFlightModes", section: "Flight" },
  { id: "frame", label: "Frame", icon: <Box size={14} />, section: "Flight" },
  // --- Safety ---
  { id: "failsafe", label: "Failsafe", icon: <ShieldAlert size={14} />, requiredCapability: "supportsFailsafe", section: "Safety" },
  { id: "geofence", label: "Geofence", icon: <Shield size={14} />, requiredCapability: "supportsGeoFence", section: "Safety" },
  { id: "health", label: "Health Check", icon: <HeartPulse size={14} />, section: "Safety" },
  // --- Sensors ---
  { id: "sensors", label: "Sensors", icon: <Gauge size={14} />, section: "Sensors" },
  { id: "power", label: "Power", icon: <Battery size={14} />, requiredCapability: "supportsPowerConfig", section: "Sensors" },
  { id: "gimbal", label: "Gimbal", icon: <Move3d size={14} />, requiredCapability: "supportsGimbal", section: "Sensors" },
  { id: "camera", label: "Camera", icon: <Camera size={14} />, requiredCapability: "supportsCamera", section: "Sensors" },
  // --- Tuning ---
  { id: "pid", label: "PID Tuning", icon: <Activity size={14} />, requiredCapability: "supportsPidTuning", section: "Tuning" },
  { id: "sensor-graphs", label: "Sensor Graphs", icon: <BarChart3 size={14} />, section: "Tuning" },
  // --- Display ---
  { id: "osd", label: "OSD Editor", icon: <Layers size={14} />, requiredCapability: "supportsOsd", section: "Display" },
  { id: "led", label: "LED Strip", icon: <Lightbulb size={14} />, requiredCapability: "supportsLed", section: "Display" },
  // --- System ---
  { id: "ports", label: "Ports", icon: <Cable size={14} />, requiredCapability: "supportsPorts", section: "System" },
  { id: "radio", label: "Radio Config", icon: <Wifi size={14} />, section: "System" },
  { id: "firmware", label: "Firmware", icon: <Zap size={14} />, requiredCapability: "supportsFirmwareFlash", section: "System" },
  { id: "cli", label: "CLI", icon: <Terminal size={14} />, requiredCapability: "supportsCliShell", section: "System" },
  // --- Debug ---
  { id: "mavlink", label: "MAVLink Inspector", icon: <Monitor size={14} />, requiredCapability: "supportsMavlinkInspector", section: "Debug" },
  { id: "debug", label: "Debug", icon: <Bug size={14} />, requiredCapability: "supportsDebugValues", section: "Debug" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface DroneConfigureTabProps {
  droneId: string;
  droneName: string;
  isConnected: boolean;
}

export function DroneConfigureTab({ droneId, droneName, isConnected }: DroneConfigureTabProps) {
  const [activePanel, setActivePanel] = useState("outputs");
  const { supports } = useFirmwareCapabilities();

  // Filter nav items based on firmware capabilities
  const visibleItems = useMemo(
    () =>
      FC_NAV_ITEMS.filter(
        (item) => !item.requiredCapability || supports(item.requiredCapability),
      ),
    [supports],
  );

  // Group visible items by section
  const sections = useMemo(() => {
    const map = new Map<string, FcNavItem[]>();
    for (const item of visibleItems) {
      const s = item.section ?? "Other";
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(item);
    }
    return map;
  }, [visibleItems]);

  // Auto-select first visible panel if current becomes hidden
  useEffect(() => {
    if (!visibleItems.find((i) => i.id === activePanel) && visibleItems.length > 0) {
      setActivePanel(visibleItems[0].id);
    }
  }, [visibleItems, activePanel]);

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
          {[...sections.entries()].map(([section, items]) => (
            <div key={section}>
              <div className="px-3 pt-3 pb-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                  {section}
                </span>
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => isConnected && setActivePanel(item.id)}
                  disabled={!isConnected}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors cursor-pointer w-full",
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
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!isConnected ? (
          <FcDisconnectedPlaceholder droneName={droneName} />
        ) : (
          <>
            <FlashCommitBanner />
            {activePanel === "outputs" && <OutputsPanel />}
            {activePanel === "receiver" && <ReceiverPanel />}
            {activePanel === "modes" && <FlightModesPanel />}
            {activePanel === "frame" && <FramePanel />}
            {activePanel === "failsafe" && <FailsafePanel />}
            {activePanel === "geofence" && <GeofencePanel />}
            {activePanel === "health" && <PreArmPanel />}
            {activePanel === "sensors" && <SensorsPanel />}
            {activePanel === "power" && <PowerPanel />}
            {activePanel === "gimbal" && <GimbalPanel />}
            {activePanel === "camera" && <CameraPanel />}
            {activePanel === "pid" && <PidTuningPanel />}
            {activePanel === "sensor-graphs" && <SensorGraphPanel />}
            {activePanel === "osd" && <OsdEditorPanel />}
            {activePanel === "led" && <LedPanel />}
            {activePanel === "ports" && <PortsPanel />}
            {activePanel === "radio" && <TelRadioPanel />}
            {activePanel === "firmware" && <FirmwarePanel />}
            {activePanel === "cli" && <CliPanel />}
            {activePanel === "mavlink" && <MavlinkInspectorPanel />}
            {activePanel === "debug" && <DebugPanel />}
          </>
        )}
      </div>
    </div>
  );
}
