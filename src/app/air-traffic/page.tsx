/**
 * @module AirTrafficPage
 * @description Air Traffic tab page. Full-screen CesiumJS 3D globe with
 * live aircraft tracking, airspace zones, and flyability assessment.
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
import { TrafficListPanel } from "@/components/air-traffic/panels/TrafficListPanel";

const AirTrafficViewer = dynamic(
  () =>
    import("@/components/air-traffic/AirTrafficViewer").then((m) => m.AirTrafficViewer),
  { ssr: false }
);

export default function AirTrafficPage() {
  const [trafficPanelVisible, setTrafficPanelVisible] = useState(true);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* 3D Viewer */}
      <AirTrafficViewer />

      {/* Right panel: Traffic list */}
      {trafficPanelVisible && (
        <TrafficListPanel onClose={() => setTrafficPanelVisible(false)} />
      )}

      {/* Collapsed panel toggle */}
      {!trafficPanelVisible && (
        <button
          onClick={() => setTrafficPanelVisible(true)}
          className="w-8 shrink-0 flex items-center justify-center border-l border-border-default bg-bg-secondary hover:bg-bg-tertiary cursor-pointer"
        >
          <ChevronLeft size={14} className="text-text-tertiary" />
        </button>
      )}
    </div>
  );
}
