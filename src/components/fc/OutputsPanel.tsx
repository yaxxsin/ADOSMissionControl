"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { SERVO_FUNCTION_GROUPS } from "@/lib/servo-functions";
import { usePanelParams } from "@/hooks/use-panel-params";
import { PanelHeader } from "./PanelHeader";
import { Save, Zap, HardDrive, Info, AlertTriangle } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const OUTPUT_COUNT = 16;
const PWM_ABS_MIN = 800;
const PWM_ABS_MAX = 2200;

// Build param name list: 16 outputs * 5 props = 80 params
// BRD_PWM_COUNT removed — deprecated in ArduPilot 4.2+
// GPIO detection now uses SERVOx_FUNCTION = -1
const OUTPUT_PARAMS: string[] = [
  ...Array.from({ length: OUTPUT_COUNT }, (_, i) => {
    const n = i + 1;
    return [
      `SERVO${n}_FUNCTION`, `SERVO${n}_MIN`, `SERVO${n}_MAX`,
      `SERVO${n}_TRIM`, `SERVO${n}_REVERSED`,
    ];
  }).flat(),
];

interface OutputRow {
  function: number;
  min: number;
  max: number;
  trim: number;
  reversed: boolean;
}

// ── Validation helpers ───────────────────────────────────────

interface PwmWarning {
  output: number;
  message: string;
}

function validateOutputs(rows: OutputRow[]): { pwmWarnings: PwmWarning[]; conflicts: string[] } {
  const pwmWarnings: PwmWarning[] = [];
  const conflicts: string[] = [];

  // Track function assignments for conflict detection
  const fnAssignments = new Map<number, number[]>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const n = i + 1;

    // Skip validation for GPIO outputs (function = -1)
    if (row.function === -1) continue;

    // PWM range validation
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

    // Conflict detection — skip disabled (0) and GPIO (-1)
    if (row.function > 0) {
      const existing = fnAssignments.get(row.function) ?? [];
      existing.push(n);
      fnAssignments.set(row.function, existing);
    }
  }

  // Build conflict messages
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
  const [saving, setSaving] = useState(false);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: OUTPUT_PARAMS, panelId: "outputs" });

  // ── GPIO detection (SERVOx_FUNCTION = -1 means GPIO) ────
  const gpioOutputs = useMemo(() => {
    const set = new Set<number>();
    for (let i = 0; i < OUTPUT_COUNT; i++) {
      if ((params.get(`SERVO${i + 1}_FUNCTION`) ?? 0) === -1) set.add(i + 1);
    }
    return set;
  }, [params]);
  const activeOutputCount = OUTPUT_COUNT - gpioOutputs.size;

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

  // ── Motor options ──────────────────────────────────────────

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

        {/* ── Warnings ─────────────────────────────────────── */}

        {conflicts.length > 0 && (
          <div className="p-2 bg-accent-primary/10 border border-accent-primary/20 space-y-1">
            <div className="flex items-center gap-1.5">
              <Info size={12} className="text-accent-primary shrink-0" />
              <span className="text-[10px] font-medium text-accent-primary">Duplicate Functions</span>
            </div>
            {conflicts.map((c, i) => (
              <p key={i} className="text-[10px] text-accent-primary pl-5">{c}</p>
            ))}
          </div>
        )}

        {pwmWarnings.length > 0 && (
          <div className="p-2 bg-status-warning/10 border border-status-warning/20 space-y-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-status-warning shrink-0" />
              <span className="text-[10px] font-medium text-status-warning">PWM Warnings</span>
            </div>
            {pwmWarnings.map((w, i) => (
              <p key={i} className="text-[10px] text-status-warning pl-5">Output {w.output}: {w.message}</p>
            ))}
          </div>
        )}

        {/* ── GPIO Info Banner ──────────────────────────────── */}

        {hasLoaded && gpioOutputs.size > 0 && (
          <div className="flex items-center gap-2 p-2 bg-accent-primary/10 border border-accent-primary/20">
            <Info size={12} className="text-accent-primary shrink-0" />
            <span className="text-[10px] text-text-secondary">
              {gpioOutputs.size} output{gpioOutputs.size > 1 ? "s" : ""} configured as GPIO
              (SERVO{[...gpioOutputs].join(", SERVO")}_FUNCTION = -1).
            </span>
          </div>
        )}

        {/* ── Output Table ──────────────────────────────────── */}

        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default text-text-secondary">
                  <th className="px-3 py-2 text-left font-medium">#</th>
                  <th className="px-3 py-2 text-left font-medium">Function</th>
                  <th className="px-3 py-2 text-left font-medium">Min</th>
                  <th className="px-3 py-2 text-left font-medium">Max</th>
                  <th className="px-3 py-2 text-left font-medium">Trim</th>
                  <th className="px-3 py-2 text-left font-medium">Rev</th>
                  <th className="px-3 py-2 text-left font-medium">Current</th>
                </tr>
              </thead>
              <tbody>
                {outputs.map((row, i) => {
                  const hasConflict = row.function > 0 && outputs.some(
                    (other, j) => j !== i && other.function === row.function
                  );
                  const n = i + 1;
                  const isGpio = gpioOutputs.has(n);
                  const livePwm = liveServos[i];
                  const hasLivePwm = livePwm !== undefined && livePwm > 0;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border-default last:border-0 hover:bg-bg-tertiary/50 ${
                        hasConflict ? "bg-status-error/5" : ""
                      } ${isGpio ? "opacity-40" : ""}`}
                    >
                      <td className="px-3 py-1.5 font-mono text-text-secondary">
                        <span className="flex items-center gap-1">
                          {n}
                          {isGpio && (
                            <span className="text-[8px] font-sans text-text-tertiary bg-bg-tertiary px-1 py-px">
                              GPIO
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={String(row.function)}
                          onChange={(e) => setLocalValue(`SERVO${n}_FUNCTION`, Number(e.target.value))}
                          className={`w-full h-7 px-1.5 bg-bg-tertiary border text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary ${
                            hasConflict ? "border-status-error" : "border-border-default"
                          }`}
                        >
                          {SERVO_FUNCTION_GROUPS.map((group) => (
                            <optgroup key={group.label} label={group.label}>
                              {group.functions.map((fn) => (
                                <option key={fn.value} value={String(fn.value)}>
                                  {fn.value} — {fn.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={row.min}
                          onChange={(e) => setLocalValue(`SERVO${n}_MIN`, Number(e.target.value))}
                          className={`w-16 h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary ${
                            row.min < PWM_ABS_MIN || row.min > PWM_ABS_MAX || row.min >= row.max
                              ? "border-status-warning"
                              : "border-border-default"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={row.max}
                          onChange={(e) => setLocalValue(`SERVO${n}_MAX`, Number(e.target.value))}
                          className={`w-16 h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary ${
                            row.max < PWM_ABS_MIN || row.max > PWM_ABS_MAX || row.min >= row.max
                              ? "border-status-warning"
                              : "border-border-default"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="number"
                          value={row.trim}
                          onChange={(e) => setLocalValue(`SERVO${n}_TRIM`, Number(e.target.value))}
                          className={`w-16 h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary ${
                            row.trim < row.min || row.trim > row.max
                              ? "border-status-warning"
                              : "border-border-default"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => setLocalValue(`SERVO${n}_REVERSED`, row.reversed ? 0 : 1)}
                          className={`w-7 h-7 border text-[10px] font-mono transition-colors ${
                            row.reversed
                              ? "bg-accent-primary border-accent-primary text-white"
                              : "bg-bg-tertiary border-border-default text-text-tertiary"
                          }`}
                        >
                          {row.reversed ? "R" : "—"}
                        </button>
                      </td>
                      <td className="px-3 py-1.5">
                        {hasLivePwm ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-3 bg-bg-tertiary border border-border-default relative overflow-hidden">
                              <div
                                className="h-full bg-status-success/60"
                                style={{ width: `${Math.max(0, Math.min(100, ((livePwm - 1000) / 1000) * 100))}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-mono text-text-primary tabular-nums w-10 text-right">
                              {livePwm}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-text-tertiary">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

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
            />

            {motorTestEnabled && (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-text-secondary">Motor</label>
                  <select
                    value={testMotor}
                    onChange={(e) => setTestMotor(e.target.value)}
                    className="h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary"
                  >
                    {motorOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

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
            />

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
