"use client";

import { useDroneManager } from "@/stores/drone-manager";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import {
  ACCEL_STEPS, GYRO_STEPS, COMPASS_STEPS, LEVEL_STEPS,
  AIRSPEED_STEPS, BARO_STEPS, ESC_CAL_STEPS, COMPASSMOT_STEPS,
} from "./calibration-types";
import { CalibrationWizard } from "./CalibrationWizard";
import type { CompassProgressEntry, CompassResultEntry } from "./CalibrationWizard";
import { CalibrationRebootBanner } from "./CalibrationRebootBanner";
import { CalibrationLog } from "./CalibrationLog";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { RcCalibrationWizard } from "./RcCalibrationWizard";
import { useCalibrationEngine } from "./useCalibrationEngine";
import { CalibrationDiffTable } from "./CalibrationDiffTable";
import { CompassPreflightChecks } from "./CompassPreflightChecks";
import { PX4CalibrationsSection } from "./PX4CalibrationsSection";
import { RcChannelMapSection } from "../receiver/RcChannelMapSection";
import { GpsConfigSection } from "../sensors/GpsConfigSection";
import { ServoCalibrationSection } from "../misc/ServoCalibrationSection";

export function CalibrationPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { firmwareType } = useFirmwareCapabilities();
  const isBetaflight = firmwareType === "betaflight";
  const connected = !!getSelectedProtocol();

  const cal = useCalibrationEngine();

  const compassProgressEntries: CompassProgressEntry[] = Array.from(cal.compass.compassProgress.entries())
    .map(([id, pct]) => ({
      compassId: id,
      completionPct: pct,
      calStatus: cal.compass.compassStatus.get(id) ?? 0,
      completionMask: cal.compass.compassCompletionMask.get(id) ?? [],
      direction: cal.compass.compassDirection.get(id) ?? { x: 0, y: 0, z: 0 },
    }));

  const compassResultEntries: CompassResultEntry[] = Array.from(cal.compass.compassResults.entries())
    .map(([id, r]) => ({ ...r, compassId: id }));

  return (
    <ArmedLockOverlay className="overflow-y-auto">
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

          {/* Betaflight: simplified calibration (accel only) */}
          {isBetaflight && (
            <>
              <CalibrationWizard
                title="Accelerometer Calibration"
                description="Place the quad on a flat surface and keep it still. Betaflight calibration takes about 5 seconds."
                steps={[{ label: "Calibrating", description: "Keep the quad perfectly still on a flat surface" }]}
                currentStep={cal.accel.currentStep}
                status={cal.accel.status}
                progress={cal.accel.progress}
                statusMessage={cal.accel.message || (cal.accel.status === "in_progress" ? "Calibrating... keep the quad still" : undefined)}
                onStart={() => cal.startCalibration("accel", cal.setAccel, 1)}
                onCancel={() => cal.cancelCalibration("accel", cal.setAccel)}
              />
              <div className="border border-border-default bg-bg-secondary p-4 space-y-2">
                <h3 className="text-sm font-medium text-text-primary">Betaflight Calibration</h3>
                <p className="text-xs text-text-tertiary">
                  Betaflight supports accelerometer calibration via MSP. Gyro calibration runs automatically on every boot.
                  Compass calibration (if a magnetometer is present) should be done through the Betaflight Configurator or CLI.
                </p>
                <p className="text-xs text-text-tertiary">
                  Other calibration types (level, airspeed, barometer, ESC, RC, CompassMot) are ArduPilot-specific and not available on Betaflight.
                </p>
              </div>
            </>
          )}

          {/* Accelerometer — 6-position (ArduPilot/PX4) */}
          {!isBetaflight && <CalibrationWizard
            title="Accelerometer Calibration"
            description="6-position calibration. Place vehicle in each orientation when prompted."
            steps={ACCEL_STEPS}
            currentStep={cal.accel.currentStep}
            status={cal.accel.status}
            progress={cal.accel.progress}
            statusMessage={cal.accel.message}
            waitingForConfirm={cal.accel.waitingForConfirm}
            onConfirm={cal.confirmAccelPosition}
            onStart={() => cal.startCalibration("accel", cal.setAccel, ACCEL_STEPS.length)}
            onCancel={() => cal.cancelCalibration("accel", cal.setAccel)}
          />}

          {/* Gyroscope */}
          {!isBetaflight && <CalibrationWizard
            title="Gyroscope Calibration"
            description="Keep vehicle perfectly still during calibration."
            steps={GYRO_STEPS}
            currentStep={cal.gyro.currentStep}
            status={cal.gyro.status}
            progress={cal.gyro.progress}
            statusMessage={cal.gyro.message}
            onStart={() => cal.startCalibration("gyro", cal.setGyro, GYRO_STEPS.length)}
            onCancel={() => cal.cancelCalibration("gyro", cal.setGyro)}
          />}

          {/* Compass pre-calibration checks (ArduPilot only) */}
          {!isBetaflight && connected && !cal.isPx4 && cal.compass.status === "idle" && (
            <CompassPreflightChecks
              compassParams={cal.compassParams}
              setCompassParams={cal.setCompassParams}
            />
          )}

          {/* Compass */}
          {!isBetaflight && <CalibrationWizard
            title="Compass Calibration"
            description="Rotate vehicle slowly in all orientations until complete."
            steps={COMPASS_STEPS}
            currentStep={cal.compass.currentStep}
            status={cal.compass.status}
            progress={cal.compass.progress}
            statusMessage={cal.compass.message}
            waitingForConfirm={cal.compass.waitingForConfirm}
            onConfirm={cal.acceptCompass}
            confirmLabel="Accept Offsets"
            compassProgress={compassProgressEntries}
            compassResults={compassResultEntries}
            failureFixes={cal.compass.failureFixes}
            onForceSave={cal.forceCompassSave}
            preTips={[
              "Move at least 3m away from metal objects, vehicles, and buildings",
              "Remove magnetic accessories (phone mounts, metal tools) from nearby",
              "Ensure GPS fix if possible (helps validate compass orientation)",
              "Keep a firm grip — you will rotate the drone through all axes",
            ]}
            onStart={() => cal.startCalibration("compass", cal.setCompass, COMPASS_STEPS.length)}
            onCancel={() => cal.cancelCalibration("compass", cal.setCompass)}
          />}

          {/* Compass Reboot Required Banner */}
          {!isBetaflight && cal.compass.needsReboot && cal.compass.status === "success" && (
            <CalibrationRebootBanner label="Compass offsets saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Orientation change alert */}
          {!isBetaflight && cal.compass.status === "success" && compassResultEntries.some(
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
          {cal.accel.needsReboot && cal.accel.status === "success" && (
            <CalibrationRebootBanner label="Accelerometer calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          {/* Level through CompassMot: ArduPilot/PX4 only */}
          {!isBetaflight && (
          <>
          <CalibrationWizard
            title="Level Calibration"
            description="Set the reference level horizon for the flight controller."
            steps={LEVEL_STEPS}
            currentStep={cal.level.currentStep}
            status={cal.level.status}
            progress={cal.level.progress}
            statusMessage={cal.level.message}
            onStart={() => cal.startCalibration("level", cal.setLevel, LEVEL_STEPS.length)}
            onCancel={() => cal.cancelCalibration("level", cal.setLevel)}
          />

          {cal.level.needsReboot && cal.level.status === "success" && (
            <CalibrationRebootBanner label="Level calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          <CalibrationWizard
            title="Airspeed Calibration"
            description="ArduPlane only — cover the pitot tube opening before starting."
            steps={AIRSPEED_STEPS}
            currentStep={cal.airspeed.currentStep}
            status={cal.airspeed.status}
            progress={cal.airspeed.progress}
            statusMessage={cal.airspeed.message}
            onStart={() => cal.startCalibration("airspeed", cal.setAirspeed, AIRSPEED_STEPS.length)}
            onCancel={() => cal.cancelCalibration("airspeed", cal.setAirspeed)}
          />

          <CalibrationWizard
            title="Barometer Calibration"
            description="Resets ground pressure reference. Keep vehicle still during calibration."
            steps={BARO_STEPS}
            currentStep={cal.baro.currentStep}
            status={cal.baro.status}
            progress={cal.baro.progress}
            statusMessage={cal.baro.message}
            onStart={() => cal.startCalibration("baro", cal.setBaro, BARO_STEPS.length)}
            onCancel={() => cal.cancelCalibration("baro", cal.setBaro)}
          />

          {/* Baro live pressure readout */}
          {connected && cal.baroPressure && (
            <div className="border border-border-default bg-bg-secondary px-4 py-2.5 -mt-4">
              <div className="flex items-center gap-4 text-[10px] font-mono">
                <span className="text-text-secondary">Pressure</span>
                <span className="text-text-primary">{cal.baroPressure.pressAbs.toFixed(2)} hPa</span>
                <span className="text-text-secondary">Temp</span>
                <span className="text-text-primary">{cal.baroPressure.temperature.toFixed(1)} °C</span>
              </div>
            </div>
          )}

          <RcCalibrationWizard connected={connected} />
          <RcChannelMapSection />
          <GpsConfigSection />
          <ServoCalibrationSection />

          <CalibrationWizard
            title="ESC Calibration"
            description="Set ESC throttle endpoints. REMOVE ALL PROPELLERS before starting."
            steps={ESC_CAL_STEPS}
            currentStep={cal.esc.currentStep}
            status={cal.esc.status}
            progress={cal.esc.progress}
            statusMessage={cal.esc.message}
            preTips={[
              "CRITICAL: Remove ALL propellers before starting",
              "Disconnect battery before beginning the sequence",
              "Some ESCs require this calibration on first use",
              "If using BLHeli/SimonK ESCs, use their own calibration tools instead",
            ]}
            onStart={() => cal.startCalibration("esc", cal.setEsc, ESC_CAL_STEPS.length)}
            onCancel={() => cal.cancelCalibration("esc", cal.setEsc)}
          />

          {cal.esc.needsReboot && cal.esc.status === "success" && (
            <CalibrationRebootBanner label="ESC calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}

          <CalibrationWizard
            title="CompassMot (Motor Interference)"
            description="Measures magnetic interference from motors/ESCs at various throttle levels. Compensates compass readings."
            steps={COMPASSMOT_STEPS}
            currentStep={cal.compassmot.currentStep}
            status={cal.compassmot.status}
            progress={cal.compassmot.progress}
            statusMessage={cal.compassmot.message}
            preTips={[
              "Ensure GPS has 3D fix before starting",
              "Vehicle must be in open area away from metal objects",
              "Props ON — motors WILL spin during this test",
              "Interference below 30% is acceptable, below 15% is good",
            ]}
            onStart={() => cal.startCalibration("compassmot", cal.setCompassmot, COMPASSMOT_STEPS.length)}
            onCancel={() => cal.cancelCalibration("compassmot", cal.setCompassmot)}
          />

          {cal.compassmot.needsReboot && cal.compassmot.status === "success" && (
            <CalibrationRebootBanner label="CompassMot calibration saved" onReboot={() => { const p = getSelectedProtocol(); if (p) p.reboot(); }} />
          )}
          </>
          )}

          {/* PX4-Only Calibrations */}
          {cal.isPx4 && (
            <PX4CalibrationsSection
              px4QuickLevel={cal.px4QuickLevel}
              px4GnssMagCal={cal.px4GnssMagCal}
              startPx4QuickLevel={cal.startPx4QuickLevel}
              startPx4GnssMagCal={cal.startPx4GnssMagCal}
              cancelCalibration={cal.cancelCalibration}
              setPx4QuickLevel={() => {}}
            />
          )}

          {/* Calibration Before/After Comparison */}
          {cal.calDiff && cal.calDiff.length > 0 && cal.calDiffType && (
            <CalibrationDiffTable
              calDiff={cal.calDiff}
              calDiffType={cal.calDiffType}
              onDismiss={() => { cal.setCalDiff(null); cal.setCalDiffType(null); }}
            />
          )}

          <div className="pb-4" />
        </div>

        {/* Right: Calibration Log */}
        <CalibrationLog logEntries={cal.logEntries} onClear={() => cal.setLogEntries([])} />
      </div>
    </div>
    </ArmedLockOverlay>
  );
}
