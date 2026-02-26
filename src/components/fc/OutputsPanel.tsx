"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { SERVO_FUNCTION_GROUPS } from "@/lib/servo-functions";
import { AlertTriangle, RotateCcw, Save, Zap, HardDrive } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const OUTPUT_COUNT = 16;
const PWM_ABS_MIN = 800;
const PWM_ABS_MAX = 2200;

interface OutputRow {
  function: number;
  min: number;
  max: number;
  trim: number;
  reversed: boolean;
}

function defaultRow(): OutputRow {
  return { function: 0, min: 1000, max: 2000, trim: 1500, reversed: false };
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

  // ── Output param state ─────────────────────────────────────
  const [outputs, setOutputs] = useState<OutputRow[]>(
    () => Array.from({ length: OUTPUT_COUNT }, defaultRow),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  // ── Motor test state ───────────────────────────────────────
  const [motorTestEnabled, setMotorTestEnabled] = useState(false);
  const [testMotor, setTestMotor] = useState("1");
  const [testThrottle, setTestThrottle] = useState(5);
  const [testDuration, setTestDuration] = useState(3);
  const [motorTesting, setMotorTesting] = useState(false);

  // ── Servo test state ───────────────────────────────────────
  const [servoTestValues, setServoTestValues] = useState<number[]>(
    () => Array.from({ length: OUTPUT_COUNT }, () => 1500),
  );

  // ── Validation ─────────────────────────────────────────────
  const { pwmWarnings, conflicts } = useMemo(() => validateOutputs(outputs), [outputs]);

  // ── Fetch params from FC ───────────────────────────────────

  const fetchParams = useCallback(async () => {
    if (!protocol) return;
    setLoading(true);
    try {
      const rows: OutputRow[] = [];
      for (let i = 1; i <= OUTPUT_COUNT; i++) {
        const [fn, min, max, trim, rev] = await Promise.all([
          protocol.getParameter(`SERVO${i}_FUNCTION`),
          protocol.getParameter(`SERVO${i}_MIN`),
          protocol.getParameter(`SERVO${i}_MAX`),
          protocol.getParameter(`SERVO${i}_TRIM`),
          protocol.getParameter(`SERVO${i}_REVERSED`),
        ]);
        rows.push({
          function: fn.value,
          min: min.value,
          max: max.value,
          trim: trim.value,
          reversed: rev.value !== 0,
        });
      }
      setOutputs(rows);
      setDirty(false);
      setShowCommitButton(false);
      toast("Output parameters loaded", "success");
    } catch {
      toast("Failed to read output parameters", "error");
    } finally {
      setLoading(false);
    }
  }, [protocol, toast]);

  // ── Save params to FC ──────────────────────────────────────

  const saveParams = useCallback(async () => {
    if (!protocol) return;
    if (pwmWarnings.length > 0 || conflicts.length > 0) {
      toast("Fix warnings before saving", "warning");
      return;
    }
    setSaving(true);
    try {
      for (let i = 0; i < OUTPUT_COUNT; i++) {
        const row = outputs[i];
        const n = i + 1;
        await protocol.setParameter(`SERVO${n}_FUNCTION`, row.function);
        await protocol.setParameter(`SERVO${n}_MIN`, row.min);
        await protocol.setParameter(`SERVO${n}_MAX`, row.max);
        await protocol.setParameter(`SERVO${n}_TRIM`, row.trim);
        await protocol.setParameter(`SERVO${n}_REVERSED`, row.reversed ? 1 : 0);
      }
      setDirty(false);
      setShowCommitButton(true);
      toast("Output parameters saved to RAM", "success");
    } catch {
      toast("Failed to save output parameters", "error");
    } finally {
      setSaving(false);
    }
  }, [protocol, outputs, pwmWarnings, conflicts, toast]);

  // ── Flash commit ───────────────────────────────────────────

  const commitToFlash = useCallback(async () => {
    const proto = getSelectedProtocol();
    if (!proto) return;
    try {
      await proto.commitParamsToFlash();
      setShowCommitButton(false);
      toast("Parameters written to flash", "success");
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [getSelectedProtocol, toast]);

  // ── Row updater ────────────────────────────────────────────

  const updateRow = useCallback((idx: number, partial: Partial<OutputRow>) => {
    setOutputs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
    setDirty(true);
  }, []);

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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">Servo / Motor Outputs</h2>
            {dirty && (
              <span className="text-[10px] font-mono text-status-warning px-1.5 py-0.5 bg-status-warning/10 border border-status-warning/20">
                UNSAVED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<RotateCcw size={12} />}
              loading={loading}
              onClick={fetchParams}
            >
              Read
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save size={12} />}
              loading={saving}
              disabled={!dirty}
              onClick={saveParams}
            >
              Save
            </Button>
            {showCommitButton && (
              <Button
                variant="secondary"
                size="sm"
                icon={<HardDrive size={12} />}
                onClick={commitToFlash}
              >
                Write to Flash
              </Button>
            )}
          </div>
        </div>

        {/* ── Warnings ─────────────────────────────────────── */}

        {conflicts.length > 0 && (
          <div className="p-2 bg-status-error/10 border border-status-error/20 space-y-1">
            <div className="flex items-center gap-1.5">
              <AlertTriangle size={12} className="text-status-error shrink-0" />
              <span className="text-[10px] font-medium text-status-error">Function Conflicts</span>
            </div>
            {conflicts.map((c, i) => (
              <p key={i} className="text-[10px] text-status-error pl-5">{c}</p>
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
                </tr>
              </thead>
              <tbody>
                {outputs.map((row, i) => {
                  const hasConflict = row.function > 0 && outputs.some(
                    (other, j) => j !== i && other.function === row.function
                  );
                  return (
                    <tr
                      key={i}
                      className={`border-b border-border-default last:border-0 hover:bg-bg-tertiary/50 ${
                        hasConflict ? "bg-status-error/5" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5 font-mono text-text-secondary">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <select
                          value={String(row.function)}
                          onChange={(e) => updateRow(i, { function: Number(e.target.value) })}
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
                          onChange={(e) => updateRow(i, { min: Number(e.target.value) })}
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
                          onChange={(e) => updateRow(i, { max: Number(e.target.value) })}
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
                          onChange={(e) => updateRow(i, { trim: Number(e.target.value) })}
                          className={`w-16 h-7 px-1.5 bg-bg-tertiary border text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary ${
                            row.trim < row.min || row.trim > row.max
                              ? "border-status-warning"
                              : "border-border-default"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => updateRow(i, { reversed: !row.reversed })}
                          className={`w-7 h-7 border text-[10px] font-mono transition-colors ${
                            row.reversed
                              ? "bg-accent-primary border-accent-primary text-white"
                              : "bg-bg-tertiary border-border-default text-text-tertiary"
                          }`}
                        >
                          {row.reversed ? "R" : "—"}
                        </button>
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
          <div className="space-y-2">
            <p className="text-[10px] text-text-tertiary mb-2">
              Drag slider to send test PWM value to each output.
            </p>
            {outputs.map((_, i) => (
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
        </Card>
      </div>
    </div>
  );
}
