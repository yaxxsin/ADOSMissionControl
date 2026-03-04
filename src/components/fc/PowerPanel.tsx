"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useParamLabel } from "@/hooks/use-param-label";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { Battery, Zap, ShieldAlert, Save, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

const BATT_MONITOR_OPTIONS = [
  { value: "0", label: "0 — Disabled" },
  { value: "3", label: "3 — Analog Voltage Only" },
  { value: "4", label: "4 — Analog Voltage and Current" },
  { value: "5", label: "5 — Solo" },
  { value: "7", label: "7 — SMBus" },
  { value: "8", label: "8 — DroneCAN" },
  { value: "9", label: "9 — ESC" },
  { value: "10", label: "10 — Sum of Selected" },
  { value: "16", label: "16 — Analog VCC" },
];

const BATT_FS_ACTION_OPTIONS = [
  { value: "0", label: "0 — None" },
  { value: "1", label: "1 — Land" },
  { value: "2", label: "2 — RTL" },
  { value: "3", label: "3 — SmartRTL or RTL" },
  { value: "4", label: "4 — SmartRTL or Land" },
  { value: "5", label: "5 — Terminate" },
];

const POWER_PARAMS = [
  "BATT_MONITOR", "BATT_CAPACITY", "BATT_AMP_PERVLT", "BATT_AMP_OFFSET",
  "BATT_FS_LOW_VOLT", "BATT_FS_LOW_ACT", "BATT_FS_CRT_VOLT", "BATT_FS_CRT_ACT",
  "BATT_FS_LOW_MAH", "BATT_FS_CRT_MAH",
];

const OPTIONAL_POWER_PARAMS = [
  "BATT2_MONITOR", "BATT2_CAPACITY", "BATT2_AMP_PERVLT", "BATT2_AMP_OFFSET",
  "BATT2_FS_LOW_VOLT", "BATT2_FS_LOW_ACT", "BATT2_FS_CRT_VOLT", "BATT2_FS_CRT_ACT",
  "BATT2_FS_LOW_MAH", "BATT2_FS_CRT_MAH",
];

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
  const { toast } = useToast();
  const { label: pl } = useParamLabel();
  const batteryBuffer = useTelemetryStore((s) => s.battery);
  const [saving, setSaving] = useState(false);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: POWER_PARAMS, optionalParams: OPTIONAL_POWER_PARAMS, panelId: "power" });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

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

  /** Get param as string for Select/Input display */
  const p = (name: string, fallback = "0") => String(params.get(name) ?? fallback);
  /** Set param from string input */
  const set = (name: string, v: string) => setLocalValue(name, Number(v) || 0);

  async function handleSave() {
    setSaving(true);
    const ok = await saveAllToRam();
    setSaving(false);
    if (ok) toast("Saved to flight controller", "success");
    else toast("Some parameters failed to save", "warning");
  }

  async function handleFlash() {
    const ok = await commitToFlash();
    if (ok) toast("Written to flash — persists after reboot", "success");
    else toast("Failed to write to flash", "error");
  }

  return (
    <ArmedLockOverlay>
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        <PanelHeader
          title="Power / Battery"
          subtitle="Battery capacity, current sensor calibration, live cell monitoring"
          icon={<Battery size={16} />}
          loading={loading}
          loadProgress={loadProgress}
          hasLoaded={hasLoaded}
          onRead={refresh}
          connected={connected}
          error={error}
        />

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
          <Select
            label={pl("BATT_MONITOR — Battery Monitor Type")}
            options={BATT_MONITOR_OPTIONS}
            value={p("BATT_MONITOR")}
            onChange={(v) => set("BATT_MONITOR", v)}
          />
          <Input
            label={pl("BATT_CAPACITY — Battery Capacity")}
            type="number"
            step="100"
            min="0"
            unit="mAh"
            value={p("BATT_CAPACITY")}
            onChange={(e) => set("BATT_CAPACITY", e.target.value)}
          />
        </div>

        {/* Current Sensor Calibration */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Current Sensor Calibration</h2>
          </div>
          <Input
            label={pl("BATT_AMP_PERVLT — Amps Per Volt")}
            type="number"
            step="0.1"
            unit="A/V"
            value={p("BATT_AMP_PERVLT", "17.0")}
            onChange={(e) => set("BATT_AMP_PERVLT", e.target.value)}
          />
          <Input
            label={pl("BATT_AMP_OFFSET — Current Offset")}
            type="number"
            step="0.01"
            unit="A"
            value={p("BATT_AMP_OFFSET", "0.0")}
            onChange={(e) => set("BATT_AMP_OFFSET", e.target.value)}
          />
        </div>

        {/* Battery 1 Failsafe */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Battery 1 Failsafe</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label={pl("BATT_FS_LOW_VOLT — Low Voltage")}
              type="number"
              step="0.1"
              min="0"
              unit="V"
              value={p("BATT_FS_LOW_VOLT")}
              onChange={(e) => set("BATT_FS_LOW_VOLT", e.target.value)}
            />
            <Select
              label={pl("BATT_FS_LOW_ACT — Low Action")}
              options={BATT_FS_ACTION_OPTIONS}
              value={p("BATT_FS_LOW_ACT")}
              onChange={(v) => set("BATT_FS_LOW_ACT", v)}
            />
            <Input
              label={pl("BATT_FS_CRT_VOLT — Critical Voltage")}
              type="number"
              step="0.1"
              min="0"
              unit="V"
              value={p("BATT_FS_CRT_VOLT")}
              onChange={(e) => set("BATT_FS_CRT_VOLT", e.target.value)}
            />
            <Select
              label={pl("BATT_FS_CRT_ACT — Critical Action")}
              options={BATT_FS_ACTION_OPTIONS}
              value={p("BATT_FS_CRT_ACT")}
              onChange={(v) => set("BATT_FS_CRT_ACT", v)}
            />
            <Input
              label={pl("BATT_FS_LOW_MAH — Low mAh Remaining")}
              type="number"
              step="50"
              min="0"
              unit="mAh"
              value={p("BATT_FS_LOW_MAH")}
              onChange={(e) => set("BATT_FS_LOW_MAH", e.target.value)}
            />
            <Input
              label={pl("BATT_FS_CRT_MAH — Critical mAh Remaining")}
              type="number"
              step="50"
              min="0"
              unit="mAh"
              value={p("BATT_FS_CRT_MAH")}
              onChange={(e) => set("BATT_FS_CRT_MAH", e.target.value)}
            />
          </div>
        </div>

        {/* Battery 2 */}
        {p("BATT2_MONITOR") !== "0" && (
          <>
            <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Battery size={14} className="text-accent-primary" />
                <h2 className="text-sm font-medium text-text-primary">Battery 2 Settings</h2>
              </div>
              <Select
                label={pl("BATT2_MONITOR — Battery 2 Monitor Type")}
                options={BATT_MONITOR_OPTIONS}
                value={p("BATT2_MONITOR")}
                onChange={(v) => set("BATT2_MONITOR", v)}
              />
              <Input
                label={pl("BATT2_CAPACITY — Battery 2 Capacity")}
                type="number"
                step="100"
                min="0"
                unit="mAh"
                value={p("BATT2_CAPACITY")}
                onChange={(e) => set("BATT2_CAPACITY", e.target.value)}
              />
              <Input
                label={pl("BATT2_AMP_PERVLT — Battery 2 Amps Per Volt")}
                type="number"
                step="0.1"
                unit="A/V"
                value={p("BATT2_AMP_PERVLT", "17.0")}
                onChange={(e) => set("BATT2_AMP_PERVLT", e.target.value)}
              />
              <Input
                label={pl("BATT2_AMP_OFFSET — Battery 2 Current Offset")}
                type="number"
                step="0.01"
                unit="A"
                value={p("BATT2_AMP_OFFSET", "0.0")}
                onChange={(e) => set("BATT2_AMP_OFFSET", e.target.value)}
              />
            </div>

            {/* Battery 2 Failsafe */}
            <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <ShieldAlert size={14} className="text-accent-primary" />
                <h2 className="text-sm font-medium text-text-primary">Battery 2 Failsafe</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label={pl("BATT2_FS_LOW_VOLT — Low Voltage")}
                  type="number"
                  step="0.1"
                  min="0"
                  unit="V"
                  value={p("BATT2_FS_LOW_VOLT")}
                  onChange={(e) => set("BATT2_FS_LOW_VOLT", e.target.value)}
                />
                <Select
                  label={pl("BATT2_FS_LOW_ACT — Low Action")}
                  options={BATT_FS_ACTION_OPTIONS}
                  value={p("BATT2_FS_LOW_ACT")}
                  onChange={(v) => set("BATT2_FS_LOW_ACT", v)}
                />
                <Input
                  label={pl("BATT2_FS_CRT_VOLT — Critical Voltage")}
                  type="number"
                  step="0.1"
                  min="0"
                  unit="V"
                  value={p("BATT2_FS_CRT_VOLT")}
                  onChange={(e) => set("BATT2_FS_CRT_VOLT", e.target.value)}
                />
                <Select
                  label={pl("BATT2_FS_CRT_ACT — Critical Action")}
                  options={BATT_FS_ACTION_OPTIONS}
                  value={p("BATT2_FS_CRT_ACT")}
                  onChange={(v) => set("BATT2_FS_CRT_ACT", v)}
                />
                <Input
                  label={pl("BATT2_FS_LOW_MAH — Low mAh Remaining")}
                  type="number"
                  step="50"
                  min="0"
                  unit="mAh"
                  value={p("BATT2_FS_LOW_MAH")}
                  onChange={(e) => set("BATT2_FS_LOW_MAH", e.target.value)}
                />
                <Input
                  label={pl("BATT2_FS_CRT_MAH — Critical mAh Remaining")}
                  type="number"
                  step="50"
                  min="0"
                  unit="mAh"
                  value={p("BATT2_FS_CRT_MAH")}
                  onChange={(e) => set("BATT2_FS_CRT_MAH", e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {/* Save */}
        <div className="flex items-center gap-3 pt-2 pb-4">
          <Button
            variant="primary"
            size="lg"
            icon={<Save size={14} />}
            disabled={!hasDirty || !connected}
            loading={saving}
            onClick={handleSave}
          >
            Save to Flight Controller
          </Button>
          {hasRamWrites && (
            <Button
              variant="secondary"
              size="lg"
              icon={<HardDrive size={14} />}
              onClick={handleFlash}
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
    </ArmedLockOverlay>
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
