/**
 * @module trail-store
 * @description Zustand store that accumulates drone position history as a
 * lat/lon trail for rendering as a Leaflet polyline on the fly map.
 * Points are de-duplicated (~1m threshold) and stored in a ring buffer.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { RingBuffer } from "@/lib/ring-buffer";

export interface TrailPoint {
  lat: number;
  lon: number;
  alt: number;
}

interface TrailStoreState {
  _ring: RingBuffer<TrailPoint>;
  maxPoints: number;
  /** Snapshot array for React consumers — updated on each push */
  trail: TrailPoint[];
  pushPoint: (lat: number, lon: number, alt?: number) => void;
  clear: () => void;
}

const DEFAULT_MAX_POINTS = 1000;

export const useTrailStore = create<TrailStoreState>((set, get) => ({
  _ring: new RingBuffer<TrailPoint>(DEFAULT_MAX_POINTS),
  maxPoints: DEFAULT_MAX_POINTS,
  trail: [],

  pushPoint: (lat, lon, alt = 0) => {
    const ring = get()._ring;
    // Skip if position hasn't changed significantly (< ~1m)
    if (ring.length > 0) {
      const last = ring.latest()!;
      const dlat = Math.abs(lat - last.lat);
      const dlon = Math.abs(lon - last.lon);
      if (dlat < 0.00001 && dlon < 0.00001) return;
    }
    ring.push({ lat, lon, alt });
    set({ trail: ring.toArray() });
  },

  clear: () => {
    const ring = new RingBuffer<TrailPoint>(get().maxPoints);
    set({ _ring: ring, trail: [] });
  },
}));
