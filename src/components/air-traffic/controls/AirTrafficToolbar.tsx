/**
 * @module AirTrafficToolbar
 * @description Top-right toolbar for the Air Traffic viewer.
 * Provides fullscreen toggle, compass reset, and screenshot placeholder.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback } from "react";
import { Maximize, Compass, Camera } from "lucide-react";
import type { Viewer as CesiumViewer } from "cesium";

interface AirTrafficToolbarProps {
  viewer: CesiumViewer | null;
}

export function AirTrafficToolbar({ viewer }: AirTrafficToolbarProps) {
  const handleFullscreen = useCallback(() => {
    const container = viewer?.container;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      container.requestFullscreen?.();
    }
  }, [viewer]);

  const handleCompassReset = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: viewer.camera.positionWC,
      orientation: {
        heading: 0,
        pitch: viewer.camera.pitch,
        roll: 0,
      },
      duration: 0.5,
    });
    viewer.scene.requestRender();
  }, [viewer]);

  const handleScreenshot = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    viewer.scene.requestRender();
    const canvas = viewer.scene.canvas;
    const link = document.createElement("a");
    link.download = `air-traffic-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, [viewer]);

  return (
    <div className="absolute top-16 right-4 z-10 flex flex-col gap-1">
      <ToolbarButton icon={Maximize} title="Fullscreen" onClick={handleFullscreen} />
      <ToolbarButton icon={Compass} title="Reset compass (north up)" onClick={handleCompassReset} />
      <ToolbarButton icon={Camera} title="Screenshot" onClick={handleScreenshot} />
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Maximize;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-2 bg-bg-primary/70 backdrop-blur-md border border-border-default rounded-lg hover:bg-bg-secondary transition-colors cursor-pointer"
    >
      <Icon size={14} className="text-text-secondary" />
    </button>
  );
}
