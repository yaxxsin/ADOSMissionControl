"use client";

import { useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { RotateCcw, Save, Radio, HardDrive } from "lucide-react";

// ── Constants ────────────────────────────────────────────────

const RC_CHANNEL_COUNT = 16;

const CHANNEL_OPTIONS = Array.from({ length: RC_CHANNEL_COUNT }, (_, i) => ({
  value: String(i + 1),
  label: `Channel ${i + 1}`,
}));

interface ChannelConfig {
  min: number;
  max: number;
  trim: number;
  reversed: boolean;
}

function defaultChannelConfig(): ChannelConfig {
  return { min: 1000, max: 2000, trim: 1500, reversed: false };
}

// ── RC Channel Bar ───────────────────────────────────────────

function RcChannelBar({ index, value, min, max }: {
  index: number;
  value: number;
  min: number;
  max: number;
}) {
  const range = max - min || 1;
  const pct = Math.max(0, Math.min(100, ((value - min) / range) * 100));

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-text-secondary w-6 text-right shrink-0">
        CH{index + 1}
      </span>
      <div className="flex-1 h-4 bg-bg-tertiary border border-border-default relative overflow-hidden">
        <div
          className="h-full bg-status-success/60 transition-all duration-75"
          style={{ width: `${pct}%` }}
        />
        {/* Center mark at 1500 */}
        <div
          className="absolute top-0 bottom-0 w-px bg-text-tertiary/30"
          style={{ left: `${((1500 - min) / range) * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-text-primary tabular-nums w-10 text-right shrink-0">
        {value}
      </span>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export function ReceiverPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getSelectedProtocol();
  const { toast } = useToast();

  // Live RC data from telemetry store
  const rcBuffer = useTelemetryStore((s) => s.rc);
  const latestRc = rcBuffer.latest();
  const channels = latestRc?.channels ?? Array.from({ length: RC_CHANNEL_COUNT }, () => 0);
  const rssi = latestRc?.rssi ?? 0;

  // ── Channel mapping state ──────────────────────────────────
  const [mapRoll, setMapRoll] = useState("1");
  const [mapPitch, setMapPitch] = useState("2");
  const [mapThrottle, setMapThrottle] = useState("3");
  const [mapYaw, setMapYaw] = useState("4");

  // ── Per-channel config state ───────────────────────────────
  const [channelConfigs, setChannelConfigs] = useState<ChannelConfig[]>(
    () => Array.from({ length: RC_CHANNEL_COUNT }, defaultChannelConfig),
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  // ── Calibration state ──────────────────────────────────────
  const [calibrating, setCalibrating] = useState(false);
  const [calMins, setCalMins] = useState<number[]>(() => Array(RC_CHANNEL_COUNT).fill(2000));
  const [calMaxs, setCalMaxs] = useState<number[]>(() => Array(RC_CHANNEL_COUNT).fill(1000));

  // Update calibration extremes from live data
  const updateCalibration = useCallback(() => {
    if (!calibrating) return;
    setCalMins((prev) =>
      prev.map((v, i) => (channels[i] > 0 ? Math.min(v, channels[i]) : v)),
    );
    setCalMaxs((prev) =>
      prev.map((v, i) => (channels[i] > 0 ? Math.max(v, channels[i]) : v)),
    );
  }, [calibrating, channels]);

  // Call on each render during calibration
  if (calibrating) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- intentional per-render update
    updateCalibration();
  }

  // ── Fetch params ───────────────────────────────────────────

  const fetchParams = useCallback(async () => {
    if (!protocol) return;
    setLoading(true);
    try {
      const [roll, pitch, throttle, yaw] = await Promise.all([
        protocol.getParameter("RC_MAP_ROLL"),
        protocol.getParameter("RC_MAP_PITCH"),
        protocol.getParameter("RC_MAP_THROTTLE"),
        protocol.getParameter("RC_MAP_YAW"),
      ]);
      setMapRoll(String(roll.value));
      setMapPitch(String(pitch.value));
      setMapThrottle(String(throttle.value));
      setMapYaw(String(yaw.value));

      const configs: ChannelConfig[] = [];
      for (let i = 1; i <= RC_CHANNEL_COUNT; i++) {
        const [min, max, trim, rev] = await Promise.all([
          protocol.getParameter(`RC${i}_MIN`),
          protocol.getParameter(`RC${i}_MAX`),
          protocol.getParameter(`RC${i}_TRIM`),
          protocol.getParameter(`RC${i}_REVERSED`),
        ]);
        configs.push({
          min: min.value,
          max: max.value,
          trim: trim.value,
          reversed: rev.value !== 0,
        });
      }
      setChannelConfigs(configs);
      setDirty(false);
      setShowCommitButton(false);
      toast("Receiver parameters loaded", "success");
    } catch {
      toast("Failed to read receiver parameters", "error");
    } finally {
      setLoading(false);
    }
  }, [protocol, toast]);

  // ── Save params ────────────────────────────────────────────

  const saveParams = useCallback(async () => {
    if (!protocol) return;
    setSaving(true);
    try {
      await Promise.all([
        protocol.setParameter("RC_MAP_ROLL", Number(mapRoll)),
        protocol.setParameter("RC_MAP_PITCH", Number(mapPitch)),
        protocol.setParameter("RC_MAP_THROTTLE", Number(mapThrottle)),
        protocol.setParameter("RC_MAP_YAW", Number(mapYaw)),
      ]);
      for (let i = 0; i < RC_CHANNEL_COUNT; i++) {
        const cfg = channelConfigs[i];
        const n = i + 1;
        await protocol.setParameter(`RC${n}_MIN`, cfg.min);
        await protocol.setParameter(`RC${n}_MAX`, cfg.max);
        await protocol.setParameter(`RC${n}_TRIM`, cfg.trim);
        await protocol.setParameter(`RC${n}_REVERSED`, cfg.reversed ? 1 : 0);
      }
      setDirty(false);
      setShowCommitButton(true);
      toast("Receiver parameters saved to RAM", "success");
    } catch {
      toast("Failed to save receiver parameters", "error");
    } finally {
      setSaving(false);
    }
  }, [protocol, mapRoll, mapPitch, mapThrottle, mapYaw, channelConfigs, toast]);

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

  // ── Channel config updater ─────────────────────────────────

  const updateChannel = useCallback((idx: number, partial: Partial<ChannelConfig>) => {
    setChannelConfigs((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...partial };
      return next;
    });
    setDirty(true);
  }, []);

  // ── Save calibration ──────────────────────────────────────

  const saveCalibration = useCallback(() => {
    setChannelConfigs((prev) =>
      prev.map((cfg, i) => ({
        ...cfg,
        min: calMins[i] < 1500 ? calMins[i] : cfg.min,
        max: calMaxs[i] > 1500 ? calMaxs[i] : cfg.max,
      })),
    );
    setCalibrating(false);
    setDirty(true);
    toast("Calibration applied — save to write to FC", "info");
  }, [calMins, calMaxs, toast]);

  // ── RSSI percentage ────────────────────────────────────────

  const rssiPct = useMemo(() => Math.round((rssi / 255) * 100), [rssi]);

  if (!protocol) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-3xl space-y-4">
          <h2 className="text-sm font-semibold text-text-primary">RC Receiver</h2>
          <Card>
            <p className="text-xs text-text-tertiary">Connect to a drone to configure receiver.</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">RC Receiver</h2>
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

        {/* ── Live RC Channels ──────────────────────────────── */}

        <Card title="Live RC Channels">
          <div className="space-y-1.5">
            {channels.slice(0, RC_CHANNEL_COUNT).map((val, i) => (
              <RcChannelBar
                key={i}
                index={i}
                value={val}
                min={channelConfigs[i]?.min ?? 1000}
                max={channelConfigs[i]?.max ?? 2000}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-default">
            <Radio size={12} className="text-text-tertiary" />
            <span className="text-[10px] text-text-secondary">RSSI:</span>
            <span className="text-[10px] font-mono text-text-primary">{rssi}</span>
            <span className="text-[10px] text-text-tertiary">({rssiPct}%)</span>
          </div>
        </Card>

        {/* ── Channel Mapping ──────────────────────────────── */}

        <Card title="Channel Mapping">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Roll"
              value={mapRoll}
              onChange={(v) => { setMapRoll(v); setDirty(true); }}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Pitch"
              value={mapPitch}
              onChange={(v) => { setMapPitch(v); setDirty(true); }}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Throttle"
              value={mapThrottle}
              onChange={(v) => { setMapThrottle(v); setDirty(true); }}
              options={CHANNEL_OPTIONS}
            />
            <Select
              label="Yaw"
              value={mapYaw}
              onChange={(v) => { setMapYaw(v); setDirty(true); }}
              options={CHANNEL_OPTIONS}
            />
          </div>
        </Card>

        {/* ── Per-Channel Settings ─────────────────────────── */}

        <Card title="Channel Settings" padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-default text-text-secondary">
                  <th className="px-3 py-2 text-left font-medium">CH</th>
                  <th className="px-3 py-2 text-left font-medium">Min</th>
                  <th className="px-3 py-2 text-left font-medium">Max</th>
                  <th className="px-3 py-2 text-left font-medium">Trim</th>
                  <th className="px-3 py-2 text-left font-medium">Rev</th>
                </tr>
              </thead>
              <tbody>
                {channelConfigs.map((cfg, i) => (
                  <tr key={i} className="border-b border-border-default last:border-0 hover:bg-bg-tertiary/50">
                    <td className="px-3 py-1.5 font-mono text-text-secondary">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={cfg.min}
                        onChange={(e) => updateChannel(i, { min: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={cfg.max}
                        onChange={(e) => updateChannel(i, { max: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <input
                        type="number"
                        value={cfg.trim}
                        onChange={(e) => updateChannel(i, { trim: Number(e.target.value) })}
                        className="w-16 h-7 px-1.5 bg-bg-tertiary border border-border-default text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <Toggle
                        label=""
                        checked={cfg.reversed}
                        onChange={(v) => updateChannel(i, { reversed: v })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* ── Radio Calibration ────────────────────────────── */}

        <Card title="Radio Calibration">
          <div className="space-y-3">
            {!calibrating ? (
              <>
                <p className="text-[10px] text-text-tertiary">
                  Move all sticks and switches to their extreme positions, then save calibration to record min/max values.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setCalMins(Array(RC_CHANNEL_COUNT).fill(2000));
                    setCalMaxs(Array(RC_CHANNEL_COUNT).fill(1000));
                    setCalibrating(true);
                  }}
                >
                  Start Calibration
                </Button>
              </>
            ) : (
              <>
                <div className="p-2 bg-status-warning/10 border border-status-warning/20">
                  <p className="text-[10px] text-status-warning font-medium">
                    Calibrating — Move all sticks and switches to their extreme positions now.
                  </p>
                </div>

                <div className="space-y-1">
                  {channels.slice(0, RC_CHANNEL_COUNT).map((val, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-text-secondary w-6 text-right">CH{i + 1}</span>
                      <span className="text-text-tertiary w-10 text-right">{calMins[i]}</span>
                      <div className="flex-1 h-3 bg-bg-tertiary border border-border-default relative overflow-hidden">
                        <div
                          className="h-full bg-accent-primary/40 transition-all duration-75"
                          style={{
                            left: `${((calMins[i] - 800) / 1200) * 100}%`,
                            width: `${((calMaxs[i] - calMins[i]) / 1200) * 100}%`,
                            position: "absolute",
                          }}
                        />
                      </div>
                      <span className="text-text-tertiary w-10">{calMaxs[i]}</span>
                      <span className="text-text-primary w-10 text-right">{val}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Save size={12} />}
                    onClick={saveCalibration}
                  >
                    Save Calibration
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCalibrating(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
