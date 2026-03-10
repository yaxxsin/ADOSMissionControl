/**
 * @module drawing-store
 * @description Zustand store for map drawing state (polygon, circle, measure tools).
 * Stores completed shapes and in-progress drawing state.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type { DrawingMode, DrawnPolygon, DrawnCircle, MeasureLine } from "@/lib/drawing/types";

interface DrawingStoreState {
  /** Current drawing mode, or null when idle. */
  drawingMode: DrawingMode;
  /** Completed polygons. */
  polygons: DrawnPolygon[];
  /** Completed circles. */
  circles: DrawnCircle[];
  /** Active measure line result, or null. */
  measureLine: MeasureLine | null;
  /** In-progress polygon vertices (for live preview in other components). */
  activeDrawingVertices: [number, number][];
  /** IDs of polygons selected for multi-polygon operations. */
  selectedPolygonIds: string[];

  setDrawingMode: (mode: DrawingMode) => void;
  addPolygon: (polygon: DrawnPolygon) => void;
  addCircle: (circle: DrawnCircle) => void;
  removePolygon: (id: string) => void;
  removeCircle: (id: string) => void;
  setMeasureLine: (line: MeasureLine | null) => void;
  setActiveDrawingVertices: (vertices: [number, number][]) => void;
  togglePolygonSelection: (id: string) => void;
  selectAllPolygons: () => void;
  deselectAllPolygons: () => void;
  clearAll: () => void;
}

export const useDrawingStore = create<DrawingStoreState>()((set) => ({
  drawingMode: null,
  polygons: [],
  circles: [],
  measureLine: null,
  activeDrawingVertices: [],
  selectedPolygonIds: [],

  setDrawingMode: (drawingMode) => set({ drawingMode }),

  addPolygon: (polygon) =>
    set((s) => ({
      polygons: [...s.polygons, polygon],
      selectedPolygonIds: [...s.selectedPolygonIds, polygon.id],
    })),

  addCircle: (circle) =>
    set((s) => ({ circles: [...s.circles, circle] })),

  removePolygon: (id) =>
    set((s) => ({
      polygons: s.polygons.filter((p) => p.id !== id),
      selectedPolygonIds: s.selectedPolygonIds.filter((sid) => sid !== id),
    })),

  removeCircle: (id) =>
    set((s) => ({ circles: s.circles.filter((c) => c.id !== id) })),

  setMeasureLine: (measureLine) => set({ measureLine }),

  setActiveDrawingVertices: (activeDrawingVertices) =>
    set({ activeDrawingVertices }),

  togglePolygonSelection: (id) =>
    set((s) => ({
      selectedPolygonIds: s.selectedPolygonIds.includes(id)
        ? s.selectedPolygonIds.filter((sid) => sid !== id)
        : [...s.selectedPolygonIds, id],
    })),

  selectAllPolygons: () =>
    set((s) => ({ selectedPolygonIds: s.polygons.map((p) => p.id) })),

  deselectAllPolygons: () =>
    set({ selectedPolygonIds: [] }),

  clearAll: () =>
    set({
      drawingMode: null,
      polygons: [],
      circles: [],
      measureLine: null,
      activeDrawingVertices: [],
      selectedPolygonIds: [],
    }),
}));
