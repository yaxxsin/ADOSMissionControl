/**
 * @module CameraModeSelector
 * @description Camera mode toggle buttons for simulation: Top-down, Follow.
 * @license GPL-3.0-only
 */

"use client";

import { useSimulationStore, type CameraMode } from "@/stores/simulation-store";
import { cn } from "@/lib/utils";

const MODES: { id: CameraMode; label: string; title: string }[] = [
  { id: "topdown", label: "T", title: "Top-down view (default)" },
  { id: "follow", label: "F", title: "Follow drone" },
];

export function CameraModeSelector() {
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);

  return (
    <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
      <span className="text-[9px] font-mono text-text-tertiary mb-0.5 text-center">CAM</span>
      {MODES.map((mode) => (
        <button
          key={mode.id}
          onClick={() => setCameraMode(mode.id)}
          title={mode.title}
          className={cn(
            "w-8 h-8 rounded text-xs font-mono font-bold transition-colors cursor-pointer",
            cameraMode === mode.id
              ? "bg-accent-primary text-bg-primary"
              : "bg-bg-primary/70 backdrop-blur-md text-text-secondary hover:text-text-primary border border-border-default"
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
