/**
 * Calibration status subscription logic — subscribes to MAVLink STATUSTEXT,
 * MAG_CAL_PROGRESS, MAG_CAL_REPORT, ACCEL_CAL_POS, and ATTITUDE for
 * calibration progress tracking.
 */

import { useDiagnosticsStore } from "@/stores/diagnostics-store";
import {
  type CalibrationState,
  INITIAL_STATE,
  ACCEL_STEPS,
  TYPE_KEYWORDS,
} from "./calibration-types";
import type { DroneProtocol } from "@/lib/protocol/types";
import { addSub, cleanupSubs, resetTimeout } from "./cal-sub-helpers";
import { subscribeCompassCalibration } from "./compass-cal-subscriptions";

// Re-export helpers so existing importers don't break
export { addSub, cleanupSubs, resetTimeout } from "./cal-sub-helpers";

export function subscribeToCalibrationStatus(
  manager: { subsRef: React.MutableRefObject<Map<string, (() => void)[]>>; timeoutRef: React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>> },
  protocol: DroneProtocol,
  setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
  stepCount: number,
  calType: string,
  toast: (msg: string, status?: "success" | "warning" | "error" | "info") => void,
) {
  cleanupSubs(manager, calType);

  const keywords = TYPE_KEYWORDS[calType] ?? [];
  resetTimeout(manager, calType, setter);

  const statusUnsub = protocol.onStatusText(({ text }) => {
    const lower = text.toLowerCase();
    const typeRelevant =
      keywords.some((kw) => lower.includes(kw)) || lower.includes(calType);

    const isSuccessMessage =
      lower.includes("calibration successful") ||
      lower.includes("calibration done") ||
      lower.includes("calibration complete") ||
      (lower.includes("calibrated") && lower.includes("requires reboot")) ||
      lower.includes("trim ok") ||
      lower.includes("trim saved") ||
      lower.includes("cal done") ||
      lower.includes("offsets saved") ||
      lower.includes("offsets complete") ||
      lower.includes("cal complete");

    if (isSuccessMessage) {
      if (!typeRelevant) return;
      if (calType === "compass") {
        setter((prev) => ({ ...prev, message: text }));
        return;
      }
      const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        return {
          ...INITIAL_STATE,
          status: "success",
          currentStep: stepCount,
          progress: 100,
          message: text,
          needsReboot: rebootTypes.includes(calType),
        };
      });
      toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
      useDiagnosticsStore.getState().logCalibration(calType, "success");
      cleanupSubs(manager, calType);
      return;
    }

    if (lower.includes("calibration failed") || lower.includes("cal failed")) {
      if (!typeRelevant) return;
      if (calType === "compass") {
        setter((prev) => ({ ...prev, message: `${text} — retrying automatically...` }));
        return;
      }
      setter((prev) => ({ ...prev, status: "error", message: text, waitingForConfirm: false }));
      toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration failed`, "error");
      useDiagnosticsStore.getState().logCalibration(calType, "failed");
      cleanupSubs(manager, calType);
      return;
    }

    if (!typeRelevant) return;

    if (calType === "accel" && lower.match(/place vehicle/)) {
      setter((prev) => ({ ...prev, message: text }));
      return;
    }

    const pctMatch = text.match(/(\d+)%/);
    if (pctMatch) {
      setter((prev) => ({ ...prev, progress: parseInt(pctMatch[1], 10), message: text }));
      return;
    }

    setter((prev) => ({ ...prev, message: text }));
    resetTimeout(manager, calType, setter);
  });
  addSub(manager, calType, statusUnsub);

  // Fast-completion fallback for simple calibrations
  const FAST_CAL_TYPES = ["gyro", "level", "baro", "airspeed"];
  if (FAST_CAL_TYPES.includes(calType)) {
    let sawRelevantMsg = false;
    const fastUnsub = protocol.onStatusText(({ text: t }) => {
      const l = t.toLowerCase();
      const kws = TYPE_KEYWORDS[calType] ?? [];
      if (kws.some((kw) => l.includes(kw)) || l.includes(calType)) {
        sawRelevantMsg = true;
      }
    });
    // Primary timer: 5s if we saw a relevant STATUSTEXT
    const fastTimer = setTimeout(() => {
      if (sawRelevantMsg) {
        fastUnsub();
        setter((prev) => {
          if (prev.status !== "in_progress") return prev;
          const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
          cleanupSubs(manager, calType);
          return {
            ...INITIAL_STATE,
            status: "success",
            currentStep: stepCount,
            progress: 100,
            message: prev.message || `${calType} calibration complete`,
            needsReboot: rebootTypes.includes(calType),
          };
        });
        toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
        useDiagnosticsStore.getState().logCalibration(calType, "success");
      }
    }, 5000);
    // Secondary timer: 8s fallback when no STATUSTEXT arrives but COMMAND_ACK confirmed success
    const noMsgFallbackTimer = setTimeout(() => {
      fastUnsub();
      if (sawRelevantMsg) return; // already handled by primary timer
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        if (!prev.commandAccepted) return prev; // no ACK confirmation, let timeout handle it
        const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
        cleanupSubs(manager, calType);
        return {
          ...INITIAL_STATE,
          status: "success",
          currentStep: stepCount,
          progress: 100,
          message: `${calType} calibration complete (no status feedback from FC)`,
          needsReboot: rebootTypes.includes(calType),
        };
      });
      toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration complete`, "success");
      useDiagnosticsStore.getState().logCalibration(calType, "success");
    }, 8000);
    addSub(manager, calType, fastUnsub);
    addSub(manager, calType, () => clearTimeout(fastTimer));
    addSub(manager, calType, () => clearTimeout(noMsgFallbackTimer));
  }

  // Accel-specific: subscribe to position requests from FC
  if (calType === "accel" && protocol.onAccelCalPos) {
    const accelPosUnsub = protocol.onAccelCalPos(({ position }) => {
      const stepIndex = position - 1;
      setter((prev) => ({
        ...prev,
        currentStep: stepIndex,
        progress: ((stepIndex + 1) / stepCount) * 100,
        waitingForConfirm: true,
        accelCalPosition: position,
        message: `Place vehicle ${ACCEL_STEPS[stepIndex]?.label ?? `position ${position}`} — press any key or click Confirm`,
      }));
      resetTimeout(manager, calType, setter);
    });
    addSub(manager, calType, accelPosUnsub);
  }

  // Compass-specific: MAG_CAL_PROGRESS + MAG_CAL_REPORT
  if (calType === "compass") {
    subscribeCompassCalibration(manager, protocol, setter, calType, toast);
  }
}
