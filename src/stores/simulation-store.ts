/**
 * @module simulation-store
 * @description Zustand store for mission simulation playback state.
 * Manages playback controls, camera mode, and elapsed time.
 * Clock-backed: all time advancement driven by CesiumJS Clock,
 * synced back to store via syncFromClock() for HUD/controls.
 * Non-persisted — resets on page reload.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { JulianDate, type Viewer as CesiumViewer } from "cesium";

export type PlaybackState = "stopped" | "playing" | "paused";
export type CameraMode = "topdown" | "follow" | "orbit" | "free";

interface SimulationStoreState {
  playbackState: PlaybackState;
  playbackSpeed: number;
  elapsed: number;
  totalDuration: number;
  cameraMode: CameraMode;

  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  setSpeed: (speed: number) => void;
  setCameraMode: (mode: CameraMode) => void;
  setTotalDuration: (duration: number) => void;
  syncFromClock: () => void;
  reset: () => void;
}

const STEP_SECONDS = 1;

/** Quantize to 3 decimal places — matches syncFromClock precision */
const quantize = (v: number) => Math.round(v * 1000) / 1000;

// Module-level clock binding (CesiumJS objects are not serializable in Zustand)
let _viewer: CesiumViewer | null = null;
let _startJulian: JulianDate | null = null;
const _scratchJulian = new JulianDate();

export function bindSimViewer(viewer: CesiumViewer, startJulian: JulianDate) {
  _viewer = viewer;
  _startJulian = JulianDate.clone(startJulian);
}

export function unbindSimViewer() {
  _viewer = null;
  _startJulian = null;
}

function seekClock(seconds: number) {
  if (_viewer && !_viewer.isDestroyed() && _startJulian) {
    _viewer.clock.currentTime = JulianDate.addSeconds(
      _startJulian,
      seconds,
      _scratchJulian
    );
  }
}

export const useSimulationStore = create<SimulationStoreState>()((set, get) => ({
  playbackState: "stopped",
  playbackSpeed: 1,
  elapsed: 0,
  totalDuration: 0,
  cameraMode: "topdown",

  play: () => {
    const { elapsed, totalDuration } = get();
    // If at the end, restart from beginning
    if (elapsed >= totalDuration && totalDuration > 0) {
      set({ playbackState: "playing", elapsed: 0 });
      seekClock(0);
    } else {
      set({ playbackState: "playing" });
    }
    if (_viewer && !_viewer.isDestroyed()) {
      _viewer.clock.shouldAnimate = true;
    }
  },

  pause: () => {
    set({ playbackState: "paused" });
    if (_viewer && !_viewer.isDestroyed()) {
      _viewer.clock.shouldAnimate = false;
    }
  },

  stop: () => {
    set({ playbackState: "stopped", elapsed: 0 });
    if (_viewer && !_viewer.isDestroyed()) {
      _viewer.clock.shouldAnimate = false;
    }
    seekClock(0);
  },

  seek: (time) => {
    const { totalDuration } = get();
    const clamped = quantize(Math.max(0, Math.min(time, totalDuration)));
    set({ elapsed: clamped });
    seekClock(clamped);
  },

  stepForward: () => {
    const { elapsed, totalDuration } = get();
    const next = quantize(Math.min(elapsed + STEP_SECONDS, totalDuration));
    set({ elapsed: next });
    seekClock(next);
  },

  stepBack: () => {
    const { elapsed } = get();
    const prev = quantize(Math.max(elapsed - STEP_SECONDS, 0));
    set({ elapsed: prev });
    seekClock(prev);
  },

  setSpeed: (playbackSpeed) => {
    set({ playbackSpeed });
    if (_viewer && !_viewer.isDestroyed()) {
      _viewer.clock.multiplier = playbackSpeed;
    }
  },

  setCameraMode: (cameraMode) => set({ cameraMode }),

  setTotalDuration: (totalDuration) => {
    set({ totalDuration });
    if (_viewer && !_viewer.isDestroyed() && _startJulian) {
      _viewer.clock.stopTime = JulianDate.addSeconds(
        _startJulian,
        totalDuration,
        new JulianDate()
      );
    }
  },

  syncFromClock: () => {
    if (!_viewer || _viewer.isDestroyed() || !_startJulian) return;
    const elapsed = JulianDate.secondsDifference(
      _viewer.clock.currentTime,
      _startJulian
    );
    const { totalDuration, playbackState, elapsed: current } = get();
    const clamped = quantize(Math.max(0, Math.min(elapsed, totalDuration)));

    // Detect CesiumJS auto-stop (ClockRange.CLAMPED stops clock at stopTime)
    if (playbackState === "playing" && !_viewer.clock.shouldAnimate) {
      set({ elapsed: clamped, playbackState: "paused" });
    } else if (clamped !== current) {
      set({ elapsed: clamped });
    }
  },

  reset: () => {
    set({
      playbackState: "stopped",
      playbackSpeed: 1,
      elapsed: 0,
      totalDuration: 0,
      cameraMode: "topdown",
    });
    if (_viewer && !_viewer.isDestroyed()) {
      _viewer.clock.shouldAnimate = false;
      _viewer.clock.multiplier = 1;
    }
    seekClock(0);
  },
}));
