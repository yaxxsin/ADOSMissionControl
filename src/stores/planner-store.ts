/**
 * @module planner-store
 * @description Zustand store for mission planner UI state.
 * Manages active tool selection, panel visibility, waypoint selection/expansion,
 * and default values for new waypoints (altitude, speed, accept radius, frame).
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PlannerTool, AltitudeFrame } from "@/lib/types";
import { indexedDBStorage } from "@/lib/storage";

interface PlannerStoreState {
  /** Currently selected map tool (select, waypoint, polygon, circle, measure). */
  activeTool: PlannerTool;
  /** Whether the right-side mission panel is collapsed. */
  panelCollapsed: boolean;
  /** Whether the altitude profile chart is collapsed. */
  altProfileCollapsed: boolean;
  /** ID of the waypoint whose inline editor is expanded, or null. */
  expandedWaypointId: string | null;
  /** ID of the currently selected waypoint, or null. */
  selectedWaypointId: string | null;
  /** Default altitude (m AGL) for new waypoints. */
  defaultAlt: number;
  /** Default speed (m/s) for new waypoints. */
  defaultSpeed: number;
  /** Default waypoint acceptance radius (m). */
  defaultAcceptRadius: number;
  /** Default altitude reference frame. */
  defaultFrame: AltitudeFrame;
  setActiveTool: (tool: PlannerTool) => void;
  togglePanel: () => void;
  toggleAltProfile: () => void;
  setExpandedWaypoint: (id: string | null) => void;
  setSelectedWaypoint: (id: string | null) => void;
  setDefaults: (defaults: Partial<Pick<PlannerStoreState, "defaultAlt" | "defaultSpeed" | "defaultAcceptRadius" | "defaultFrame">>) => void;
}

export const usePlannerStore = create<PlannerStoreState>()(
  persist(
    (set) => ({
  activeTool: "waypoint",
  panelCollapsed: false,
  altProfileCollapsed: true,
  expandedWaypointId: null,
  selectedWaypointId: null,
  defaultAlt: 50,
  defaultSpeed: 5,
  defaultAcceptRadius: 2,
  defaultFrame: "relative",

  setActiveTool: (activeTool) => set({ activeTool }),
  togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),
  toggleAltProfile: () => set((s) => ({ altProfileCollapsed: !s.altProfileCollapsed })),
  setExpandedWaypoint: (expandedWaypointId) => set({ expandedWaypointId }),
  setSelectedWaypoint: (selectedWaypointId) => set({ selectedWaypointId }),
  setDefaults: (defaults) => set((s) => ({ ...s, ...defaults })),
    }),
    {
      name: "altcmd:planner-store",
      storage: createJSONStorage(indexedDBStorage.storage),
      version: 1,
      partialize: (state) => ({
        defaultAlt: state.defaultAlt,
        defaultSpeed: state.defaultSpeed,
        defaultAcceptRadius: state.defaultAcceptRadius,
        defaultFrame: state.defaultFrame,
      }),
    }
  )
);
