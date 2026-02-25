"use client";

/**
 * @module SimulatePage
 * @description Dedicated simulation page. Reads waypoints from the shared mission store
 * and renders the 3D CesiumJS simulation viewer with playback controls.
 * @license GPL-3.0-only
 */

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";
import { usePlannerStore } from "@/stores/planner-store";
import { useSimulationStore } from "@/stores/simulation-store";
import { useSimulationKeyboard } from "@/hooks/use-simulation-keyboard";

const SimulationViewer = dynamic(
  () =>
    import("@/components/simulation/SimulationViewer").then((m) => m.SimulationViewer),
  { ssr: false }
);
const SimulationPanel = dynamic(
  () =>
    import("@/components/simulation/SimulationPanel").then((m) => m.SimulationPanel),
  { ssr: false }
);

export default function SimulatePage() {
  const waypoints = useMissionStore((s) => s.waypoints);
  const defaultSpeed = usePlannerStore((s) => s.defaultSpeed);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  useSimulationKeyboard(true);

  // Reset simulation state on unmount (navigating away)
  useEffect(() => {
    return () => { useSimulationStore.getState().reset(); };
  }, []);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* 3D Viewer */}
      <SimulationViewer waypoints={waypoints} defaultSpeed={defaultSpeed} />

      {/* Right panel */}
      {!panelCollapsed && (
        <SimulationPanel
          waypoints={waypoints}
          defaultSpeed={defaultSpeed}
          onClose={() => setPanelCollapsed(true)}
        />
      )}

      {/* Collapsed panel toggle */}
      {panelCollapsed && (
        <button
          onClick={() => setPanelCollapsed(false)}
          className="w-8 shrink-0 flex items-center justify-center border-l border-border-default bg-bg-secondary hover:bg-bg-tertiary cursor-pointer"
        >
          <ChevronLeft size={14} className="text-text-tertiary" />
        </button>
      )}
    </div>
  );
}
