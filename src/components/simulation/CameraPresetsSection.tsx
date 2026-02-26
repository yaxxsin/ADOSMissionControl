/**
 * @module CameraPresetsSection
 * @description Camera mode selection buttons for the simulation left panel.
 * Relocated from the CameraModeSelector overlay.
 * @license GPL-3.0-only
 */
"use client";

import { useSimulationStore, type CameraMode } from "@/stores/simulation-store";
import { cn } from "@/lib/utils";

const MODES: { id: CameraMode; label: string; key: string; title: string }[] = [
  { id: "topdown", label: "Top-down", key: "T", title: "Bird's eye view" },
  { id: "follow", label: "Follow", key: "F", title: "Chase cam following drone" },
  { id: "orbit", label: "Orbit", key: "O", title: "Orbit around mission" },
  { id: "free", label: "Free", key: "X", title: "Free camera control" },
];

export function CameraPresetsSection() {
  const cameraMode = useSimulationStore((s) => s.cameraMode);
  const setCameraMode = useSimulationStore((s) => s.setCameraMode);

  return (
    <div className="px-3 py-3 border-t border-border-default">
      <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
        Camera
      </h3>
      <div className="flex gap-1.5">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => setCameraMode(mode.id)}
            title={mode.title}
            className={cn(
              "flex-1 px-2 py-1.5 text-[10px] font-mono transition-colors cursor-pointer",
              cameraMode === mode.id
                ? "bg-accent-primary text-bg-primary font-semibold"
                : "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default"
            )}
          >
            [{mode.key}] {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
