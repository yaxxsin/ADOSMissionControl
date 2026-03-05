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
  TYPE_KEYWORDS, MAG_CAL_FAIL_MESSAGES,
  CAL_TIMEOUTS,
} from "./calibration-types";
import type { DroneProtocol } from "@/lib/protocol/types";

interface SubsManager {
  subsRef: React.MutableRefObject<Map<string, (() => void)[]>>;
  timeoutRef: React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
}

export function addSub(manager: SubsManager, type: string, unsub: () => void) {
  if (!manager.subsRef.current.has(type)) manager.subsRef.current.set(type, []);
  manager.subsRef.current.get(type)!.push(unsub);
}

export function cleanupSubs(manager: SubsManager, type: string) {
  manager.subsRef.current.get(type)?.forEach((unsub) => unsub());
  manager.subsRef.current.delete(type);
  manager.timeoutRef.current.delete(type);
}

export function resetTimeout(
  manager: SubsManager,
  type: string,
  setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
  duration?: number,
) {
  const old = manager.timeoutRef.current.get(type);
  if (old) clearTimeout(old);
  const ms = duration ?? CAL_TIMEOUTS[type] ?? 60_000;
  const newTimeout = setTimeout(() => {
    setter((prev) => {
      if (prev.status !== "in_progress") return prev;
      cleanupSubs(manager, type);
      useDiagnosticsStore.getState().logCalibration(type, "failed");
      return { ...prev, status: "error", message: "Calibration timed out — no response from flight controller" };
    });
  }, ms);
  manager.timeoutRef.current.set(type, newTimeout);
  addSub(manager, type, () => clearTimeout(newTimeout));
}

export function subscribeToCalibrationStatus(
  manager: SubsManager,
  protocol: DroneProtocol,
  setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
  stepCount: number,
  calType: string,
  toast: (msg: string, type: string) => void,
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
    const fastTimer = setTimeout(() => {
      fastUnsub();
      if (!sawRelevantMsg) return;
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
    }, 5000);
    addSub(manager, calType, fastUnsub);
    addSub(manager, calType, () => clearTimeout(fastTimer));
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

function subscribeCompassCalibration(
  manager: SubsManager,
  protocol: DroneProtocol,
  setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
  calType: string,
  toast: (msg: string, type: string) => void,
) {
  if (protocol.onMagCalProgress) {
    const magProgressUnsub = protocol.onMagCalProgress(({ compassId, completionPct, calStatus, completionMask }) => {
      setter((prev) => {
        const cp = new Map(prev.compassProgress);
        const cs = new Map(prev.compassStatus);
        const cm = new Map(prev.compassCompletionMask);
        cp.set(compassId, completionPct);
        cs.set(compassId, calStatus);
        cm.set(compassId, completionMask);
        const values = Array.from(cp.values());
        const avgProgress = values.reduce((a, b) => a + b, 0) / values.length;
        const sectorCount = completionMask.reduce((sum, byte) => {
          let bits = byte;
          let count = 0;
          while (bits) { count += bits & 1; bits >>= 1; }
          return sum + count;
        }, 0);
        const statusText = calStatus <= 2 ? "Collecting samples" : "Refining fit";
        return {
          ...prev,
          compassProgress: cp,
          compassStatus: cs,
          compassCompletionMask: cm,
          progress: avgProgress,
          message: `Compass ${compassId}: ${statusText} — ${Math.round(completionPct)}% (${sectorCount}/80 sectors)`,
        };
      });
      resetTimeout(manager, calType, setter);
    });
    addSub(manager, calType, magProgressUnsub);
  }

  if (protocol.onAttitude) {
    const attUnsub = protocol.onAttitude(({ rollSpeed, pitchSpeed, yawSpeed }) => {
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        const cd = new Map(prev.compassDirection);
        for (const id of prev.compassProgress.keys()) {
          cd.set(id, { x: rollSpeed, y: pitchSpeed, z: yawSpeed });
        }
        return { ...prev, compassDirection: cd };
      });
    });
    addSub(manager, calType, attUnsub);
  }

  if (protocol.onMagCalReport) {
    const magReportUnsub = protocol.onMagCalReport(({
      compassId, calStatus, autosaved, ofsX, ofsY, ofsZ, fitness,
      diagX, diagY, diagZ, offdiagX, offdiagY, offdiagZ,
      orientationConfidence, oldOrientation, newOrientation, scaleFactor,
    }) => {
      setter((prev) => {
        const cr = new Map(prev.compassResults);
        cr.set(compassId, {
          ofsX, ofsY, ofsZ, fitness, calStatus,
          diagX, diagY, diagZ, offdiagX, offdiagY, offdiagZ,
          orientationConfidence, oldOrientation, newOrientation, scaleFactor,
        });
        const cs = new Map(prev.compassStatus);
        cs.set(compassId, calStatus);

        if (autosaved === 1 && calStatus === 4) {
          const allDone = Array.from(prev.compassProgress.keys()).every((id) => cr.has(id));
          if (allDone || prev.compassProgress.size === 0) {
            cleanupSubs(manager, calType);
            useDiagnosticsStore.getState().logCalibration(calType, "success", {
              offsets: { ofsX, ofsY, ofsZ },
              fitness,
              compassId,
            });
            return {
              ...prev,
              compassResults: cr,
              compassStatus: cs,
              status: "success",
              progress: 100,
              needsReboot: true,
              message: "All compasses calibrated successfully. Reboot required for new offsets to take effect.",
            };
          }
        }

        if (calStatus >= 5) {
          const passedIds = Array.from(cr.entries()).filter(([, r]) => r.calStatus === 4).map(([id]) => id);
          const failedIds = Array.from(cr.entries()).filter(([, r]) => r.calStatus >= 5).map(([id]) => id);
          const failInfo = MAG_CAL_FAIL_MESSAGES[calStatus];
          let msg: string;
          let fixes: string[] = [];
          if (passedIds.length > 0 && failedIds.length > 0) {
            msg = `Compass ${passedIds.join(", ")} succeeded, Compass ${failedIds.join(", ")} failed. You can force-save the good offsets or retry all.`;
          } else {
            msg = failInfo?.message ?? `Compass ${compassId} calibration warning (status ${calStatus})`;
            fixes = failInfo?.fixes ?? [];
          }
          cleanupSubs(manager, calType);
          useDiagnosticsStore.getState().logCalibration(calType, "failed", {
            offsets: { ofsX, ofsY, ofsZ },
            fitness,
            compassId,
          });
          return {
            ...prev,
            compassResults: cr,
            compassStatus: cs,
            status: "cal_warning",
            waitingForConfirm: true,
            message: msg + " — review offsets below and Force Save if acceptable, or Retry.",
            failureFixes: fixes,
          };
        }

        if (calStatus === 4 && autosaved === 0) {
          const allDone = Array.from(prev.compassProgress.keys()).every((id) => cr.has(id));
          if (allDone || prev.compassProgress.size === 0) {
            return {
              ...prev,
              compassResults: cr,
              compassStatus: cs,
              status: "waiting_accept",
              waitingForConfirm: true,
              progress: 100,
              message: "Calibration complete — review offsets and click Accept to save",
            };
          }
        }
        return {
          ...prev,
          compassResults: cr,
          compassStatus: cs,
        };
      });
    });
    addSub(manager, calType, magReportUnsub);
  }
}
