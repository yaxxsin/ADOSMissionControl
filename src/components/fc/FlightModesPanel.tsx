"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { RotateCcw, Save } from "lucide-react";
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

export function FlightModesPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();
  const firmwareHandler = protocol?.getFirmwareHandler() ?? null;

  // Live RC data
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();

  // ── State ──────────────────────────────────────────────────
  const [modeChannel, setModeChannel] = useState("5");
  const [modes, setModes] = useState<string[]>(
    () => Array.from({ length: MODE_SLOT_COUNT }, () => "STABILIZE"),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ── Available modes from firmware handler ──────────────────

  const availableModes = useMemo(() => {
    if (firmwareHandler) {
      return firmwareHandler.getAvailableModes().map((m) => ({
        value: m,
        label: m,
      }));
    }
    // Fallback common modes
    return [
      "STABILIZE", "ACRO", "ALT_HOLD", "AUTO", "GUIDED", "LOITER",
      "RTL", "LAND", "CIRCLE", "POSHOLD", "AUTOTUNE", "MANUAL",
      "BRAKE", "SMART_RTL", "DRIFT", "SPORT",
    ].map((m) => ({ value: m, label: m }));
  }, [firmwareHandler]);

  // ── Channel options ────────────────────────────────────────

  const channelOptions = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({
      value: String(i + 1),
      label: `Channel ${i + 1}`,
    })),
    [],
  );

  // ── Current mode channel PWM value ─────────────────────────

  const modeChIdx = Number(modeChannel) - 1;
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

  // ── Fetch params ───────────────────────────────────────────

  const fetchParams = useCallback(async () => {
    if (!protocol) return;
    setLoading(true);
    try {
      const chParam = await protocol.getParameter("FLTMODE_CH");
      setModeChannel(String(chParam.value));

      const modeParams = await Promise.all(
        Array.from({ length: MODE_SLOT_COUNT }, (_, i) =>
          protocol.getParameter(`FLTMODE${i + 1}`),
        ),
      );

      // Decode mode numbers to names via firmware handler
      const modeNames = modeParams.map((p) => {
        if (firmwareHandler) {
          return firmwareHandler.decodeFlightMode(p.value);
        }
        return "STABILIZE";
      });

      setModes(modeNames);
      setDirty(false);
    } catch {
      // partial read
    } finally {
      setLoading(false);
    }
  }, [protocol, firmwareHandler]);

  // ── Save params ────────────────────────────────────────────

  const saveParams = useCallback(async () => {
    if (!protocol) return;
    setSaving(true);
    try {
      await protocol.setParameter("FLTMODE_CH", Number(modeChannel));

      for (let i = 0; i < MODE_SLOT_COUNT; i++) {
        // Encode mode name to number via firmware handler
        if (firmwareHandler) {
          const { customMode } = firmwareHandler.encodeFlightMode(
            modes[i] as UnifiedFlightMode,
          );
          await protocol.setParameter(`FLTMODE${i + 1}`, customMode);
        }
      }
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [protocol, firmwareHandler, modeChannel, modes]);

  // ── Mode updater ───────────────────────────────────────────

  const updateMode = useCallback((idx: number, mode: string) => {
    setModes((prev) => {
      const next = [...prev];
      next[idx] = mode;
      return next;
    });
    setDirty(true);
  }, []);

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
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Flight Modes</h2>
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

        {/* ── Mode Switch Channel ──────────────────────────── */}

        <Card title="Mode Switch Channel">
          <div className="space-y-3">
            <Select
              label="RC channel for flight mode switch"
              value={modeChannel}
              onChange={(v) => { setModeChannel(v); setDirty(true); }}
              options={channelOptions}
            />
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

        {/* ── Mode Slots ──────────────────────────────────── */}

        <div className="grid grid-cols-1 gap-2">
          {modes.map((mode, i) => {
            const isActive = activeSlot === i;
            const range = MODE_PWM_RANGES[i];
            const description = MODE_DESCRIPTIONS[mode as UnifiedFlightMode];

            return (
              <div
                key={i}
                className={cn(
                  "bg-bg-secondary border p-3 transition-colors",
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
                      value={mode}
                      onChange={(v) => updateMode(i, v)}
                      options={availableModes}
                    />
                  </div>

                  {/* PWM range */}
                  <span className="text-[10px] font-mono text-text-tertiary shrink-0 w-28 text-right">
                    {range.label}
                  </span>
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
