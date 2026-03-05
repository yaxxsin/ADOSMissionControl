"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { usePanelParams } from "@/hooks/use-panel-params";
import { useFirmwareCapabilities } from "@/hooks/use-firmware-capabilities";
import { useParamLabel } from "@/hooks/use-param-label";
import { useParamMetadataMap } from "@/hooks/use-param-metadata";
import { usePanelScroll } from "@/hooks/use-panel-scroll";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "./PanelHeader";
import { ArmedLockOverlay } from "@/components/indicators/ArmedLockOverlay";
import { Battery, Zap, ShieldAlert, Save, HardDrive, Thermometer, Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { StarredParam } from "./ParamStar";
import { ParamLabel } from "./ParamLabel";

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
  "BAT1_N_CELLS", "BAT1_R_INTERNAL",
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
  const { firmwareType } = useFirmwareCapabilities();
  const isPx4 = firmwareType === 'px4';
  const { label: pl } = useParamLabel();
  const metadata = useParamMetadataMap();
  const lbl = (raw: string) => <ParamLabel label={pl(raw)} metadata={metadata} />;
  const scrollRef = usePanelScroll("power");
  const batteryBuffer = useTelemetryStore((s) => s.battery);
  const [saving, setSaving] = useState(false);

  const {
    params, loading, error, dirtyParams, hasRamWrites,
    loadProgress, hasLoaded,
    refresh, setLocalValue, saveAllToRam, commitToFlash,
  } = usePanelParams({ paramNames: POWER_PARAMS, optionalParams: OPTIONAL_POWER_PARAMS, panelId: "power", autoLoad: true });
  useUnsavedGuard(dirtyParams.size > 0);

  const connected = !!getSelectedProtocol();
  const hasDirty = dirtyParams.size > 0;

  const latestBattery = batteryBuffer.latest();
  const voltage = latestBattery?.voltage ?? 0;
  const current = latestBattery?.current ?? 0;
  const remaining = latestBattery?.remaining ?? 0;
  const consumed = latestBattery?.consumed ?? 0;
  const temperature = latestBattery?.temperature;
  const cellVoltages = latestBattery?.cellVoltages;

  // Track connection start time for flight time estimation
  const connectTimeRef = useRef<number | null>(null);
  if (voltage > 0 && connectTimeRef.current === null) {
    connectTimeRef.current = Date.now();
  } else if (voltage === 0) {
    connectTimeRef.current = null;
  }

  const cellCount = useMemo(() => {
    if (cellVoltages && cellVoltages.length > 0) return cellVoltages.length;
    if (voltage <= 0) return 0;
    return Math.round(voltage / 4.2);
  }, [voltage, cellVoltages]);

  // Per-cell: use real cell voltages if available, otherwise estimate
  const displayCellVoltages = useMemo(() => {
    if (cellVoltages && cellVoltages.length > 0) return cellVoltages;
    if (cellCount <= 0) return [];
    const avg = voltage / cellCount;
    return Array.from({ length: cellCount }, () => avg);
  }, [voltage, cellCount, cellVoltages]);

  // Cell imbalance detection
  const cellImbalance = useMemo(() => {
    if (displayCellVoltages.length < 2) return null;
    const min = Math.min(...displayCellVoltages);
    const max = Math.max(...displayCellVoltages);
    const delta = max - min;
    if (delta < 0.05) return null;
    return { delta, severity: delta > 0.3 ? "error" as const : "warning" as const };
  }, [displayCellVoltages]);

  // Estimated flight time remaining
  const estimatedMinutes = useMemo(() => {
    if (!connectTimeRef.current || consumed <= 0 || remaining <= 0) return null;
    const elapsedMs = Date.now() - connectTimeRef.current;
    if (elapsedMs < 30_000) return null; // need 30s of data
    const ratePerMs = consumed / elapsedMs; // mAh per ms
    if (ratePerMs <= 0) return null;
    const capacity = params.get("BATT_CAPACITY") ?? 0;
    const remainingMah = capacity > 0
      ? capacity - consumed
      : (consumed / (1 - remaining / 100)) * (remaining / 100);
    if (remainingMah <= 0) return null;
    return remainingMah / ratePerMs / 60_000; // ms to minutes
  }, [consumed, remaining, params]);

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
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
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

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <LiveStat label="Voltage" value={voltage.toFixed(2)} unit="V" />
            <LiveStat label="Current" value={current.toFixed(1)} unit="A" />
            <LiveStat label="Remaining" value={`${Math.round(remaining)}`} unit="%" />
            <LiveStat label="Consumed" value={Math.round(consumed).toString()} unit="mAh" />
          </div>

          {/* Estimated flight time + temperature row */}
          {voltage > 0 && (
            <div className="flex items-center gap-4 mb-3">
              {estimatedMinutes !== null && (
                <div className="flex items-center gap-1">
                  <Clock size={10} className="text-text-tertiary" />
                  <span className={cn(
                    "text-[10px] font-mono",
                    estimatedMinutes < 3 ? "text-status-error" : estimatedMinutes < 8 ? "text-status-warning" : "text-text-secondary"
                  )}>
                    ~{Math.round(estimatedMinutes)} min remaining
                  </span>
                </div>
              )}
              {temperature !== undefined && (
                <div className="flex items-center gap-1">
                  <Thermometer size={10} className="text-text-tertiary" />
                  <span className={cn(
                    "text-[10px] font-mono",
                    temperature > 60 ? "text-status-error" : temperature > 45 ? "text-status-warning" : "text-text-secondary"
                  )}>
                    {temperature.toFixed(1)}&deg;C
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Per-cell voltage */}
          {displayCellVoltages.length > 0 && (
            <div>
              <span className="text-[10px] text-text-tertiary mb-1.5 block">
                {cellVoltages ? "Cell Voltages" : "Cell Voltage Estimate"}
              </span>
              <div className="flex gap-1.5">
                {displayCellVoltages.map((cv, i) => (
                  <div key={i} className="flex-1">
                    <div className="h-8 bg-bg-tertiary relative overflow-hidden">
                      <div
                        className={cn("absolute bottom-0 left-0 right-0 transition-all", cellVoltageBg(cv))}
                        style={{ height: `${Math.min(100, Math.max(0, ((cv - 3.0) / 1.2) * 100))}%`, opacity: 0.3 }}
                      />
                      <span className={cn("absolute inset-0 flex items-center justify-center text-[10px] font-mono", cellVoltageColor(cv))}>
                        {cv.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[9px] text-text-tertiary block text-center mt-0.5">C{i + 1}</span>
                  </div>
                ))}
              </div>
              {/* Cell imbalance warning */}
              {cellImbalance && (
                <div className={cn(
                  "flex items-center gap-1 mt-2 text-[10px]",
                  cellImbalance.severity === "error" ? "text-status-error" : "text-status-warning"
                )}>
                  <AlertTriangle size={10} />
                  <span>Cell imbalance: {"\u0394"}{Math.round(cellImbalance.delta * 1000)}mV</span>
                </div>
              )}
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
          <StarredParam param="BATT_MONITOR">
            <Select
              label={lbl("BATT_MONITOR — Battery Monitor Type")}
              options={BATT_MONITOR_OPTIONS}
              value={p("BATT_MONITOR")}
              onChange={(v) => set("BATT_MONITOR", v)}
            />
          </StarredParam>
          <StarredParam param="BATT_CAPACITY">
            <Input
              label={lbl("BATT_CAPACITY — Battery Capacity")}
              type="number"
              step="100"
              min="0"
              unit="mAh"
              value={p("BATT_CAPACITY")}
              onChange={(e) => set("BATT_CAPACITY", e.target.value)}
            />
          </StarredParam>
        </div>

        {/* Current Sensor Calibration */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Current Sensor Calibration</h2>
          </div>
          <StarredParam param="BATT_AMP_PERVLT">
            <Input
              label={lbl("BATT_AMP_PERVLT — Amps Per Volt")}
              type="number"
              step="0.1"
              unit="A/V"
              value={p("BATT_AMP_PERVLT", "17.0")}
              onChange={(e) => set("BATT_AMP_PERVLT", e.target.value)}
            />
          </StarredParam>
          <StarredParam param="BATT_AMP_OFFSET">
            <Input
              label={lbl("BATT_AMP_OFFSET — Current Offset")}
              type="number"
              step="0.01"
              unit="A"
              value={p("BATT_AMP_OFFSET", "0.0")}
              onChange={(e) => set("BATT_AMP_OFFSET", e.target.value)}
            />
          </StarredParam>
        </div>

        {/* Battery 1 Failsafe */}
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={14} className="text-accent-primary" />
            <h2 className="text-sm font-medium text-text-primary">Battery 1 Failsafe</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label={lbl("BATT_FS_LOW_VOLT — Low Voltage")}
              type="number"
              step="0.1"
              min="0"
              unit="V"
              value={p("BATT_FS_LOW_VOLT")}
              onChange={(e) => set("BATT_FS_LOW_VOLT", e.target.value)}
            />
            <Select
              label={lbl("BATT_FS_LOW_ACT — Low Action")}
              options={BATT_FS_ACTION_OPTIONS}
              value={p("BATT_FS_LOW_ACT")}
              onChange={(v) => set("BATT_FS_LOW_ACT", v)}
            />
            <Input
              label={lbl("BATT_FS_CRT_VOLT — Critical Voltage")}
              type="number"
              step="0.1"
              min="0"
              unit="V"
              value={p("BATT_FS_CRT_VOLT")}
              onChange={(e) => set("BATT_FS_CRT_VOLT", e.target.value)}
            />
            <Select
              label={lbl("BATT_FS_CRT_ACT — Critical Action")}
              options={BATT_FS_ACTION_OPTIONS}
              value={p("BATT_FS_CRT_ACT")}
              onChange={(v) => set("BATT_FS_CRT_ACT", v)}
            />
            <Input
              label={lbl("BATT_FS_LOW_MAH — Low mAh Remaining")}
              type="number"
              step="50"
              min="0"
              unit="mAh"
              value={p("BATT_FS_LOW_MAH")}
              onChange={(e) => set("BATT_FS_LOW_MAH", e.target.value)}
            />
            <Input
              label={lbl("BATT_FS_CRT_MAH — Critical mAh Remaining")}
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
                label={lbl("BATT2_MONITOR — Battery 2 Monitor Type")}
                options={BATT_MONITOR_OPTIONS}
                value={p("BATT2_MONITOR")}
                onChange={(v) => set("BATT2_MONITOR", v)}
              />
              <Input
                label={lbl("BATT2_CAPACITY — Battery 2 Capacity")}
                type="number"
                step="100"
                min="0"
                unit="mAh"
                value={p("BATT2_CAPACITY")}
                onChange={(e) => set("BATT2_CAPACITY", e.target.value)}
              />
              <Input
                label={lbl("BATT2_AMP_PERVLT — Battery 2 Amps Per Volt")}
                type="number"
                step="0.1"
                unit="A/V"
                value={p("BATT2_AMP_PERVLT", "17.0")}
                onChange={(e) => set("BATT2_AMP_PERVLT", e.target.value)}
              />
              <Input
                label={lbl("BATT2_AMP_OFFSET — Battery 2 Current Offset")}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  label={lbl("BATT2_FS_LOW_VOLT — Low Voltage")}
                  type="number"
                  step="0.1"
                  min="0"
                  unit="V"
                  value={p("BATT2_FS_LOW_VOLT")}
                  onChange={(e) => set("BATT2_FS_LOW_VOLT", e.target.value)}
                />
                <Select
                  label={lbl("BATT2_FS_LOW_ACT — Low Action")}
                  options={BATT_FS_ACTION_OPTIONS}
                  value={p("BATT2_FS_LOW_ACT")}
                  onChange={(v) => set("BATT2_FS_LOW_ACT", v)}
                />
                <Input
                  label={lbl("BATT2_FS_CRT_VOLT — Critical Voltage")}
                  type="number"
                  step="0.1"
                  min="0"
                  unit="V"
                  value={p("BATT2_FS_CRT_VOLT")}
                  onChange={(e) => set("BATT2_FS_CRT_VOLT", e.target.value)}
                />
                <Select
                  label={lbl("BATT2_FS_CRT_ACT — Critical Action")}
                  options={BATT_FS_ACTION_OPTIONS}
                  value={p("BATT2_FS_CRT_ACT")}
                  onChange={(v) => set("BATT2_FS_CRT_ACT", v)}
                />
                <Input
                  label={lbl("BATT2_FS_LOW_MAH — Low mAh Remaining")}
                  type="number"
                  step="50"
                  min="0"
                  unit="mAh"
                  value={p("BATT2_FS_LOW_MAH")}
                  onChange={(e) => set("BATT2_FS_LOW_MAH", e.target.value)}
                />
                <Input
                  label={lbl("BATT2_FS_CRT_MAH — Critical mAh Remaining")}
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

        {/* PX4 Battery Config */}
        {isPx4 && hasLoaded && (
          <section className="border-t border-border-secondary pt-4 mt-4">
            <h3 className="text-sm font-medium text-text-secondary mb-3">PX4 Battery Config</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Cell Count</label>
                <Input type="number" step={1} min={1} max={14}
                  value={String(params.get("BAT1_N_CELLS") ?? 4)}
                  onChange={(e) => setLocalValue("BAT1_N_CELLS", Number(e.target.value) || 4)}
                  className="h-8 text-xs" />
                <p className="text-[10px] text-text-tertiary mt-1">PX4 needs explicit cell count (ArduPilot auto-detects)</p>
              </div>
              <div>
                <label className="text-xs text-text-secondary mb-1 block">Internal Resistance (Ohm)</label>
                <Input type="number" step={0.001} min={0} max={1}
                  value={String(params.get("BAT1_R_INTERNAL") ?? 0.005)}
                  onChange={(e) => setLocalValue("BAT1_R_INTERNAL", Number(e.target.value) || 0)}
                  className="h-8 text-xs" />
              </div>
            </div>
          </section>
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
