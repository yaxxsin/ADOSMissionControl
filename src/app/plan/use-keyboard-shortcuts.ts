/**
 * @module use-keyboard-shortcuts
 * @description Keyboard shortcut hook for the mission planner.
 * Handles tool switching (V/W/P/C/M), undo/redo (Cmd+Z/Cmd+Shift+Z),
 * delete waypoint (Delete/Backspace), save (Cmd+S), and escape.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import type { PlannerTool } from "@/lib/types";

interface UseKeyboardShortcutsParams {
  activeTool: PlannerTool;
  setActiveTool: (tool: PlannerTool) => void;
  undo: () => void;
  redo: () => void;
  selectedWaypointId: string | null;
  removeWaypoint: (id: string) => void;
  setSelectedWaypoint: (id: string | null) => void;
  expandedWaypointId: string | null;
  setExpandedWaypoint: (id: string | null) => void;
  handleSave: () => void;
  handleSaveAs?: () => void;
  handleNewPlan?: () => void;
  handleFocusSearch?: () => void;
}

const TOOL_MAP: Record<string, PlannerTool> = {
  v: "select",
  w: "waypoint",
  p: "polygon",
  c: "circle",
  m: "measure",
};

/** Register global keyboard shortcuts for the mission planner. */
export function useKeyboardShortcuts({
  activeTool,
  setActiveTool,
  undo,
  redo,
  selectedWaypointId,
  removeWaypoint,
  setSelectedWaypoint,
  expandedWaypointId,
  setExpandedWaypoint,
  handleSave,
  handleSaveAs,
  handleNewPlan,
  handleFocusSearch,
}: UseKeyboardShortcutsParams): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput =
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.tagName === "TEXTAREA";
      if (inInput) return;

      const isMeta = e.metaKey || e.ctrlKey;

      // Tool shortcuts (V/W/P/C/M)
      if (!isMeta) {
        const tool = TOOL_MAP[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          setActiveTool(tool);
          return;
        }
      }

      // Undo (Cmd+Z)
      if (isMeta && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo (Cmd+Shift+Z)
      if (isMeta && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      // Delete selected waypoint
      if ((e.key === "Delete" || e.key === "Backspace") && selectedWaypointId) {
        e.preventDefault();
        removeWaypoint(selectedWaypointId);
        setSelectedWaypoint(null);
        setExpandedWaypoint(null);
        return;
      }

      // Save As (Cmd+Shift+S)
      if (isMeta && e.key === "s" && e.shiftKey) {
        e.preventDefault();
        handleSaveAs?.();
        return;
      }

      // Save (Cmd+S)
      if (isMeta && e.key === "s" && !e.shiftKey) {
        e.preventDefault();
        handleSave();
        return;
      }

      // New plan (Cmd+N)
      if (isMeta && e.key === "n") {
        e.preventDefault();
        handleNewPlan?.();
        return;
      }

      // Focus search (Cmd+O)
      if (isMeta && e.key === "o") {
        e.preventDefault();
        handleFocusSearch?.();
        return;
      }

      // Escape — if drawing tool active, cancel drawing and switch to select.
      // Otherwise collapse expanded waypoint or reset tool.
      if (e.key === "Escape") {
        const isDrawing = activeTool === "polygon" || activeTool === "circle" || activeTool === "measure";
        if (isDrawing) {
          // DrawingManager handles the actual draw cancellation via its own keydown listener.
          // We just switch back to select mode.
          setActiveTool("select");
          return;
        }
        if (expandedWaypointId) {
          setExpandedWaypoint(null);
        } else if (activeTool !== "select") {
          setActiveTool("select");
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    activeTool,
    setActiveTool,
    undo,
    redo,
    selectedWaypointId,
    removeWaypoint,
    setSelectedWaypoint,
    expandedWaypointId,
    setExpandedWaypoint,
    handleSave,
    handleSaveAs,
    handleNewPlan,
    handleFocusSearch,
  ]);
}
