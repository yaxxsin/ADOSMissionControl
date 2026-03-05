"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { SERVO_FUNCTION_GROUPS } from "@/lib/servo-functions";
import {
  detectBoardProfile,
  detectTimerGroupConflicts,
  UNKNOWN_BOARD,
  type BoardProfile,
  type TimerGroupConflict,
} from "@/lib/board-profiles";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { PanelHeader } from "./PanelHeader";
import { OutputTimerGroupConfig, type PwmWarning } from "./OutputTimerGroupConfig";
import { ServoMappingTable, type OutputRow } from "./ServoMappingTable";
import { Save, Zap, HardDrive, AlertTriangle, Info } from "lucide-react";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";

// ── Constants ────────────────────────────────────────────────

const OUTPUT_COUNT = 16;
const PWM_ABS_MIN = 800;
const PWM_ABS_MAX = 2200;

// Build param name list: 16 outputs * 5 props = 80 params
const OUTPUT_PARAMS: string[] = [
  ...Array.from({ length: OUTPUT_COUNT }, (_, i) => {
    const n = i + 1;
    return [
      `SERVO${n}_FUNCTION`, `SERVO${n}_MIN`, `SERVO${n}_MAX`,
      `SERVO${n}_TRIM`, `SERVO${n}_REVERSED`,
    ];
  }).flat(),
];

const OPTIONAL_OUTPUT_PARAMS = ['MOT_PWM_TYPE'];

// ── Validation helpers ───────────────────────────────────────

function validateOutputs(rows: OutputRow[]): { pwmWarnings: PwmWarning[]; conflicts: string[] } {
  const pwmWarnings: PwmWarning[] = [];
  const conflicts: string[] = [];

  const fnAssignments = new Map<number, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const n = i + 1;

    if (row.function === -1) continue;

    if (row.min < PWM_ABS_MIN || row.min > PWM_ABS_MAX) {
      pwmWarnings.push({ output: n, message: `Min (${row.min}) outside ${PWM_ABS_MIN}-${PWM_ABS_MAX}` });
    }
    if (row.max < PWM_ABS_MIN || row.max > PWM_ABS_MAX) {
      pwmWarnings.push({ output: n, message: `Max (${row.max}) outside ${PWM_ABS_MIN}-${PWM_ABS_MAX}` });
    }
    if (row.min >= row.max) {
      pwmWarnings.push({ output: n, message: `Min (${row.min}) >= Max (${row.max})` });
    }
    if (row.trim < row.min || row.trim > row.max) {
      pwmWarnings.push({ output: n, message: `Trim (${row.trim}) outside Min/Max range` });
    }

    if (row.function > 0) {
      const existing = fnAssignments.get(row.function) ?? [];
      existing.push(n);
      fnAssignments.set(row.function, existing);
    }
  }

  for (const [fnId, outputs] of fnAssignments) {
    if (outputs.length > 1) {
      const fnLabel = SERVO_FUNCTION_GROUPS
        .flatMap((g) => g.functions)
        .find((f) => f.value === fnId)?.label ?? `ID ${fnId}`;
      conflicts.push(`"${fnLabel}" assigned to outputs ${outputs.join(", ")}`);
    }
  }

  return { pwmWarnings, conflicts };
}

// ── Component ────────────────────────────────────────────────

export function OutputsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();
  const { toast } = useToast();
  const { isLocked, lockMessage } = useArmedLock();
  const { firmwareType } = useFirmwareCapabilities();
  const isPx4 = firmwareType === 'px4';
  const [saving, setSaving] = useState(false);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: OUTPUT_PARAMS, optionalParams: OPTIONAL_OUTPUT_PARAMS, panelId: "outputs", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  // ── GPIO detection (SERVOx_FUNCTION = -1 means GPIO) ────
  const gpioOutputs = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < OUTPUT_COUNT; i++) {
      if ((params.get(`SERVO${i + 1}_FUNCTION`) ?? 0) === -1) set.add(i + 1);
    }
    return set;
  }, [params]);

  // ── Live servo output from telemetry ────────────────────
  const servoBuffer = useTelemetryStore((s) => s.servoOutput);
  const latestServo = servoBuffer.latest();
  const liveServos = latestServo?.servos ?? [];

  // ── Motor test state ───────────────────────────────────────
  const [motorTestEnabled, setMotorTestEnabled] = useState(false);
  const [testMotor, setTestMotor] = useState("1");
  const [testThrottle, setTestThrottle] = useState(5);
  const [testDuration, setTestDuration] = useState(3);
  const [motorTesting, setMotorTesting] = useState(false);

  // ── Servo test state ───────────────────────────────────────
  const [servoTestEnabled, setServoTestEnabled] = useState(false);
  const [servoTestValues, setServoTestValues] = useState<number[]>(
    () => Array.from({ length: OUTPUT_COUNT }, () => 1500),
  );

  // ── Force-disable test modes when vehicle arms ─────────────
  useEffect(() => {
    if (isLocked) {
      setMotorTestEnabled(false);
      setServoTestEnabled(false);
    }
  }, [isLocked]);

  // ── Derive output rows from flat params Map ────────────────

  const getOutput = useCallback((i: number): OutputRow => ({
    function: params.get(`SERVO${i + 1}_FUNCTION`) ?? 0,
    min: params.get(`SERVO${i + 1}_MIN`) ?? 1000,
    max: params.get(`SERVO${i + 1}_MAX`) ?? 2000,
    trim: params.get(`SERVO${i + 1}_TRIM`) ?? 1500,
    reversed: (params.get(`SERVO${i + 1}_REVERSED`) ?? 0) !== 0,
  }), [params]);

  const outputs = useMemo(
    () => Array.from({ length: OUTPUT_COUNT }, (_, i) => getOutput(i)),
    [getOutput],
  );

  // ── Validation ─────────────────────────────────────────────
  const { pwmWarnings, conflicts } = useMemo(() => validateOutputs(outputs), [outputs]);

  // ── Timer Group / Board Profile ─────────────────────────────
  const motPwmType = params.get('MOT_PWM_TYPE') ?? 0;

  const [boardVersion, setBoardVersion] = useState(0);
  const [manualBoardOverride, setManualBoardOverride] = useState<BoardProfile | null>(null);
  useEffect(() => {
    if (!protocol?.onAutopilotVersion) return;
    const unsub = protocol.onAutopilotVersion((data) => {
      setBoardVersion(data.boardVersion);
    });
    protocol.requestMessage?.(148).catch(() => {});
    return unsub;
  }, [protocol]);

  const autoDetectedProfile: BoardProfile = useMemo(
    () => detectBoardProfile(boardVersion),
    [boardVersion],
  );

  const boardProfile: BoardProfile = (autoDetectedProfile !== UNKNOWN_BOARD)
    ? autoDetectedProfile
    : (manualBoardOverride ?? UNKNOWN_BOARD);

  const functionMap = useMemo(() => {
    const map = new Map<number, number>();
    for (let i = 0; i < OUTPUT_COUNT; i++) {
      map.set(i + 1, params.get(`SERVO${i + 1}_FUNCTION`) ?? 0);
    }
    return map;
  }, [params]);

  const timerConflicts: TimerGroupConflict[] = useMemo(
    () => detectTimerGroupConflicts(boardProfile, functionMap, motPwmType),
    [boardProfile, functionMap, motPwmType],
  );

  const conflictDisabledOutputs = useMemo(() => {
    const set = new Set<number>();
    for (const c of timerConflicts) {
      for (const o of c.disabledOutputs) set.add(o);
    }
    return set;
  }, [timerConflicts]);

  const hasDirty = dirtyParams.size > 0;

  // ── Save / Flash ───────────────────────────────────────────

  async function handleSave() {
    if (pwmWarnings.length > 0) {
      toast("Fix PWM warnings before saving", "warning");
      return;
    }
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Output parameters saved to RAM", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Parameters written to flash", "success");
    else toast("Failed to write to flash", "error");
  }

  // ── Motor test ─────────────────────────────────────────────

  const runMotorTest = useCallback(async () => {
    if (!protocol || !motorTestEnabled) return;
    setMotorTesting(true);
    try {
      await protocol.motorTest(
        Number(testMotor),
        testThrottle,
        testDuration,
      );
      toast(`Motor ${testMotor} test complete`, "info");
    } catch {
      toast("Motor test failed", "error");
    } finally {
      setMotorTesting(false);
    }
  }, [protocol, motorTestEnabled, testMotor, testThrottle, testDuration, toast]);

  const motorOptions = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({
      value: String(i + 1),
      label: `Motor ${i + 1}`,
    })),
    [],
  );

  if (!protocol) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-4xl space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Servo / Motor Outputs</h2>
          <Card>
            <p className="text-xs text-text-tertiary">Connect to a drone to configure outputs.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl space-y-4">
        <PanelHeader
          title="Servo / Motor Outputs"
          subtitle="Output function assignment, PWM limits, and motor test"
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={!!protocol}
          error={error}
        >
          {hasDirty && (
            <span className="text-[10px] font-mono text-status-warning px-1.5 py-0.5 bg-status-warning/10 border border-status-warning/20">
              UNSAVED
            </span>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<Save size={12} />}
            loading={saving}
            disabled={!hasDirty}
            onClick={handleSave}
          >
            Save
          </Button>
          {hasRamWrites && (
            <Button
              variant="secondary"
              size="sm"
              icon={<HardDrive size={12} />}
              onClick={handleFlash}
            >
              Write to Flash
            </Button>
          )}
        </PanelHeader>

        {isPx4 && (
          <div className="flex items-center gap-2 px-3 py-2 mb-4 bg-accent-primary/10 rounded-md text-xs text-text-secondary">
            <Info size={14} className="text-accent-primary shrink-0" />
            <span>PX4 uses Control Allocation for motor/servo mapping. Full Actuator panel available in a future update.</span>
          </div>
        )}

        <OutputTimerGroupConfig
          hasLoaded={hasLoaded}
          boardProfile={boardProfile}
          functionMap={functionMap}
          motPwmType={motPwmType}
          timerConflicts={timerConflicts}
          conflicts={conflicts}
          pwmWarnings={pwmWarnings}
          gpioOutputs={gpioOutputs}
          onBoardOverride={setManualBoardOverride}
        />

        <ServoMappingTable
          outputs={outputs}
          gpioOutputs={gpioOutputs}
          conflictDisabledOutputs={conflictDisabledOutputs}
          boardProfile={boardProfile}
          liveServos={liveServos}
          setLocalValue={setLocalValue}
        />

        {/* ── Motor Test ────────────────────────────────────── */}

        <Card title="Motor Test">
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-2 bg-status-error/10 border border-status-error/20">
              <AlertTriangle size={14} className="text-status-error shrink-0" />
              <span className="text-[10px] text-status-error">
                Remove propellers before testing motors. Ensure drone is secured.
              </span>
            </div>

            <Toggle
              label="Enable motor test (safety master)"
              checked={motorTestEnabled}
              onChange={setMotorTestEnabled}
              disabled={isLocked}
            />

            {isLocked && (
              <div className="flex items-center gap-2 p-2 bg-status-error/10 border border-status-error/20">
                <AlertTriangle size={14} className="text-status-error shrink-0" />
                <span className="text-[10px] text-status-error">{lockMessage}</span>
              </div>
            )}

            {motorTestEnabled && (
              <div className="space-y-3">
                <Select
                  label="Motor"
                  options={motorOptions}
                  value={testMotor}
                  onChange={setTestMotor}
                />

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary">
                    Throttle: {testThrottle}%
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={testThrottle}
                    onChange={(e) => setTestThrottle(Number(e.target.value))}
                    className="w-full accent-accent-primary"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary">
                    Duration: {testDuration}s
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={testDuration}
                    onChange={(e) => setTestDuration(Number(e.target.value))}
                    className="w-full accent-accent-primary"
                  />
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  icon={<Zap size={12} />}
                  loading={motorTesting}
                  onClick={runMotorTest}
                >
                  Test Motor {testMotor}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* ── Servo Test ────────────────────────────────────── */}

        <Card title="Servo Test">
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-2 bg-status-warning/10 border border-status-warning/20">
              <AlertTriangle size={14} className="text-status-warning shrink-0" />
              <span className="text-[10px] text-status-warning">
                Servo test sends live PWM commands. Ensure servos are safe to move.
              </span>
            </div>

            <Toggle
              label="Enable servo test (safety master)"
              checked={servoTestEnabled}
              onChange={setServoTestEnabled}
              disabled={isLocked}
            />

            {isLocked && (
              <div className="flex items-center gap-2 p-2 bg-status-error/10 border border-status-error/20">
                <AlertTriangle size={14} className="text-status-error shrink-0" />
                <span className="text-[10px] text-status-error">{lockMessage}</span>
              </div>
            )}

            {servoTestEnabled && (
              <div className="space-y-2">
                {outputs.filter((_, i) => !gpioOutputs.has(i + 1)).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-text-secondary w-5 text-right">
                      {i + 1}
                    </span>
                    <input
                      type="range"
                      min={1000}
                      max={2000}
                      value={servoTestValues[i]}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setServoTestValues((prev) => {
                          const next = [...prev];
                          next[i] = val;
                          return next;
                        });
                        if (protocol) {
                          protocol.setServo(i + 1, val);
                        }
                      }}
                      className="flex-1 accent-accent-primary"
                    />
                    <span className="text-[10px] font-mono text-text-primary tabular-nums w-10 text-right">
                      {servoTestValues[i]}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary">µs</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
