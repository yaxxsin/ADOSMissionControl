/**
 * @module SimulateLeftPanel
 * @description Left panel for the Simulate tab. Wraps the shared FlightPlanLibrary
 * with simulation-specific sections: waypoint inspector, camera presets, quick actions, history.
 * @license GPL-3.0-only
 */
"use client";

import { usePlanLibraryStore } from "@/stores/plan-library-store";
import { useSimulationStore } from "@/stores/simulation-store";
import { ChevronRight } from "lucide-react";
import { FlightPlanLibrary } from "@/components/library/FlightPlanLibrary";
import { WaypointInspector } from "./WaypointInspector";
import { CameraPresetsSection } from "./CameraPresetsSection";
import { SimQuickActions } from "./SimQuickActions";
import { SimulationHistory } from "./SimulationHistory";

interface SimulateLeftPanelProps {
  onPlanLoaded?: (plan: { name: string; droneId?: string; suiteType?: string }) => void;
}

export function SimulateLeftPanel({ onPlanLoaded }: SimulateLeftPanelProps) {
  const libraryCollapsed = usePlanLibraryStore((s) => s.libraryCollapsed);
  const toggleLibrary = usePlanLibraryStore((s) => s.toggleLibrary);
  const playbackState = useSimulationStore((s) => s.playbackState);

  if (libraryCollapsed) {
    return (
      <div className="w-10 shrink-0 flex flex-col items-center h-full border-r border-border-default bg-bg-secondary">
        <button
          onClick={toggleLibrary}
          className="p-2 mt-2 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          title="Expand panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary overflow-hidden">
      {/* Shared library - constrained during playback */}
      <div className={playbackState === "playing" ? "max-h-[200px] overflow-hidden" : "flex-1 overflow-hidden"}>
        <FlightPlanLibrary context="simulate" onPlanLoaded={onPlanLoaded} />
      </div>

      {/* Simulation-specific sections */}
      <div className="flex-1 overflow-y-auto border-t border-border-default">
        <WaypointInspector />
        <CameraPresetsSection />
        <SimQuickActions />
        <SimulationHistory />
      </div>
    </div>
  );
}
