"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  CalibrationWizard,
  type CalibrationStatus,
  type CompassProgressEntry,
  type CompassResultEntry,
} from "./CalibrationWizard";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CalibrationRebootBanner } from "./CalibrationRebootBanner";
import { CalibrationLog } from "./CalibrationLog";
import {
  type CompassResult,
  type CalibrationState,
  type CalibrationLogEntry,
  INITIAL_STATE,
  ACCEL_STEPS, GYRO_STEPS, COMPASS_STEPS, LEVEL_STEPS,
  AIRSPEED_STEPS, BARO_STEPS, RC_CAL_STEPS, ESC_CAL_STEPS, COMPASSMOT_STEPS,
  TYPE_KEYWORDS, MAG_CAL_FAIL_MESSAGES, LOG_KEYWORDS,
  CAL_TIMEOUTS, MAX_LOG_ENTRIES,
} from "./calibration-types";

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const connected = !!getSelectedProtocol();

  const [accel, setAccel] = useState<CalibrationState>(INITIAL_STATE);
  const [gyro, setGyro] = useState<CalibrationState>(INITIAL_STATE);
  const [compass, setCompass] = useState<CalibrationState>(INITIAL_STATE);
  const [level, setLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [airspeed, setAirspeed] = useState<CalibrationState>(INITIAL_STATE);
  const [baro, setBaro] = useState<CalibrationState>(INITIAL_STATE);
  const [rc, setRc] = useState<CalibrationState>(INITIAL_STATE);
  const [esc, setEsc] = useState<CalibrationState>(INITIAL_STATE);
  const [compassmot, setCompassmot] = useState<CalibrationState>(INITIAL_STATE);
  const [logEntries, setLogEntries] = useState<CalibrationLogEntry[]>([]);
  const [compassParams, setCompassParams] = useState<{
    COMPASS_USE: number | null;
    COMPASS_ORIENT: number | null;
    COMPASS_AUTO_ROT: number | null;
    COMPASS_OFFS_MAX: number | null;
    COMPASS_LEARN: number | null;
    COMPASS_EXTERNAL: number | null;
  }>({ COMPASS_USE: null, COMPASS_ORIENT: null, COMPASS_AUTO_ROT: null, COMPASS_OFFS_MAX: null, COMPASS_LEARN: null, COMPASS_EXTERNAL: null });

  // Per-type subscription map
  const subsRef = useRef<Map<string, (() => void)[]>>(new Map());
  // Track timeout IDs separately for resetting
  const timeoutRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  function addSub(type: string, unsub: () => void) {
    if (!subsRef.current.has(type)) subsRef.current.set(type, []);
    subsRef.current.get(type)!.push(unsub);
  }

  function cleanupSubs(type: string) {
    subsRef.current.get(type)?.forEach((unsub) => unsub());
    subsRef.current.delete(type);
    timeoutRef.current.delete(type);
  }

  function resetTimeout(type: string, setter: React.Dispatch<React.SetStateAction<CalibrationState>>, duration?: number) {
    const old = timeoutRef.current.get(type);
    if (old) clearTimeout(old);
    const ms = duration ?? CAL_TIMEOUTS[type] ?? 60_000;
    const newTimeout = setTimeout(() => {
      setter((prev) => {
        if (prev.status !== "in_progress") return prev;
        cleanupSubs(type);
        return { ...prev, status: "error", message: "Calibration timed out — no response from flight controller" };
      });
    }, ms);
    timeoutRef.current.set(type, newTimeout);
    addSub(type, () => clearTimeout(newTimeout));
  }

  // Global log subscription — subscribe to all calibration-related STATUSTEXT
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    const unsub = protocol.onStatusText(({ severity, text }) => {
      const lower = text.toLowerCase();
      if (LOG_KEYWORDS.some((kw) => lower.includes(kw))) {
        setLogEntries((prev) => {
          const next = [...prev, { timestamp: Date.now(), text, severity }];
          return next.length > MAX_LOG_ENTRIES ? next.slice(-MAX_LOG_ENTRIES) : next;
        });
      }
    });

    return unsub;
  }, [getSelectedProtocol]);

  // Fetch compass params for pre-calibration checks
  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const names = ["COMPASS_USE", "COMPASS_ORIENT", "COMPASS_AUTO_ROT", "COMPASS_OFFS_MAX", "COMPASS_LEARN", "COMPASS_EXTERNAL"] as const;
    Promise.allSettled(names.map((n) => protocol.getParameter(n))).then((results) => {
      const vals: Record<string, number | null> = {};
      names.forEach((n, i) => {
        const r = results[i];
        vals[n] = r.status === "fulfilled" ? r.value.value : null;
      });
      setCompassParams({
        COMPASS_USE: vals.COMPASS_USE ?? null,
        COMPASS_ORIENT: vals.COMPASS_ORIENT ?? null,
        COMPASS_AUTO_ROT: vals.COMPASS_AUTO_ROT ?? null,
        COMPASS_OFFS_MAX: vals.COMPASS_OFFS_MAX ?? null,
        COMPASS_LEARN: vals.COMPASS_LEARN ?? null,
        COMPASS_EXTERNAL: vals.COMPASS_EXTERNAL ?? null,
      });
    });
  }, [getSelectedProtocol]);

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const type of subsRef.current.keys()) {
        cleanupSubs(type);
      }
    };
  }, []);

  // Keyboard handler for accel cal confirm
  useEffect(() => {
    if (!accel.waitingForConfirm) return;
    const handler = (e: KeyboardEvent) => {
      // Ignore modifier-only presses
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      confirmAccelPosition();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accel.waitingForConfirm, accel.accelCalPosition]);

  const confirmAccelPosition = useCallback(() => {
    const protocol = getSelectedProtocol();
    if (!protocol?.confirmAccelCalPos || accel.accelCalPosition === null) return;
    protocol.confirmAccelCalPos(accel.accelCalPosition);
    setAccel((prev) => ({ ...prev, waitingForConfirm: false }));
  }, [getSelectedProtocol, accel.accelCalPosition]);

  const subscribeToStatus = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
      calType: string,
    ) => {
      cleanupSubs(calType);
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      const keywords = TYPE_KEYWORDS[calType] ?? [];

      // Initial timeout — uses per-type duration from CAL_TIMEOUTS
      resetTimeout(calType, setter);

      const statusUnsub = protocol.onStatusText(({ text }) => {
        const lower = text.toLowerCase();

        const typeRelevant =
          keywords.some((kw) => lower.includes(kw)) || lower.includes(calType);

        // Detect completion — covers ArduPilot-specific phrasing
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
          // Only accept success messages that are relevant to this calibration type — no generic fallback
          if (!typeRelevant) return;
          if (calType === "compass") {
            // Compass success comes from MAG_CAL_REPORT, not STATUSTEXT.
            // With param3=0, MAG_CAL_REPORT provides offsets and triggers waiting_accept.
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
          cleanupSubs(calType);
          return;
        }

        // Detect failure
        if (lower.includes("calibration failed") || lower.includes("cal failed")) {
          if (!typeRelevant) return;
          if (calType === "compass") {
            // FC auto-retries (param2=1). Only MAG_CAL_REPORT calStatus >= 5 is terminal.
            setter((prev) => ({ ...prev, message: `${text} — retrying automatically...` }));
            return;
          }
          setter((prev) => ({ ...prev, status: "error", message: text, waitingForConfirm: false }));
          toast(`${calType.charAt(0).toUpperCase() + calType.slice(1)} calibration failed`, "error");
          cleanupSubs(calType);
          return;
        }

        if (!typeRelevant) return;

        // For accel cal, "place vehicle" messages just update the display text
        // Step progression is driven by onAccelCalPos, not STATUSTEXT
        if (calType === "accel" && lower.match(/place vehicle/)) {
          setter((prev) => ({ ...prev, message: text }));
          return;
        }

        // Generic percentage progress
        const pctMatch = text.match(/(\d+)%/);
        if (pctMatch) {
          setter((prev) => ({ ...prev, progress: parseInt(pctMatch[1], 10), message: text }));
          return;
        }

        // Show relevant status text and reset timeout (FC is responding)
        setter((prev) => ({ ...prev, message: text }));
        resetTimeout(calType, setter);
      });
      addSub(calType, statusUnsub);

      // Fast-completion fallback for simple calibrations (gyro/level/baro/airspeed):
      // If COMMAND_ACK returned success (we're here so it did), set a 5s timer.
      // If no explicit success/failure STATUSTEXT arrived by then but a type-relevant
      // message was received, treat as success.
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
            // Only trigger if still in_progress (no success/failure detected yet)
            if (prev.status !== "in_progress") return prev;
            const rebootTypes = ["accel", "compass", "level", "compassmot", "esc"];
            cleanupSubs(calType);
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
        }, 5000);
        addSub(calType, fastUnsub);
        addSub(calType, () => clearTimeout(fastTimer));
      }

      // Accel-specific: subscribe to position requests from FC
      if (calType === "accel" && protocol.onAccelCalPos) {
        const accelPosUnsub = protocol.onAccelCalPos(({ position }) => {
          const stepIndex = position - 1; // position 1-6 → index 0-5
          setter((prev) => ({
            ...prev,
            currentStep: stepIndex,
            progress: ((stepIndex + 1) / stepCount) * 100,
            waitingForConfirm: true,
            accelCalPosition: position,
            message: `Place vehicle ${ACCEL_STEPS[stepIndex]?.label ?? `position ${position}`} — press any key or click Confirm`,
          }));
          // Reset timeout on each position request (user needs time to reposition)
          resetTimeout(calType, setter);
        });
        addSub(calType, accelPosUnsub);
      }

      // Compass-specific: MAG_CAL_PROGRESS + MAG_CAL_REPORT
      if (calType === "compass") {
        if (protocol.onMagCalProgress) {
          const magProgressUnsub = protocol.onMagCalProgress(({ compassId, completionPct, calStatus, completionMask }) => {
            setter((prev) => {
              const cp = new Map(prev.compassProgress);
              const cs = new Map(prev.compassStatus);
              const cm = new Map(prev.compassCompletionMask);
              cp.set(compassId, completionPct);
              cs.set(compassId, calStatus);
              cm.set(compassId, completionMask);
              // Overall progress = average of all compasses
              const values = Array.from(cp.values());
              const avgProgress = values.reduce((a, b) => a + b, 0) / values.length;
              // Count covered sectors
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
            // Reset timeout on each progress message
            resetTimeout(calType, setter);
          });
          addSub(calType, magProgressUnsub);
        }

        // Subscribe to ATTITUDE for live rotation bars (ArduPilot sends 0.0 for MAG_CAL_PROGRESS direction fields)
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
          addSub(calType, attUnsub);
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

              // If autosaved, mark complete automatically
              if (autosaved === 1 && calStatus === 4) {
                // Check if ALL compasses that sent progress have reported
                const allDone = Array.from(prev.compassProgress.keys()).every((id) => cr.has(id));
                if (allDone || prev.compassProgress.size === 0) {
                  cleanupSubs(calType);
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
                // Check for partial failure (some passed, some failed)
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
                cleanupSubs(calType);
                // Show results with warning — allow force-save instead of terminal error
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

              // calStatus === 4 but autosaved === 0: need manual accept
              if (calStatus === 4 && autosaved === 0) {
                // Check if ALL compasses that sent progress have reported success
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
          addSub(calType, magReportUnsub);
        }
      }
    },
    [getSelectedProtocol, toast],
  );

  const cancelCalibration = useCallback(
    async (
      type: string,
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
    ) => {
      const protocol = getSelectedProtocol();
      if (protocol) {
        if (type === "compass" && protocol.cancelCompassCal) {
          protocol.cancelCompassCal();
        } else if (protocol.cancelCalibration) {
          // Send PREFLIGHT_CALIBRATION with all zeros to cancel any active cal
          protocol.cancelCalibration();
        }
      }
      cleanupSubs(type);
      setter(INITIAL_STATE);
    },
    [getSelectedProtocol],
  );

  const forceCompassSave = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;

    const results = Array.from(compass.compassResults.entries());
    if (results.length === 0) return;

    try {
      for (const [compassId, r] of results) {
        // Parameter suffix: compass 0 = "", compass 1 = "2", compass 2 = "3"
        const suffix = compassId === 0 ? "" : `${compassId + 1}`;

        // Hard-iron offsets (always write)
        await protocol.setParameter(`COMPASS_OFS${suffix}_X`, r.ofsX);
        await protocol.setParameter(`COMPASS_OFS${suffix}_Y`, r.ofsY);
        await protocol.setParameter(`COMPASS_OFS${suffix}_Z`, r.ofsZ);

        // Soft-iron diagonal (write if not identity)
        if (r.diagX !== 1 || r.diagY !== 1 || r.diagZ !== 1) {
          await protocol.setParameter(`COMPASS_DIA${suffix}_X`, r.diagX);
          await protocol.setParameter(`COMPASS_DIA${suffix}_Y`, r.diagY);
          await protocol.setParameter(`COMPASS_DIA${suffix}_Z`, r.diagZ);
        }

        // Soft-iron off-diagonal (write if non-zero)
        if (r.offdiagX !== 0 || r.offdiagY !== 0 || r.offdiagZ !== 0) {
          await protocol.setParameter(`COMPASS_ODI${suffix}_X`, r.offdiagX);
          await protocol.setParameter(`COMPASS_ODI${suffix}_Y`, r.offdiagY);
          await protocol.setParameter(`COMPASS_ODI${suffix}_Z`, r.offdiagZ);
        }
      }

      // Persist to flash
      const flashResult = await protocol.commitParamsToFlash();
      if (!flashResult.success) {
        console.error("[Calibration] Flash commit failed:", flashResult.message);
      }

      setCompass((prev) => ({
        ...prev,
        status: "success",
        waitingForConfirm: false,
        needsReboot: true,
        message: "Compass offsets saved to flash. Reboot to apply.",
      }));
      toast("Compass offsets written to flash", "success");
    } catch {
      toast("Failed to write compass offsets", "error");
    }
  }, [getSelectedProtocol, compass.compassResults, toast]);

  const acceptCompass = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.acceptCompassCal) return;

    try {
      const result = await protocol.acceptCompassCal();
      if (!result.success) {
        // FC rejected accept — fall back to direct parameter write
        toast("FC rejected accept — saving offsets directly", "info");
        await forceCompassSave();
        return;
      }

      // Belt and suspenders: commit to flash after accept
      const flashResult = await protocol.commitParamsToFlash();
      if (!flashResult.success) {
        console.error("[Calibration] Flash commit failed:", flashResult.message);
      }

      setCompass((prev) => ({
        ...prev,
        status: "success",
        waitingForConfirm: false,
        progress: 100,
        needsReboot: true,
        message: "Compass offsets saved to flash. Reboot to apply.",
      }));
      cleanupSubs("compass");
      toast("Compass calibration accepted and saved to flash", "success");
    } catch {
      toast("Accept failed — try Force Save", "error");
    }
  }, [getSelectedProtocol, forceCompassSave, toast]);

  const startCalibration = useCallback(
    async (
      type: "accel" | "gyro" | "compass" | "level" | "airspeed" | "baro" | "rc" | "esc" | "compassmot",
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
    ) => {
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      // Auto-set COMPASS_AUTO_ROT=3 (lenient) to prevent orientation flickering
      if (type === "compass" && compassParams.COMPASS_AUTO_ROT !== null && compassParams.COMPASS_AUTO_ROT !== 3) {
        try {
          await protocol.setParameter("COMPASS_AUTO_ROT", 3);
          setCompassParams((p) => ({ ...p, COMPASS_AUTO_ROT: 3 }));
          toast("COMPASS_AUTO_ROT set to 3 (lenient) to prevent orientation flickering", "info");
        } catch { /* non-fatal */ }
      }

      setter({
        ...INITIAL_STATE,
        status: "in_progress",
        message: "Starting calibration...",
      });
      subscribeToStatus(setter, stepCount, type);

      try {
        const result = await protocol.startCalibration(type);
        if (!result.success) {
          cleanupSubs(type);
          const msg = result.resultCode === 5
            ? "Calibration already in progress — cancel first or wait for it to finish"
            : result.resultCode === 1
            ? "FC temporarily busy — wait a moment and retry"
            : result.message || "Calibration command rejected";
          setter((prev) => ({
            ...prev,
            status: "error",
            message: msg,
          }));
          toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration: ${msg}`, "error");
        } else {
          toast(`${type.charAt(0).toUpperCase() + type.slice(1)} calibration started`, "info");
        }
      } catch {
        cleanupSubs(type);
        setter((prev) => ({
          ...prev,
          status: "error",
          message: "Failed to send calibration command",
        }));
        toast("Failed to send calibration command", "error");
      }
    },
    [getSelectedProtocol, subscribeToStatus, toast, compassParams.COMPASS_AUTO_ROT, setCompassParams],
  );

  const compassProgressEntries: CompassProgressEntry[] = Array.from(compass.compassProgress.entries())
    .map(([id, pct]) => ({
      compassId: id,
      completionPct: pct,
      calStatus: compass.compassStatus.get(id) ?? 0,
      completionMask: compass.compassCompletionMask.get(id) ?? [],
      direction: compass.compassDirection.get(id) ?? { x: 0, y: 0, z: 0 },
    }));

  const compassResultEntries: CompassResultEntry[] = Array.from(compass.compassResults.entries())
    .map(([id, r]) => ({ ...r, compassId: id }));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
        {/* Left: Calibration Wizards */}
        <div className="space-y-6">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Sensor Calibration</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Step-by-step calibration wizards for accelerometer, gyroscope, compass, level, and airspeed
            </p>
            {!connected && (
              <p className="text-[10px] text-status-warning mt-2">
                Connect a drone to run calibrations
              </p>
            )}
          </div>

          {/* Accelerometer — 6-position */}
          <CalibrationWizard
            title="Accelerometer Calibration"
            description="6-position calibration. Place vehicle in each orientation when prompted."
            steps={ACCEL_STEPS}
            currentStep={accel.currentStep}
            status={accel.status}
            progress={accel.progress}
            statusMessage={accel.message}
            waitingForConfirm={accel.waitingForConfirm}
            onConfirm={confirmAccelPosition}
            onStart={() => startCalibration("accel", setAccel, ACCEL_STEPS.length)}
            onCancel={() => cancelCalibration("accel", setAccel)}
          />

          {/* Gyroscope */}
          <CalibrationWizard
            title="Gyroscope Calibration"
            description="Keep vehicle perfectly still during calibration."
            steps={GYRO_STEPS}
            currentStep={gyro.currentStep}
            status={gyro.status}
            progress={gyro.progress}
            statusMessage={gyro.message}
            onStart={() => startCalibration("gyro", setGyro, GYRO_STEPS.length)}
            onCancel={() => cancelCalibration("gyro", setGyro)}
          />

          {/* Compass pre-calibration param checks */}
          {connected && compass.status === "idle" && (
            <div className="border border-border-default bg-bg-secondary p-4">
              <h3 className="text-xs font-medium text-text-primary mb-2">Compass Pre-flight Checks</h3>
              <div className="space-y-1.5">
                {/* COMPASS_USE */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_USE</span>
                  {compassParams.COMPASS_USE === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : compassParams.COMPASS_USE === 1 ? (
                    <span className="text-status-success font-mono">Enabled</span>
                  ) : (
                    <span className="text-status-error font-mono">Disabled — enable COMPASS_USE first</span>
                  )}
                </div>
                {/* COMPASS_ORIENT */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_ORIENT</span>
                  {compassParams.COMPASS_ORIENT === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : (
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_ORIENT} {compassParams.COMPASS_ORIENT === 0 ? "(None)" : compassParams.COMPASS_ORIENT === 6 ? "(Yaw270)" : ""}
                    </span>
                  )}
                </div>
                {/* COMPASS_AUTO_ROT */}
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-text-secondary font-mono">COMPASS_AUTO_ROT</span>
                  {compassParams.COMPASS_AUTO_ROT === null ? (
                    <span className="text-text-tertiary">Loading...</span>
                  ) : compassParams.COMPASS_AUTO_ROT === 3 ? (
                    <span className="text-status-success font-mono">3 (Lenient)</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-status-warning font-mono">{compassParams.COMPASS_AUTO_ROT} — recommend 3 for lenient orientation detection</span>
                      <button
                        className="text-[9px] text-accent-primary hover:underline"
                        onClick={async () => {
                          const protocol = getSelectedProtocol();
                          if (!protocol) return;
                          await protocol.setParameter("COMPASS_AUTO_ROT", 3);
                          setCompassParams((p) => ({ ...p, COMPASS_AUTO_ROT: 3 }));
                          toast("COMPASS_AUTO_ROT set to 3", "success");
                        }}
                      >
                        Fix
                      </button>
                    </span>
                  )}
                </div>
                {/* COMPASS_OFFS_MAX */}
                {compassParams.COMPASS_OFFS_MAX !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_OFFS_MAX</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("font-mono", compassParams.COMPASS_OFFS_MAX < 850 ? "text-status-warning" : "text-text-primary")}>
                        {compassParams.COMPASS_OFFS_MAX} {compassParams.COMPASS_OFFS_MAX < 850 ? "— low limit" : ""}
                      </span>
                      {compassParams.COMPASS_OFFS_MAX < 2000 && (
                        <button
                          className="text-[9px] text-accent-primary hover:underline"
                          onClick={async () => {
                            const protocol = getSelectedProtocol();
                            if (!protocol) return;
                            await protocol.setParameter("COMPASS_OFFS_MAX", 2000);
                            setCompassParams((p) => ({ ...p, COMPASS_OFFS_MAX: 2000 }));
                            toast("COMPASS_OFFS_MAX set to 2000", "success");
                          }}
                        >
                          Increase to 2000
                        </button>
                      )}
                    </span>
                  </div>
                )}
                {/* COMPASS_LEARN */}
                {compassParams.COMPASS_LEARN !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_LEARN</span>
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_LEARN} ({compassParams.COMPASS_LEARN === 0 ? "Off" : compassParams.COMPASS_LEARN === 1 ? "Internal" : compassParams.COMPASS_LEARN === 2 ? "EKF" : compassParams.COMPASS_LEARN === 3 ? "InFlight" : "Unknown"})
                    </span>
                  </div>
                )}
                {/* COMPASS_EXTERNAL */}
                {compassParams.COMPASS_EXTERNAL !== null && (
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-text-secondary font-mono">COMPASS_EXTERNAL</span>
                    <span className="text-text-primary font-mono">
                      {compassParams.COMPASS_EXTERNAL === 1 ? "External" : "Internal"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Compass */}
          <CalibrationWizard
            title="Compass Calibration"
            description="Rotate vehicle slowly in all orientations until complete."
            steps={COMPASS_STEPS}
            currentStep={compass.currentStep}
            status={compass.status}
            progress={compass.progress}
            statusMessage={compass.message}
            waitingForConfirm={compass.waitingForConfirm}
            onConfirm={acceptCompass}
            confirmLabel="Accept Offsets"
            compassProgress={compassProgressEntries}
            compassResults={compassResultEntries}
            failureFixes={compass.failureFixes}
            onForceSave={forceCompassSave}
            preTips={[
              "Move at least 3m away from metal objects, vehicles, and buildings",
              "Remove magnetic accessories (phone mounts, metal tools) from nearby",
              "Ensure GPS fix if possible (helps validate compass orientation)",
              "Keep a firm grip — you will rotate the drone through all axes",
            ]}
            onStart={() => startCalibration("compass", setCompass, COMPASS_STEPS.length)}
            onCancel={() => cancelCalibration("compass", setCompass)}
          />

          {/* Compass Reboot Required Banner */}
          {compass.needsReboot && compass.status === "success" && (
            <CalibrationRebootBanner label="Compass offsets saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Orientation change alert */}
          {compass.status === "success" && compassResultEntries.some(
            (r) => r.oldOrientation !== r.newOrientation && r.newOrientation !== 0
          ) && (
            <div className="border border-status-warning/30 bg-status-warning/10 px-4 py-3">
              <p className="text-xs font-medium text-status-warning">Compass Orientation Changed</p>
              <p className="text-[10px] text-text-secondary mt-0.5">
                The calibration detected a different compass orientation than previously configured.
                Verify mounting orientation in parameters after reboot.
              </p>
            </div>
          )}

          {/* Accel Reboot Banner */}
          {accel.needsReboot && accel.status === "success" && (
            <CalibrationRebootBanner label="Accelerometer calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Level */}
          <CalibrationWizard
            title="Level Calibration"
            description="Set the reference level horizon for the flight controller."
            steps={LEVEL_STEPS}
            currentStep={level.currentStep}
            status={level.status}
            progress={level.progress}
            statusMessage={level.message}
            onStart={() => startCalibration("level", setLevel, LEVEL_STEPS.length)}
            onCancel={() => cancelCalibration("level", setLevel)}
          />

          {/* Level Reboot Banner */}
          {level.needsReboot && level.status === "success" && (
            <CalibrationRebootBanner label="Level calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Airspeed — ArduPlane only */}
          <CalibrationWizard
            title="Airspeed Calibration"
            description="ArduPlane only — cover the pitot tube opening before starting."
            steps={AIRSPEED_STEPS}
            currentStep={airspeed.currentStep}
            status={airspeed.status}
            progress={airspeed.progress}
            statusMessage={airspeed.message}
            onStart={() => startCalibration("airspeed", setAirspeed, AIRSPEED_STEPS.length)}
            onCancel={() => cancelCalibration("airspeed", setAirspeed)}
          />

          {/* Barometer */}
          <CalibrationWizard
            title="Barometer Calibration"
            description="Resets ground pressure reference. Keep vehicle still during calibration."
            steps={BARO_STEPS}
            currentStep={baro.currentStep}
            status={baro.status}
            progress={baro.progress}
            statusMessage={baro.message}
            onStart={() => startCalibration("baro", setBaro, BARO_STEPS.length)}
            onCancel={() => cancelCalibration("baro", setBaro)}
          />

          {/* Radio Calibration */}
          <CalibrationWizard
            title="Radio Calibration"
            description="Calibrate RC transmitter stick endpoints and trims. Move all sticks and switches to full extent."
            steps={RC_CAL_STEPS}
            currentStep={rc.currentStep}
            status={rc.status}
            progress={rc.progress}
            statusMessage={rc.message}
            unsupportedNotice="RC calibration requires live channel visualization — use the Receiver panel to verify RC endpoints and set trims."
            preTips={[
              "Turn on RC transmitter and verify binding before starting",
              "Ensure all trims on transmitter are centered (no sub-trim)",
              "You will need to move ALL sticks and switches to their extremes",
            ]}
            onStart={() => startCalibration("rc", setRc, RC_CAL_STEPS.length)}
            onCancel={() => cancelCalibration("rc", setRc)}
          />

          {/* ESC Calibration */}
          <CalibrationWizard
            title="ESC Calibration"
            description="Set ESC throttle endpoints. REMOVE ALL PROPELLERS before starting."
            steps={ESC_CAL_STEPS}
            currentStep={esc.currentStep}
            status={esc.status}
            progress={esc.progress}
            statusMessage={esc.message}
            preTips={[
              "CRITICAL: Remove ALL propellers before starting",
              "Disconnect battery before beginning the sequence",
              "Some ESCs require this calibration on first use",
              "If using BLHeli/SimonK ESCs, use their own calibration tools instead",
            ]}
            onStart={() => startCalibration("esc", setEsc, ESC_CAL_STEPS.length)}
            onCancel={() => cancelCalibration("esc", setEsc)}
          />

          {/* ESC Reboot Banner */}
          {esc.needsReboot && esc.status === "success" && (
            <CalibrationRebootBanner label="ESC calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* CompassMot */}
          <CalibrationWizard
            title="CompassMot (Motor Interference)"
            description="Measures magnetic interference from motors/ESCs at various throttle levels. Compensates compass readings."
            steps={COMPASSMOT_STEPS}
            currentStep={compassmot.currentStep}
            status={compassmot.status}
            progress={compassmot.progress}
            statusMessage={compassmot.message}
            preTips={[
              "Ensure GPS has 3D fix before starting",
              "Vehicle must be in open area away from metal objects",
              "Props ON — motors WILL spin during this test",
              "Interference below 30% is acceptable, below 15% is good",
            ]}
            onStart={() => startCalibration("compassmot", setCompassmot, COMPASSMOT_STEPS.length)}
            onCancel={() => cancelCalibration("compassmot", setCompassmot)}
          />

          {/* CompassMot Reboot Banner */}
          {compassmot.needsReboot && compassmot.status === "success" && (
            <CalibrationRebootBanner label="CompassMot calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          <div className="pb-4" />
        </div>

        {/* Right: Calibration Log */}
        <CalibrationLog logEntries={logEntries} onClear={() => setLogEntries([])} />
      </div>
    </div>
  );
}
