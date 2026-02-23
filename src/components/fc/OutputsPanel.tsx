"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useDroneManager } from "@/stores/drone-manager";
import { AlertTriangle, RotateCcw, Save, Zap } from "lucide-react";

// ── Servo function IDs (ArduPilot) ─────────────────────────

const SERVO_FUNCTIONS: { value: string; label: string }[] = [
  { value: "0", label: "0 — Disabled" },
  { value: "4", label: "4 — Aileron" },
  { value: "19", label: "19 — Elevator" },
  { value: "21", label: "21 — Rudder" },
  { value: "33", label: "33 — Motor 1" },
  { value: "34", label: "34 — Motor 2" },
  { value: "35", label: "35 — Motor 3" },
  { value: "36", label: "36 — Motor 4" },
  { value: "37", label: "37 — Motor 5" },
  { value: "38", label: "38 — Motor 6" },
  { value: "39", label: "39 — Motor 7" },
  { value: "40", label: "40 — Motor 8" },
  { value: "51", label: "51 — RCIN1" },
  { value: "52", label: "52 — RCIN2" },
  { value: "53", label: "53 — RCIN3" },
  { value: "54", label: "54 — RCIN4" },
  { value: "70", label: "70 — Throttle" },
  { value: "73", label: "73 — ThrottleLeft" },
  { value: "74", label: "74 — ThrottleRight" },
  { value: "94", label: "94 — Script1" },
];

const OUTPUT_COUNT = 16;

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

export function OutputsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();

  // ── Output param state ─────────────────────────────────────
  const [outputs, setOutputs] = useState<OutputRow[]>(
    () => Array.from({ length: OUTPUT_COUNT }, defaultRow),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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
    } catch {
      // params may not all exist — keep defaults
    } finally {
      setLoading(false);
    }
  }, [protocol]);

  // ── Save params to FC ──────────────────────────────────────

  const saveParams = useCallback(async () => {
    if (!protocol) return;
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
    } finally {
      setSaving(false);
    }
  }, [protocol, outputs]);

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
    } finally {
      setMotorTesting(false);
    }
  }, [protocol, motorTestEnabled, testMotor, testThrottle, testDuration]);

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
          <h2 className="text-sm font-semibold text-text-primary">Servo / Motor Outputs</h2>
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
          </div>
        </div>

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
                {outputs.map((row, i) => (
                  <tr key={i} className="border-b border-border-default last:border-0 hover:bg-bg-tertiary/50">
                    <td className="px-3 py-1.5 font-mono text-text-secondary">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <select
                        value={String(row.function)}
                        onChange={(e) => updateRow(i, { function: Number(e.target.value) })}
                        className="w-full h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs text-text-primary appearance-none focus:outline-none focus:border-accent-primary"
                      >
                        {SERVO_FUNCTIONS.map((fn) => (
                          <option key={fn.value} value={fn.value}>{fn.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={row.min}
                        onChange={(e) => updateRow(i, { min: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={row.max}
                        onChange={(e) => updateRow(i, { max: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={row.trim}
                        onChange={(e) => updateRow(i, { trim: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
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
                ))}
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
                <Select
                  label="Motor"
                  value={testMotor}
                  onChange={setTestMotor}
                  options={motorOptions}
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
