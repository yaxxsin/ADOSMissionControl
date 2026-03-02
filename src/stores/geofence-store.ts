/**
 * @module geofence-store
 * @description Zustand store for geofence state. Manages fence type, altitude,
 * breach action, polygon/circle geometry, and protocol upload/download.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useDroneManager } from "./drone-manager";

export type FenceType = "circle" | "polygon";
export type BreachAction = "RTL" | "LAND" | "REPORT";

interface GeofenceStoreState {
  enabled: boolean;
  fenceType: FenceType;
  maxAltitude: number;
  breachAction: BreachAction;
  circleCenter: [number, number] | null;
  circleRadius: number;
  polygonPoints: [number, number][];
  uploadState: "idle" | "uploading" | "uploaded" | "error";

  setEnabled: (enabled: boolean) => void;
  setFenceType: (type: FenceType) => void;
  setMaxAltitude: (alt: number) => void;
  setBreachAction: (action: BreachAction) => void;
  setCircle: (center: [number, number], radius: number) => void;
  setPolygonPoints: (points: [number, number][]) => void;
  uploadFence: () => Promise<void>;
  downloadFence: () => Promise<void>;
  clearFence: () => void;
}

export const useGeofenceStore = create<GeofenceStoreState>()((set, get) => ({
  enabled: false,
  fenceType: "circle",
  maxAltitude: 120,
  breachAction: "RTL",
  circleCenter: null,
  circleRadius: 200,
  polygonPoints: [],
  uploadState: "idle",

  setEnabled: (enabled) => set({ enabled }),
  setFenceType: (fenceType) => set({ fenceType }),
  setMaxAltitude: (maxAltitude) => set({ maxAltitude }),
  setBreachAction: (breachAction) => set({ breachAction }),

  setCircle: (center, radius) =>
    set({ circleCenter: center, circleRadius: radius }),

  setPolygonPoints: (polygonPoints) => set({ polygonPoints }),

  uploadFence: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol?.uploadFence) return;

    const { fenceType, polygonPoints, circleCenter, circleRadius } = get();

    let points: Array<{ lat: number; lon: number }>;
    if (fenceType === "polygon") {
      points = polygonPoints.map(([lat, lon]) => ({ lat, lon }));
    } else {
      // Circle geofence: approximate as 16-point polygon
      if (!circleCenter) return;
      points = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * 2 * Math.PI) / 16;
        const dLat = (circleRadius / 111320) * Math.cos(angle);
        const dLon =
          (circleRadius / (111320 * Math.cos((circleCenter[0] * Math.PI) / 180))) *
          Math.sin(angle);
        points.push({ lat: circleCenter[0] + dLat, lon: circleCenter[1] + dLon });
      }
    }

    if (points.length < 3) return;

    set({ uploadState: "uploading" });
    try {
      const result = await protocol.uploadFence(points);
      set({ uploadState: result.success ? "uploaded" : "error" });
    } catch {
      set({ uploadState: "error" });
    }
  },

  downloadFence: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol?.downloadFence) return;

    try {
      const points = await protocol.downloadFence();
      if (points.length >= 3) {
        set({
          fenceType: "polygon",
          polygonPoints: points.map((p) => [p.lat, p.lon] as [number, number]),
          enabled: true,
        });
      }
    } catch {
      // silent
    }
  },

  clearFence: () =>
    set({
      enabled: false,
      circleCenter: null,
      circleRadius: 200,
      polygonPoints: [],
      uploadState: "idle",
    }),
}));
