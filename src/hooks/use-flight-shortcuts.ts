/**
 * @module use-flight-shortcuts
 * @description Keyboard shortcuts for flight actions (Shift+key).
 * ARM/DISARM, RTH, Land, Takeoff, Pause/Hold/Resume, Abort.
 * Kill has no shortcut (too dangerous, requires 2-step click).
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useToast } from "@/components/ui/toast";

interface UseFlightShortcutsParams {
  enabled: boolean;
  onRthConfirm: () => void;
  onAbortConfirm: () => void;
  takeoffAlt: string;
}

export function useFlightShortcuts({
  enabled,
  onRthConfirm,
  onAbortConfirm,
  takeoffAlt,
}: UseFlightShortcutsParams) {
  const { toast } = useToast();

  useEffect(() => {
    if (!enabled) return;

    function handleKey(e: KeyboardEvent) {
      // Require Shift held, reject if Ctrl/Meta/Alt also held
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;

      // Don't capture when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const droneState = useDroneStore.getState();
      const protocol = useDroneManager.getState().getSelectedProtocol();
      const isArmed = droneState.armState === "armed";

      switch (e.key) {
        case "A": {
          // ARM / DISARM toggle
          e.preventDefault();
          if (protocol) {
            if (isArmed) protocol.disarm();
            else protocol.arm();
          } else {
            droneState.setArmState(isArmed ? "disarmed" : "armed");
          }
          toast(isArmed ? "Disarmed" : "Armed", isArmed ? "info" : "success");
          break;
        }
        case "R": {
          // Return to Home (opens confirmation dialog)
          e.preventDefault();
          onRthConfirm();
          break;
        }
        case "L": {
          // Land
          e.preventDefault();
          if (protocol) protocol.land();
          else droneState.setFlightMode("LAND");
          toast("Landing", "info");
          break;
        }
        case "T": {
          // Takeoff
          e.preventDefault();
          const alt = parseFloat(takeoffAlt);
          if (isNaN(alt) || alt <= 0) {
            toast("Invalid takeoff altitude", "error");
            return;
          }
          if (protocol) {
            if (!isArmed) protocol.arm();
            protocol.takeoff(alt);
          }
          toast(`Takeoff to ${alt}m`, "success");
          break;
        }
        case "P": {
          // Pause / Hold / Resume (context-dependent)
          e.preventDefault();
          const mode = droneState.flightMode;
          const prevMode = droneState.previousMode;

          if (mode === "AUTO") {
            if (protocol) protocol.pauseMission();
            else droneState.setFlightMode("LOITER");
            toast("Mission paused", "info");
          } else if (mode === "LOITER" && prevMode === "AUTO") {
            if (protocol) protocol.resumeMission();
            else droneState.setFlightMode("AUTO");
            toast("Mission resumed", "success");
          } else {
            if (protocol) protocol.setFlightMode("LOITER");
            else droneState.setFlightMode("LOITER");
            toast("Hold position", "info");
          }
          break;
        }
        case "X": {
          // Abort (opens confirmation dialog)
          e.preventDefault();
          onAbortConfirm();
          break;
        }
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [enabled, onRthConfirm, onAbortConfirm, takeoffAlt, toast]);
}
