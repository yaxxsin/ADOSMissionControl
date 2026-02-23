"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  CalibrationWizard,
  type CalibrationStatus,
  type CalibrationStep,
} from "./CalibrationWizard";
import { useDroneManager } from "@/stores/drone-manager";
import { Crosshair } from "lucide-react";

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

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [accel, setAccel] = useState<CalibrationState>(INITIAL_STATE);
  const [gyro, setGyro] = useState<CalibrationState>(INITIAL_STATE);
  const [compass, setCompass] = useState<CalibrationState>(INITIAL_STATE);
  const [level, setLevel] = useState<CalibrationState>(INITIAL_STATE);
  const [airspeed, setAirspeed] = useState<CalibrationState>(INITIAL_STATE);

  const statusUnsubRef = useRef<(() => void) | null>(null);

  // Subscribe to status text for calibration progress updates
  useEffect(() => {
    return () => {
      statusUnsubRef.current?.();
    };
  }, []);

  const subscribeToStatus = useCallback(
    (setter: React.Dispatch<React.SetStateAction<CalibrationState>>, stepCount: number) => {
      statusUnsubRef.current?.();
      const protocol = getSelectedProtocol();
      if (!protocol) return;

      statusUnsubRef.current = protocol.onStatusText(({ severity, text }) => {
        const lower = text.toLowerCase();

        // Detect progress messages
        if (lower.includes("calibration successful") || lower.includes("calibration done")) {
          setter({
            status: "success",
            currentStep: stepCount,
            progress: 100,
            message: text,
          });
          statusUnsubRef.current?.();
          statusUnsubRef.current = null;
          return;
        }

        if (lower.includes("calibration failed") || lower.includes("cal failed")) {
          setter((prev) => ({
            ...prev,
            status: "error",
            message: text,
          }));
          statusUnsubRef.current?.();
          statusUnsubRef.current = null;
          return;
        }

        // Detect step progression
        const placeMatch = lower.match(/place vehicle (.+)/);
        if (placeMatch) {
          setter((prev) => ({
            ...prev,
            currentStep: Math.min(prev.currentStep + 1, stepCount - 1),
            progress: ((prev.currentStep + 1) / stepCount) * 100,
            message: text,
          }));
          return;
        }

        // Generic progress
        const pctMatch = text.match(/(\d+)%/);
        if (pctMatch) {
          setter((prev) => ({
            ...prev,
            progress: parseInt(pctMatch[1], 10),
            message: text,
          }));
          return;
        }

        // Any other status text during calibration
        setter((prev) => ({
          ...prev,
          message: text,
        }));
      });
    },
    [getSelectedProtocol],
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
      subscribeToStatus(setter, stepCount);

      try {
        const result = await protocol.startCalibration(type);
        if (!result.success) {
          setter((prev) => ({
            ...prev,
            status: "error",
            message: result.message || "Calibration command rejected",
          }));
        }
        // On success the command was accepted — actual completion comes via STATUSTEXT
      } catch {
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
        />

        <div className="pb-4" />
      </div>
    </div>
  );
}
