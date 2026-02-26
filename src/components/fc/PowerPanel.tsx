"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { Battery, Zap, Save, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParamState {
  value: string;
  dirty: boolean;
}

type PowerParams = Record<string, ParamState>;

const DEFAULT_PARAMS: PowerParams = {
  BATT_CAPACITY: { value: "0", dirty: false },
  BATT_AMP_PERVLT: { value: "17.0", dirty: false },
  BATT_AMP_OFFSET: { value: "0.0", dirty: false },
};

function cellVoltageColor(v: number): string {
  if (v >= 3.7) return "text-status-success";
  if (v >= 3.5) return "text-status-warning";
  return "text-status-error";
}

function cellVoltageBg(v: number): string {
  if (v >= 3.7) return "bg-status-success";
  if (v >= 3.5) return "bg-status-warning";
  return "bg-status-error";
}

export function PowerPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const batteryBuffer = useTelemetryStore((s) => s.battery);
  const [params, setParams] = useState<PowerParams>(DEFAULT_PARAMS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  const latestBattery = batteryBuffer.latest();
  const voltage = latestBattery?.voltage ?? 0;
  const current = latestBattery?.current ?? 0;
  const remaining = latestBattery?.remaining ?? 0;
  const consumed = latestBattery?.consumed ?? 0;

  const cellCount = useMemo(() => {
    if (voltage <= 0) return 0;
    return Math.round(voltage / 4.2);
  }, [voltage]);

  const perCellVoltage = useMemo(() => {
    if (cellCount <= 0) return 0;
    return voltage / cellCount;
  }, [voltage, cellCount]);

  const updateParam = useCallback((name: string, value: string) => {
    setParams((prev) => ({
      ...prev,
      [name]: { value, dirty: true },
    }));
  }, []);

  const loadParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    const updated = { ...params };
    for (const name of Object.keys(DEFAULT_PARAMS)) {
      try {
        const pv = await protocol.getParameter(name);
        updated[name] = { value: String(pv.value), dirty: false };
      } catch {
        // not available
      }
    }
    setParams(updated);
    setLoaded(true);
  }, [getSelectedProtocol, params]);

  const saveParams = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    setSaving(true);
    for (const [name, p] of Object.entries(params)) {
      if (!p.dirty) continue;
      try {
        await protocol.setParameter(name, parseFloat(p.value));
        setParams((prev) => ({ ...prev, [name]: { ...prev[name], dirty: false } }));
      } catch {
        // write failed
      }
    }
    setShowCommitButton(true);
    setSaving(false);
  }, [getSelectedProtocol, params]);

  const commitToFlash = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    await protocol.commitParamsToFlash();
    setShowCommitButton(false);
  }, [getSelectedProtocol]);

  const hasDirty = Object.values(params).some((p) => p.dirty);
  const connected = !!getSelectedProtocol();

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Power / Battery</h1>
            <p className="text-xs text-text-tertiary mt-0.5">Battery capacity, current sensor calibration, live cell monitoring</p>
          </div>
          {connected && !loaded && (
            <Button variant="secondary" size="sm" onClick={loadParams}>
              Load from FC
            </Button>
          )}
        </div>

        {/* Live Battery Status */}
        <div className="border border-border-default bg-bg-secondary p-4">
          <div className="flex items-center gap-2 mb-3">
            <Battery size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Live Battery</h2>
            {voltage > 0 && (
              <span className="text-[10px] font-mono text-text-tertiary ml-auto">
                {cellCount}S detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <LiveStat label="Voltage" value={voltage.toFixed(2)} unit="V" />
            <LiveStat label="Current" value={current.toFixed(1)} unit="A" />
            <LiveStat label="Remaining" value={`${Math.round(remaining)}`} unit="%" />
            <LiveStat label="Consumed" value={Math.round(consumed).toString()} unit="mAh" />
          </div>

          {/* Per-cell voltage */}
          {cellCount > 0 && (
            <div>
              <span className="text-[10px] text-text-tertiary mb-1.5 block">Cell Voltage Estimate</span>
              <div className="flex gap-1.5">
                {Array.from({ length: cellCount }, (_, i) => (
                  <div key={i} className="flex-1">
                    <div className="h-8 bg-bg-tertiary relative overflow-hidden">
                      <div
                        className={cn("absolute bottom-0 left-0 right-0 transition-all", cellVoltageBg(perCellVoltage))}
                        style={{ height: `${Math.min(100, Math.max(0, ((perCellVoltage - 3.0) / 1.2) * 100))}%`, opacity: 0.3 }}
                      />
                      <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-mono", cellVoltageColor(perCellVoltage))}>
                        {perCellVoltage.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-tertiary block text-center mt-0.5">C{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {voltage === 0 && (
            <p className="text-[10px] text-text-tertiary">No battery data — connect a drone to view live telemetry</p>
          )}
        </div>

        {/* Battery Settings */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Battery size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Battery Settings</h2>
          </div>
          <Input
            label="BATT_CAPACITY — Battery Capacity"
            type="number"
            step="100"
            min="0"
            unit="mAh"
            value={params.BATT_CAPACITY.value}
            onChange={(e) => updateParam("BATT_CAPACITY", e.target.value)}
          />
        </div>

        {/* Current Sensor Calibration */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Current Sensor Calibration</h2>
          </div>
          <Input
            label="BATT_AMP_PERVLT — Amps Per Volt"
            type="number"
            step="0.1"
            unit="A/V"
            value={params.BATT_AMP_PERVLT.value}
            onChange={(e) => updateParam("BATT_AMP_PERVLT", e.target.value)}
          />
          <Input
            label="BATT_AMP_OFFSET — Current Offset"
            type="number"
            step="0.01"
            unit="A"
            value={params.BATT_AMP_OFFSET.value}
            onChange={(e) => updateParam("BATT_AMP_OFFSET", e.target.value)}
          />
        </div>

        {/* Save */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={saveParams}
          >
            Save to Flight Controller
          </Button>
          {showCommitButton && (
            <Button
              variant="secondary"
              size="lg"
              icon={<HardDrive size={14} />}
              onClick={commitToFlash}
            >
              Write to Flash
            </Button>
          )}
          {!connected && (
            <span className="text-[10px] text-text-tertiary">Connect a drone to save parameters</span>
          )}
          {hasDirty && connected && (
            <span className="text-[10px] text-status-warning">Unsaved changes</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <span className="text-[10px] text-text-tertiary block">{label}</span>
      <span className="text-sm font-mono text-text-primary">
        {value}
        <span className="text-[10px] text-text-tertiary ml-0.5">{unit}</span>
      </span>
    </div>
  );
}
