"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useDroneStore } from "@/stores/drone-store";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { bitmaskToSet, setToBitmask } from "@/lib/rc-options";
import { RotateCcw, Save, HardDrive, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UnifiedFlightMode } from "@/lib/protocol/types";

// ── Mode descriptions ────────────────────────────────────────

const MODE_DESCRIPTIONS: Partial<Record<UnifiedFlightMode, string>> = {
  STABILIZE: "Self-leveling with manual throttle",
  ACRO: "Rate-based control, no self-leveling",
  ALT_HOLD: "Maintains altitude, pilot controls roll/pitch/yaw",
  AUTO: "Follows uploaded mission autonomously",
  GUIDED: "Fly to commanded positions via GCS",
  LOITER: "GPS hold position and altitude",
  RTL: "Return to launch point and land",
  LAND: "Descend and land at current position",
  CIRCLE: "Circle around a point of interest",
  POSHOLD: "GPS and optical flow position hold",
  AUTOTUNE: "Automatic PID tuning in flight",
  MANUAL: "Direct passthrough to control surfaces",
  FBWA: "Fly-by-wire with manual throttle",
  FBWB: "Fly-by-wire with auto throttle",
  CRUISE: "Level flight with heading lock",
  TRAINING: "Limited roll/pitch for training",
  BRAKE: "Rapid stop and hold position",
  SMART_RTL: "Retrace path back to launch",
  DRIFT: "Coordinated turn flight, easy FPV",
  SPORT: "Rate-controlled with self-leveling",
  FLIP: "Automated flip maneuver",
  THROW: "Launch by throwing the vehicle",
  QSTABILIZE: "VTOL stabilize mode",
  QHOVER: "VTOL altitude hold",
  QLOITER: "VTOL GPS position hold",
  QLAND: "VTOL land mode",
  QRTL: "VTOL return to launch",
  QAUTOTUNE: "VTOL automatic PID tuning",
  QACRO: "VTOL rate-based control",
  FLOWHOLD: "Optical flow position hold without GPS",
  FOLLOW: "Follow another vehicle or GCS",
  ZIGZAG: "Fly zigzag pattern between waypoints A & B",
  SYSTEMID: "System identification for dynamic response characterization",
  HELI_AUTOROTATE: "Helicopter autorotation emergency landing",
  AUTO_RTL: "Return via Smart RTL path then switch to AUTO",
  TAKEOFF: "Automatic takeoff sequence",
  LOITER_TO_QLAND: "Loiter then transition to VTOL landing",
  AVOID_ADSB: "Automatic avoidance of ADS-B equipped aircraft",
  THERMAL: "Soaring in thermal updrafts",
};

// ── PWM ranges per mode slot (6 slots, standard ArduPilot) ──

const MODE_PWM_RANGES = [
  { label: "PWM 0–1230", min: 0, max: 1230 },
  { label: "PWM 1231–1360", min: 1231, max: 1360 },
  { label: "PWM 1361–1490", min: 1361, max: 1490 },
  { label: "PWM 1491–1620", min: 1491, max: 1620 },
  { label: "PWM 1621–1749", min: 1621, max: 1749 },
  { label: "PWM 1750–2000", min: 1750, max: 2000 },
];

const MODE_SLOT_COUNT = 6;

// ── Types ────────────────────────────────────────────────────

interface ModeSlotConfig {
  mode: string;
  simple: boolean;
  superSimple: boolean;
}

interface FlightModeGlobalConfig {
  modeChannel: string;
  initialMode: string;
}

function defaultSlot(): ModeSlotConfig {
  return { mode: "STABILIZE", simple: false, superSimple: false };
}

function defaultGlobalConfig(): FlightModeGlobalConfig {
  return { modeChannel: "5", initialMode: "0" };
}

// ── PWM Range Bar ────────────────────────────────────────────

function PwmRangeBar({ currentPwm, activeSlot }: { currentPwm: number; activeSlot: number }) {
  // Bar spans 800 to 2100
  const barMin = 800;
  const barMax = 2100;
  const barRange = barMax - barMin;

  const markerPct = currentPwm > 0
    ? Math.max(0, Math.min(100, ((currentPwm - barMin) / barRange) * 100))
    : -1;

  return (
    <div className="space-y-1">
      <div className="relative h-6 bg-bg-tertiary border border-border-default overflow-hidden">
        {MODE_PWM_RANGES.map((range, i) => {
          const left = ((Math.max(range.min, barMin) - barMin) / barRange) * 100;
          const right = ((Math.min(range.max, barMax) - barMin) / barRange) * 100;
          const width = right - left;
          const isActive = activeSlot === i;

          return (
            <div
              key={i}
              className={cn(
                "absolute top-0 bottom-0 flex items-center justify-center text-[9px] font-mono transition-colors",
                isActive
                  ? "bg-accent-primary/20 text-accent-primary font-bold"
                  : i % 2 === 0
                    ? "bg-bg-secondary/50 text-text-tertiary"
                    : "bg-bg-tertiary/80 text-text-tertiary",
                i < 5 && "border-r border-border-default",
              )}
              style={{ left: `${left}%`, width: `${width}%` }}
            >
              {i + 1}
            </div>
          );
        })}
        {/* Current PWM marker */}
        {markerPct >= 0 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-accent-primary z-10 transition-all duration-150"
            style={{ left: `${markerPct}%` }}
          />
        )}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function FlightModesPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();
  const protocol = getSelectedProtocol();
  const firmwareHandler = protocol?.getFirmwareHandler() ?? null;
  const isCopter = firmwareHandler?.vehicleClass === "copter";

  // Live RC data
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();

  // Current heartbeat mode from drone store
  const heartbeatMode = useDroneStore((s) => s.flightMode);

  // ── Slot state ────────────────────────────────────────────
  const [slots, setSlots] = useState<ModeSlotConfig[]>(
    () => Array.from({ length: MODE_SLOT_COUNT }, defaultSlot),
  );
  const baselineRef = useRef<ModeSlotConfig[]>(
    Array.from({ length: MODE_SLOT_COUNT }, defaultSlot),
  );
  const [dirtySlots, setDirtySlots] = useState<Set<number>>(new Set());

  // ── Global config state ───────────────────────────────────
  const [globalConfig, setGlobalConfig] = useState<FlightModeGlobalConfig>(defaultGlobalConfig);
  const globalBaselineRef = useRef<FlightModeGlobalConfig>(defaultGlobalConfig());
  const [globalDirty, setGlobalDirty] = useState(false);

  // ── UI state ──────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  // ── Available modes from firmware handler ──────────────────

  const availableModes = useMemo(() => {
    if (firmwareHandler) {
      return firmwareHandler.getAvailableModes().map((m) => ({
        value: m,
        label: m,
      }));
    }
    return [
      "STABILIZE", "ACRO", "ALT_HOLD", "AUTO", "GUIDED", "LOITER",
      "RTL", "LAND", "CIRCLE", "POSHOLD", "AUTOTUNE", "MANUAL",
      "BRAKE", "SMART_RTL", "DRIFT", "SPORT",
    ].map((m) => ({ value: m, label: m }));
  }, [firmwareHandler]);

  // ── Channel options ──────────────────────────────────────

  const channelOptions = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      value: String(i + 1),
      label: `Channel ${i + 1}`,
    })),
    [],
  );

  // ── Current mode channel PWM value ───────────────────────

  const modeChIdx = Number(globalConfig.modeChannel) - 1;
  const currentPwm = latestRc?.channels[modeChIdx] ?? 0;

  // Determine active slot based on current PWM
  const activeSlot = useMemo(() => {
    if (currentPwm === 0) return -1;
    for (let i = 0; i < MODE_PWM_RANGES.length; i++) {
      const range = MODE_PWM_RANGES[i];
      if (currentPwm >= range.min && currentPwm <= range.max) return i;
    }
    return -1;
  }, [currentPwm]);

  // ── Duplicate mode detection ─────────────────────────────

  const duplicateModes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of slots) {
      counts.set(s.mode, (counts.get(s.mode) ?? 0) + 1);
    }
    const dups = new Set<string>();
    for (const [mode, count] of counts) {
      if (count > 1) dups.add(mode);
    }
    return dups;
  }, [slots]);

  const hasDuplicates = duplicateModes.size > 0;

  // ── Derived dirty count ──────────────────────────────────

  const totalDirtyCount = dirtySlots.size + (globalDirty ? 1 : 0);
  const isDirty = totalDirtyCount > 0;

  // ── Fetch params ─────────────────────────────────────────

  const fetchParams = useCallback(async () => {
    if (!protocol) return;
    setLoading(true);
    try {
      // Read global config
      const [chParam, initialModeParam] = await Promise.all([
        protocol.getParameter("FLTMODE_CH"),
        protocol.getParameter("INITIAL_MODE"),
      ]);

      const g: FlightModeGlobalConfig = {
        modeChannel: String(chParam.value),
        initialMode: String(initialModeParam.value),
      };
      setGlobalConfig(g);
      globalBaselineRef.current = { ...g };
      setGlobalDirty(false);

      // Read 6 mode slots
      const modeParams = await Promise.all(
        Array.from({ length: MODE_SLOT_COUNT }, (_, i) =>
          protocol.getParameter(`FLTMODE${i + 1}`),
        ),
      );

      // Read bitmasks (copter only)
      let simpleBitmask = 0;
      let superSimpleBitmask = 0;
      if (isCopter) {
        const [simpleParam, superSimpleParam] = await Promise.all([
          protocol.getParameter("SIMPLE"),
          protocol.getParameter("SUPER_SIMPLE"),
        ]);
        simpleBitmask = simpleParam.value;
        superSimpleBitmask = superSimpleParam.value;
      }

      const simpleSet = bitmaskToSet(simpleBitmask);
      const superSimpleSet = bitmaskToSet(superSimpleBitmask);

      const newSlots: ModeSlotConfig[] = modeParams.map((p, i) => ({
        mode: firmwareHandler
          ? firmwareHandler.decodeFlightMode(p.value)
          : "STABILIZE",
        simple: simpleSet.has(i),
        superSimple: superSimpleSet.has(i),
      }));

      setSlots(newSlots);
      baselineRef.current = newSlots.map((s) => ({ ...s }));
      setDirtySlots(new Set());
      setShowCommitButton(false);
      toast("Loaded flight mode configuration", "success");
    } catch {
      toast("Failed to load flight modes", "error");
    } finally {
      setLoading(false);
    }
  }, [protocol, firmwareHandler, isCopter, toast]);

  // ── Auto-read on mount (Bug #1 fix) ─────────────────────

  useEffect(() => {
    fetchParams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Save params — only dirty writes (Bug #3 fix) ─────────

  const saveParams = useCallback(async () => {
    if (!protocol) return;
    if (!isDirty) return;
    setSaving(true);
    try {
      // Global config
      if (globalDirty) {
        const g = globalConfig;
        const gb = globalBaselineRef.current;
        if (g.modeChannel !== gb.modeChannel) {
          await protocol.setParameter("FLTMODE_CH", Number(g.modeChannel));
        }
        if (g.initialMode !== gb.initialMode) {
          await protocol.setParameter("INITIAL_MODE", Number(g.initialMode));
        }
      }

      // Per-slot modes
      let simpleChanged = false;
      let superSimpleChanged = false;

      for (const idx of dirtySlots) {
        const slot = slots[idx];
        const base = baselineRef.current[idx];

        // Write mode param if changed
        if (slot.mode !== base.mode && firmwareHandler) {
          const { customMode } = firmwareHandler.encodeFlightMode(
            slot.mode as UnifiedFlightMode,
          );
          await protocol.setParameter(`FLTMODE${idx + 1}`, customMode);
        }

        if (slot.simple !== base.simple) simpleChanged = true;
        if (slot.superSimple !== base.superSimple) superSimpleChanged = true;
      }

      // Write SIMPLE bitmask if any slot's simple changed (copter only)
      if (isCopter && simpleChanged) {
        const simpleSet = new Set<number>();
        for (let i = 0; i < MODE_SLOT_COUNT; i++) {
          if (slots[i].simple) simpleSet.add(i);
        }
        await protocol.setParameter("SIMPLE", setToBitmask(simpleSet));
      }

      // Write SUPER_SIMPLE bitmask if any slot's superSimple changed (copter only)
      if (isCopter && superSimpleChanged) {
        const ssSet = new Set<number>();
        for (let i = 0; i < MODE_SLOT_COUNT; i++) {
          if (slots[i].superSimple) ssSet.add(i);
        }
        await protocol.setParameter("SUPER_SIMPLE", setToBitmask(ssSet));
      }

      // Update baselines
      baselineRef.current = slots.map((s) => ({ ...s }));
      globalBaselineRef.current = { ...globalConfig };
      setDirtySlots(new Set());
      setGlobalDirty(false);
      setShowCommitButton(true);
      toast("Saved to flight controller", "success");
    } catch {
      toast("Failed to save flight modes", "error");
    } finally {
      setSaving(false);
    }
  }, [protocol, firmwareHandler, isCopter, slots, globalConfig, isDirty, globalDirty, dirtySlots, toast]);

  // ── Commit to flash (Bug #2 fix) ─────────────────────────

  const commitToFlash = useCallback(async () => {
    if (!protocol) return;
    try {
      const result = await protocol.commitParamsToFlash();
      if (result.success) {
        setShowCommitButton(false);
        toast("Written to flash — persists after reboot", "success");
      } else {
        toast("Failed to write to flash", "error");
      }
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [protocol, toast]);

  // ── Slot updaters ────────────────────────────────────────

  const updateSlot = useCallback((idx: number, partial: Partial<ModeSlotConfig>) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
    setDirtySlots((prev) => new Set(prev).add(idx));
  }, []);

  const resetSlot = useCallback((idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...baselineRef.current[idx] };
      return next;
    });
    setDirtySlots((prev) => {
      const next = new Set(prev);
      next.delete(idx);
      return next;
    });
  }, []);

  // ── Global config updater ────────────────────────────────

  const updateGlobal = useCallback((partial: Partial<FlightModeGlobalConfig>) => {
    setGlobalConfig((prev) => ({ ...prev, ...partial }));
    setGlobalDirty(true);
  }, []);

  // ── No protocol ──────────────────────────────────────────

  if (!protocol) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-2xl space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">Flight Modes</h2>
          <Card>
            <p className="text-xs text-text-tertiary">Connect to a drone to configure flight modes.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        {/* ── Header ────────────────────────────────────────── */}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-text-primary">Flight Modes</h2>
            {isDirty && (
              <span className="flex items-center gap-1 text-[10px] text-status-warning">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning" />
                {totalDirtyCount} unsaved
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
              disabled={!isDirty}
              onClick={saveParams}
            >
              Save{dirtySlots.size > 0 ? ` (${dirtySlots.size})` : ""}
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

        {/* ── Current Mode Bar ──────────────────────────────── */}

        <div className="bg-bg-secondary border border-border-default p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">Current Mode:</span>
              <span className="text-sm font-mono font-bold text-accent-primary">
                {heartbeatMode}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-text-secondary">
              {activeSlot >= 0 && (
                <span className="text-status-success font-medium">
                  Slot {activeSlot + 1}
                </span>
              )}
              {currentPwm > 0 && (
                <span className="text-text-tertiary">
                  CH{globalConfig.modeChannel} PWM {currentPwm}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── Mode Switch Channel ───────────────────────────── */}

        <Card title="Mode Switch Channel">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Select
                label="RC channel for flight mode switch"
                value={globalConfig.modeChannel}
                onChange={(v) => updateGlobal({ modeChannel: v })}
                options={channelOptions}
              />
              <Select
                label="Initial boot mode (INITIAL_MODE)"
                value={globalConfig.initialMode}
                onChange={(v) => updateGlobal({ initialMode: v })}
                options={[
                  { value: "0", label: "0 — Use mode switch" },
                  ...availableModes
                    .map((m) => {
                      // Encode mode to custom_mode number for param value
                      if (firmwareHandler) {
                        try {
                          const { customMode } = firmwareHandler.encodeFlightMode(
                            m.value as UnifiedFlightMode,
                          );
                          return { value: String(customMode), label: `${customMode} — ${m.label}` };
                        } catch {
                          return null;
                        }
                      }
                      return { value: m.value, label: m.label };
                    })
                    .filter((opt): opt is { value: string; label: string } => opt !== null && opt.value !== "0"),
                ]}
              />
            </div>

            {/* PWM Range Bar */}
            <PwmRangeBar currentPwm={currentPwm} activeSlot={activeSlot} />

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-secondary">Current PWM:</span>
              <span className="text-xs font-mono text-accent-primary tabular-nums">
                {currentPwm > 0 ? currentPwm : "—"}
              </span>
              {activeSlot >= 0 && (
                <span className="text-[10px] text-status-success font-medium ml-1">
                  Slot {activeSlot + 1} active
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* ── Duplicate Mode Info ───────────────────────────── */}

        {hasDuplicates && (
          <div className="flex items-center gap-2 p-2 bg-accent-primary/5 border border-accent-primary/20">
            <Info size={14} className="text-accent-primary shrink-0" />
            <span className="text-[10px] text-accent-primary">
              Same mode in multiple slots: {[...duplicateModes].join(", ")}. This is valid but unusual.
            </span>
          </div>
        )}

        {/* ── Mode Slots ────────────────────────────────────── */}

        <div className="grid grid-cols-1 gap-2">
          {slots.map((slot, i) => {
            const isActive = activeSlot === i;
            const isSlotDirty = dirtySlots.has(i);
            const range = MODE_PWM_RANGES[i];
            const description = MODE_DESCRIPTIONS[slot.mode as UnifiedFlightMode];

            return (
              <div
                key={i}
                className={cn(
                  "bg-bg-secondary border p-3 transition-colors",
                  isSlotDirty && "border-l-2 border-l-status-warning",
                  isActive
                    ? "border-accent-primary bg-accent-primary/5"
                    : "border-border-default",
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Slot number */}
                  <div
                    className={cn(
                      "w-7 h-7 flex items-center justify-center text-xs font-mono font-bold shrink-0",
                      isActive
                        ? "bg-accent-primary text-white"
                        : "bg-bg-tertiary text-text-secondary",
                    )}
                  >
                    {i + 1}
                  </div>

                  {/* Mode selector */}
                  <div className="flex-1">
                    <Select
                      value={slot.mode}
                      onChange={(v) => updateSlot(i, { mode: v })}
                      options={availableModes}
                    />
                  </div>

                  {/* Simple / Super Simple checkboxes (copter only) */}
                  {isCopter && (
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="flex items-center gap-1 text-[10px] text-text-secondary cursor-pointer" title="Simple Mode — earth-relative heading">
                        <input
                          type="checkbox"
                          checked={slot.simple}
                          onChange={(e) => updateSlot(i, { simple: e.target.checked })}
                          className="accent-accent-primary"
                        />
                        S
                      </label>
                      <label className="flex items-center gap-1 text-[10px] text-text-secondary cursor-pointer" title="Super Simple Mode — home-relative heading">
                        <input
                          type="checkbox"
                          checked={slot.superSimple}
                          onChange={(e) => updateSlot(i, { superSimple: e.target.checked })}
                          className="accent-accent-primary"
                        />
                        SS
                      </label>
                    </div>
                  )}

                  {/* PWM range */}
                  <span className="text-[10px] font-mono text-text-tertiary shrink-0 w-28 text-right">
                    {range.label}
                  </span>

                  {/* Reset button (only when dirty) */}
                  {isSlotDirty && (
                    <button
                      onClick={() => resetSlot(i)}
                      title="Reset to FC values"
                      className="text-text-tertiary hover:text-text-primary cursor-pointer shrink-0"
                    >
                      <RotateCcw size={12} />
                    </button>
                  )}
                </div>

                {/* Description */}
                {description && (
                  <p className="text-[10px] text-text-tertiary mt-1.5 ml-10">
                    {description}
                  </p>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="mt-2 ml-10">
                    <span className="text-[10px] font-medium text-accent-primary uppercase tracking-wider">
                      Active
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
