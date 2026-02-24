"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  CalibrationWizard,
  type CalibrationStatus,
  type CalibrationStep,
} from "./CalibrationWizard";
import { useDroneManager } from "@/stores/drone-manager";

interface CalibrationState {
  status: CalibrationStatus;
  currentStep: number;
  progress: number;
  message: string;
}

const INITIAL_STATE: CalibrationState = {
  status: "idle",
  currentStep: 0,
  progress: 0,
  message: "",
};

const ACCEL_STEPS: CalibrationStep[] = [
  { label: "Level", description: "Place vehicle level on a flat surface, press start" },
  { label: "Left Side", description: "Rotate vehicle so left side faces down" },
  { label: "Right Side", description: "Rotate vehicle so right side faces down" },
  { label: "Nose Up", description: "Point the nose straight up" },
  { label: "Nose Down", description: "Point the nose straight down" },
  { label: "Back", description: "Place vehicle upside-down" },
];

const GYRO_STEPS: CalibrationStep[] = [
  { label: "Keep Still", description: "Keep the vehicle perfectly still on a level surface" },
];

const COMPASS_STEPS: CalibrationStep[] = [
  { label: "Rotate", description: "Slowly rotate the vehicle in all orientations — roll, pitch, and yaw" },
];

const LEVEL_STEPS: CalibrationStep[] = [
  { label: "Level Surface", description: "Place vehicle on a perfectly level surface" },
];

const AIRSPEED_STEPS: CalibrationStep[] = [
  { label: "Cover Pitot", description: "Cover the pitot tube opening to seal it from airflow" },
];

/** Keywords per calibration type — only messages containing these are shown */
const TYPE_KEYWORDS: Record<string, string[]> = {
  accel: ["accel", "place vehicle"],
  gyro: ["gyro"],
  compass: ["compass", "mag"],
  level: ["level", "horizon"],
  airspeed: ["airspeed", "baro", "pitot"],
};

/** Human-readable compass calibration failure messages */
const MAG_CAL_FAIL_MESSAGES: Record<number, string> = {
  5: "Compass calibration failed — move away from metal objects and retry",
  6: "Compass calibration failed — rotate through more orientations",
  7: "Compass calibration failed — strong magnetic interference detected",
};

const CAL_TIMEOUT_MS = 60_000;

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [accel, setAccel] = useState<CalibrationState>(INITIAL_STATE);
  const [gyro, setGyro] = useState<CalibrationState>(INITIAL_STATE);
  const [compass, setCompass] = useState<CalibrationState>(INITIAL_STATE);
  const [level, setLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [airspeed, setAirspeed] = useState<CalibrationState>(INITIAL_STATE);

  // Per-type subscription map — each calibration type gets its own cleanup list
  const subsRef = useRef<Map<string, (() => void)[]>>(new Map());

  function addSub(type: string, unsub: () => void) {
    if (!subsRef.current.has(type)) subsRef.current.set(type, []);
    subsRef.current.get(type)!.push(unsub);
  }

  function cleanupSubs(type: string) {
    subsRef.current.get(type)?.forEach((unsub) => unsub());
    subsRef.current.delete(type);
  }

  // Cleanup all on unmount
  useEffect(() => {
    return () => {
      for (const type of subsRef.current.keys()) {
        cleanupSubs(type);
      }
    };
  }, []);

  const subscribeToStatus = useCallback(
    (
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
      calType: string,
    ) => {
      // Clean up previous subs for THIS type only (doesn't affect other active cals)
      cleanupSubs(calType);
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      const keywords = TYPE_KEYWORDS[calType] ?? [];

      // Timeout — auto-fail if no response after 60s
      const timeoutId = setTimeout(() => {
        setter((prev) => {
          if (prev.status !== "in_progress") return prev;
          cleanupSubs(calType);
          return {
            ...prev,
            status: "error",
            message: "Calibration timed out — no response from flight controller",
          };
        });
      }, CAL_TIMEOUT_MS);
      addSub(calType, () => clearTimeout(timeoutId));

      const statusUnsub = protocol.onStatusText(({ severity, text }) => {
        const lower = text.toLowerCase();

        // Type-relevance check: message must contain a keyword for THIS cal type,
        // or be a generic "calibration successful/failed/done" that also mentions our type
        const typeRelevant =
          keywords.some((kw) => lower.includes(kw)) || lower.includes(calType);

        // Detect completion
        if (lower.includes("calibration successful") || lower.includes("calibration done")) {
          if (!typeRelevant) return; // ignore success for a different cal type
          setter({
            status: "success",
            currentStep: stepCount,
            progress: 100,
            message: text,
          });
          cleanupSubs(calType);
          return;
        }

        // Detect failure
        if (lower.includes("calibration failed") || lower.includes("cal failed")) {
          if (!typeRelevant) return; // ignore failure for a different cal type
          setter((prev) => ({
            ...prev,
            status: "error",
            message: text,
          }));
          cleanupSubs(calType);
          return;
        }

        // From here, only process messages relevant to our type
        if (!typeRelevant) return;

        // Detect step progression (accel calibration)
        const placeMatch = lower.match(/place vehicle (.+)/);
        if (placeMatch) {
          setter((prev) => {
            const nextStep = Math.min(prev.currentStep + 1, stepCount - 1);
            return {
              ...prev,
              currentStep: nextStep,
              progress: ((nextStep + 1) / stepCount) * 100,
              message: text,
            };
          });
          return;
        }

        // Generic percentage progress
        const pctMatch = text.match(/(\d+)%/);
        if (pctMatch) {
          setter((prev) => ({
            ...prev,
            progress: parseInt(pctMatch[1], 10),
            message: text,
          }));
          return;
        }

        // Show relevant status text
        setter((prev) => ({ ...prev, message: text }));
      });
      addSub(calType, statusUnsub);

      // Compass-specific: MAG_CAL_PROGRESS + MAG_CAL_REPORT
      if (calType === "compass") {
        if (protocol.onMagCalProgress) {
          const magProgressUnsub = protocol.onMagCalProgress(({ completionPct }) => {
            setter((prev) => ({
              ...prev,
              progress: completionPct,
              message: `Compass calibration: ${completionPct}%`,
            }));
          });
          addSub(calType, magProgressUnsub);
        }

        if (protocol.onMagCalReport) {
          const magReportUnsub = protocol.onMagCalReport(({ calStatus }) => {
            if (calStatus === 4) {
              setter({
                status: "success",
                currentStep: stepCount,
                progress: 100,
                message: "Compass calibration complete",
              });
              cleanupSubs(calType);
            } else if (calStatus >= 5) {
              const msg =
                MAG_CAL_FAIL_MESSAGES[calStatus] ??
                `Compass calibration failed (status ${calStatus})`;
              setter((prev) => ({ ...prev, status: "error", message: msg }));
              cleanupSubs(calType);
            }
          });
          addSub(calType, magReportUnsub);
        }
      }
    },
    [getSelectedProtocol],
  );

  const cancelCalibration = useCallback(
    (
      type: string,
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
    ) => {
      cleanupSubs(type);
      setter(INITIAL_STATE);
    },
    [],
  );

  const startCalibration = useCallback(
    async (
      type: "accel" | "gyro" | "compass" | "level" | "airspeed",
      setter: React.Dispatch<React.SetStateAction<CalibrationState>>,
      stepCount: number,
    ) => {
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      setter({ status: "in_progress", currentStep: 0, progress: 0, message: "Starting calibration..." });
      subscribeToStatus(setter, stepCount, type);

      try {
        const result = await protocol.startCalibration(type);
        if (!result.success) {
          // Only show immediate error for definitive rejections
          // 2=DENIED, 3=UNSUPPORTED, 4=FAILED, 6=CANCELLED
          const definitiveFailure = [2, 3, 4, 6].includes(result.resultCode);
          if (definitiveFailure) {
            cleanupSubs(type);
            setter((prev) => ({
              ...prev,
              status: "error",
              message: result.message || "Calibration command rejected",
            }));
          }
          // For timeout (-1) or TEMPORARILY_REJECTED (1) — leave as in_progress,
          // STATUSTEXT listener will handle completion or failure
        }
        // On success the command was accepted — actual completion comes via STATUSTEXT
      } catch {
        cleanupSubs(type);
        setter((prev) => ({
          ...prev,
          status: "error",
          message: "Failed to send calibration command",
        }));
      }
    },
    [getSelectedProtocol, subscribeToStatus],
  );

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
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

        {/* Compass */}
        <CalibrationWizard
          title="Compass Calibration"
          description="Rotate vehicle slowly in all orientations until complete."
          steps={COMPASS_STEPS}
          currentStep={compass.currentStep}
          status={compass.status}
          progress={compass.progress}
          statusMessage={compass.message}
          onStart={() => startCalibration("compass", setCompass, COMPASS_STEPS.length)}
          onCancel={() => cancelCalibration("compass", setCompass)}
        />

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

        <div className="pb-4" />
      </div>
    </div>
  );
}
