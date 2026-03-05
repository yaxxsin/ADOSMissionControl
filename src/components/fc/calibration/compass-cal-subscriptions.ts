/**
 * Compass calibration subscription logic — MAG_CAL_PROGRESS, MAG_CAL_REPORT,
 * and ATTITUDE subscriptions for compass calibration progress tracking.
 */

import { useDiagnosticsStore } from "@/stores/diagnostics-store";
import {
  type CalibrationState,
  MAG_CAL_FAIL_MESSAGES,
} from "./calibration-types";
import type { DroneProtocol } from "@/lib/protocol/types";
import { type SubsManager, addSub, cleanupSubs, resetTimeout } from "./cal-sub-helpers";

export function subscribeCompassCalibration(
  manager: SubsManager,
  protocol: DroneProtocol,
  setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
  calType: string,
  toast: (msg: string, status?: "success" | "warning" | "error" | "info") => void,
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
