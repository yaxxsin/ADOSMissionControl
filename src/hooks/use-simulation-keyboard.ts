/**
 * @module use-simulation-keyboard
 * @description Keyboard shortcuts for simulation playback controls.
 * Space = play/pause, Left/Right = step, [ ] = speed, Home = reset, End = skip to end.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useSimulationStore } from "@/stores/simulation-store";

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4];

export function useSimulationKeyboard(active: boolean) {
  useEffect(() => {
    if (!active) return;

    function handleKey(e: KeyboardEvent) {
      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const store = useSimulationStore.getState();

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (store.playbackState === "playing") {
            store.pause();
          } else {
            store.play();
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          store.stepBack();
          break;
        case "ArrowRight":
          e.preventDefault();
          store.stepForward();
          break;
        case "[": {
          const idx = SPEED_OPTIONS.indexOf(store.playbackSpeed);
          if (idx > 0) store.setSpeed(SPEED_OPTIONS[idx - 1]);
          break;
        }
        case "]": {
          const idx = SPEED_OPTIONS.indexOf(store.playbackSpeed);
          if (idx < SPEED_OPTIONS.length - 1) store.setSpeed(SPEED_OPTIONS[idx + 1]);
          break;
        }
        case "Home":
          e.preventDefault();
          store.stop();
          break;
        case "End":
          e.preventDefault();
          store.seek(store.totalDuration);
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active]);
}
