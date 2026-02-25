/**
 * @module simulation-store
 * @description Zustand store for mission simulation playback state.
 * Manages playback controls, camera mode, elapsed time, and drone trail.
 * Non-persisted — resets on page reload.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export type PlaybackState = "stopped" | "playing" | "paused";
export type CameraMode = "topdown" | "follow";

interface TrailPosition {
  lat: number;
  lon: number;
  alt: number;
}

interface SimulationStoreState {
  playbackState: PlaybackState;
  playbackSpeed: number;
  elapsed: number;
  totalDuration: number;
  cameraMode: CameraMode;
  trailPositions: TrailPosition[];

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  setSpeed: (speed: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setTotalDuration: (duration: number) => void;
  tick: (deltaMs: number) => void;
  appendTrail: (pos: TrailPosition) => void;
  reset: () => void;
}

const MAX_TRAIL = 500;
const STEP_SECONDS = 1;

export const useSimulationStore = create<SimulationStoreState>()((set, get) => ({
  playbackState: "stopped",
  playbackSpeed: 1,
  elapsed: 0,
  totalDuration: 0,
  cameraMode: "topdown",
  trailPositions: [],

  play: () => set({ playbackState: "playing" }),
  pause: () => set({ playbackState: "paused" }),
  stop: () => set({ playbackState: "stopped", elapsed: 0, trailPositions: [] }),

  seek: (time) => {
    const { totalDuration } = get();
    set({
      elapsed: Math.max(0, Math.min(time, totalDuration)),
      trailPositions: [],
    });
  },

  stepForward: () => {
    const { elapsed, totalDuration } = get();
    set({ elapsed: Math.min(elapsed + STEP_SECONDS, totalDuration) });
  },

  stepBack: () => {
    const { elapsed } = get();
    set({
      elapsed: Math.max(elapsed - STEP_SECONDS, 0),
      trailPositions: [],
    });
  },

  setSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setCameraMode: (cameraMode) => set({ cameraMode }),
  setTotalDuration: (totalDuration) => set({ totalDuration }),

  tick: (deltaMs) => {
    const { elapsed, totalDuration, playbackSpeed, playbackState } = get();
    if (playbackState !== "playing") return;
    const newElapsed = Math.min(elapsed + (deltaMs / 1000) * playbackSpeed, totalDuration);
    if (newElapsed >= totalDuration) {
      set({ elapsed: totalDuration, playbackState: "paused" });
    } else {
      set({ elapsed: newElapsed });
    }
  },

  appendTrail: (pos) => {
    const { trailPositions } = get();
    const next = [...trailPositions, pos];
    set({ trailPositions: next.length > MAX_TRAIL ? next.slice(-MAX_TRAIL) : next });
  },

  reset: () =>
    set({
      playbackState: "stopped",
      playbackSpeed: 1,
      elapsed: 0,
      cameraMode: "topdown",
      trailPositions: [],
    }),
}));
