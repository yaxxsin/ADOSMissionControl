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

  setDrawingMode: (mode: DrawingMode) => void;
  addPolygon: (polygon: DrawnPolygon) => void;
  addCircle: (circle: DrawnCircle) => void;
  removePolygon: (id: string) => void;
  removeCircle: (id: string) => void;
  setMeasureLine: (line: MeasureLine | null) => void;
  setActiveDrawingVertices: (vertices: [number, number][]) => void;
  clearAll: () => void;
}

export const useDrawingStore = create<DrawingStoreState>()((set) => ({
  drawingMode: null,
  polygons: [],
  circles: [],
  measureLine: null,
  activeDrawingVertices: [],

  setDrawingMode: (drawingMode) => set({ drawingMode }),

  addPolygon: (polygon) =>
    set((s) => ({ polygons: [...s.polygons, polygon] })),

  addCircle: (circle) =>
    set((s) => ({ circles: [...s.circles, circle] })),

  removePolygon: (id) =>
    set((s) => ({ polygons: s.polygons.filter((p) => p.id !== id) })),

  removeCircle: (id) =>
    set((s) => ({ circles: s.circles.filter((c) => c.id !== id) })),

  setMeasureLine: (measureLine) => set({ measureLine }),

  setActiveDrawingVertices: (activeDrawingVertices) =>
    set({ activeDrawingVertices }),

  clearAll: () =>
    set({
      drawingMode: null,
      polygons: [],
      circles: [],
      measureLine: null,
      activeDrawingVertices: [],
    }),
}));
