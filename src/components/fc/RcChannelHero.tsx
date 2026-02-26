"use client";

import { useState, useMemo } from "react";
import { Radio, ChevronDown, ChevronRight } from "lucide-react";
import { type ChannelConfig, type MappingState, getRcOptionLabel } from "@/lib/rc-options";

// ── Props ──────────────────────────────────────────────────────

interface RcChannelHeroProps {
  channels: number[];
  channelConfigs: ChannelConfig[];
  mapping: MappingState;
  rssi: number;
  calibrating: boolean;
  calMins: number[];
  calMaxs: number[];
}

// ── Helpers ────────────────────────────────────────────────────

function getChannelRole(
  chIndex: number,
  mapping: MappingState,
): string | null {
  const ch = String(chIndex + 1);
  if (mapping.roll === ch) return "Roll";
  if (mapping.pitch === ch) return "Pitch";
  if (mapping.throttle === ch) return "Thr";
  if (mapping.yaw === ch) return "Yaw";
  return null;
}

function getAuxLabel(cfg: ChannelConfig): string | null {
  if (cfg.option === 0) return null;
  const label = getRcOptionLabel(cfg.option);
  return label.length > 10 ? label.slice(0, 10) + "\u2026" : label;
}

// ── Display range: 800-2200 but expand if config exceeds ────

const DISPLAY_MIN = 800;
const DISPLAY_MAX = 2200;

function displayRange(cfg: ChannelConfig) {
  const lo = Math.min(DISPLAY_MIN, cfg.min);
  const hi = Math.max(DISPLAY_MAX, cfg.max);
  return { lo, hi, span: hi - lo || 1 };
}

function pct(value: number, lo: number, span: number) {
  return ((value - lo) / span) * 100;
}

// ── Single Channel Bar ────────────────────────────────────────

function ChannelBar({
  index,
  value,
  cfg,
  role,
  calibrating,
  calMin,
  calMax,
}: {
  index: number;
  value: number;
  cfg: ChannelConfig;
  role: string | null;
  calibrating: boolean;
  calMin: number;
  calMax: number;
}) {
  const { lo, hi, span } = displayRange(cfg);
  const noSignal = value === 0;
  const outOfRange = !noSignal && (value < cfg.min || value > cfg.max);
  const reversed = cfg.reversed;

  // Percentage positions
  const valuePct = noSignal ? 0 : Math.max(0, Math.min(100, pct(value, lo, span)));
  const minPct = pct(cfg.min, lo, span);
  const maxPct = pct(cfg.max, lo, span);
  const trimPct = pct(cfg.trim, lo, span);
  const centerPct = pct(1500, lo, span);

  // Deadzone shading
  const dzLo = pct(cfg.trim - cfg.deadzone, lo, span);
  const dzHi = pct(cfg.trim + cfg.deadzone, lo, span);

  // Fill color
  const fillColor = outOfRange
    ? "bg-status-error/40"
    : reversed
      ? "bg-status-warning/40"
      : "bg-accent-primary/40";
  const needleColor = outOfRange
    ? "bg-status-error"
    : reversed
      ? "bg-status-warning"
      : "bg-accent-primary";

  // Aux label for CH5+
  const auxLabel = !role ? getAuxLabel(cfg) : null;

  // Calibration rendering
  const calValid = calMin < 2500 && calMax > 500;
  const calMinPct = calValid ? Math.max(0, pct(calMin, lo, span)) : 0;
  const calMaxPct = calValid ? Math.min(100, pct(calMax, lo, span)) : 0;

  return (
    <div className="flex items-center gap-2 group">
      {/* Channel label */}
      <span className="text-[10px] font-mono text-text-secondary w-8 text-right shrink-0">
        CH{index + 1}
      </span>

      {/* Role badge */}
      <span className="w-12 shrink-0">
        {role ? (
          <span className="text-[10px] font-semibold text-accent-primary bg-accent-primary/10 border border-accent-primary/20 px-1 py-0.5">
            {role}
          </span>
        ) : auxLabel ? (
          <span className="text-[10px] text-text-tertiary truncate block">{auxLabel}</span>
        ) : (
          <span className="text-[10px] text-text-tertiary">&mdash;</span>
        )}
      </span>

      {/* Bar track */}
      <div className="flex-1 h-5 bg-bg-tertiary border border-border-default relative overflow-hidden">
        {/* Z0: Deadzone shading */}
        {cfg.deadzone > 0 && (
          <div
            className="absolute top-0 bottom-0 bg-text-tertiary/8"
            style={{ left: `${dzLo}%`, width: `${dzHi - dzLo}%` }}
          />
        )}

        {/* Z5: Center line (1500µs) */}
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-text-tertiary/15"
          style={{ left: `${centerPct}%` }}
        />

        {/* Z10: Config min marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-status-warning/50"
          style={{ left: `${minPct}%` }}
        />

        {/* Z10: Config max marker */}
        <div
          className="absolute top-0 bottom-0 w-px bg-status-warning/50"
          style={{ left: `${maxPct}%` }}
        />

        {/* Z10: Trim marker */}
        <div
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-text-tertiary/30"
          style={{ left: `${trimPct}%` }}
        />

        {calibrating ? (
          <>
            {/* Calibration swept range fill */}
            {calValid && (
              <div
                className="absolute top-0 bottom-0 bg-accent-primary/20 animate-pulse"
                style={{ left: `${calMinPct}%`, width: `${calMaxPct - calMinPct}%` }}
              />
            )}
            {/* CalMin marker */}
            {calValid && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-status-error"
                style={{ left: `${calMinPct}%` }}
              />
            )}
            {/* CalMax marker */}
            {calValid && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-status-error"
                style={{ left: `${calMaxPct}%` }}
              />
            )}
          </>
        ) : null}

        {/* Z20: Current value fill (from left to current) */}
        {!noSignal && (
          <div
            className={`absolute top-0 bottom-0 left-0 transition-all duration-75 ${fillColor}`}
            style={{ width: `${valuePct}%` }}
          />
        )}

        {/* Z30: Current value needle */}
        {!noSignal && (
          <div
            className={`absolute top-0 bottom-0 w-0.5 transition-all duration-75 ${needleColor}`}
            style={{ left: `${valuePct}%` }}
          />
        )}
      </div>

      {/* Value readout */}
      <span className={`text-[10px] font-mono tabular-nums w-16 text-right shrink-0 ${
        noSignal ? "text-text-tertiary" : "text-text-primary"
      }`}>
        {noSignal ? "---" : `${value} \u00B5s`}
      </span>

      {/* Calibration min/max readout */}
      {calibrating && calValid && (
        <span className="text-[9px] font-mono text-text-tertiary w-24 shrink-0">
          {calMin}–{calMax} ({calMax - calMin})
        </span>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export function RcChannelHero({
  channels,
  channelConfigs,
  mapping,
  rssi,
  calibrating,
  calMins,
  calMaxs,
}: RcChannelHeroProps) {
  const [showExtended, setShowExtended] = useState(false);

  const rssiPct = useMemo(() => Math.round((rssi / 255) * 100), [rssi]);
  const rssiColor = rssiPct > 80
    ? "bg-status-success"
    : rssiPct > 40
      ? "bg-status-warning"
      : "bg-status-error";

  return (
    <div className="space-y-1">
      {/* Control channels CH1-4 */}
      {channelConfigs.slice(0, 4).map((cfg, i) => (
        <ChannelBar
          key={i}
          index={i}
          value={channels[i] ?? 0}
          cfg={cfg}
          role={getChannelRole(i, mapping)}
          calibrating={calibrating}
          calMin={calMins[i] ?? 3000}
          calMax={calMaxs[i] ?? 0}
        />
      ))}

      {/* Visual separator */}
      <div className="border-t border-border-default my-1" />

      {/* Aux channels CH5-8 */}
      {channelConfigs.slice(4, 8).map((cfg, i) => (
        <ChannelBar
          key={i + 4}
          index={i + 4}
          value={channels[i + 4] ?? 0}
          cfg={cfg}
          role={getChannelRole(i + 4, mapping)}
          calibrating={calibrating}
          calMin={calMins[i + 4] ?? 3000}
          calMax={calMaxs[i + 4] ?? 0}
        />
      ))}

      {/* CH9-16 toggle */}
      <button
        onClick={() => setShowExtended(!showExtended)}
        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer mt-1"
      >
        {showExtended ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {showExtended ? "Hide" : "Show"} CH9–16
      </button>

      {showExtended && (
        <div className="space-y-1">
          {channelConfigs.slice(8, 16).map((cfg, i) => (
            <ChannelBar
              key={i + 8}
              index={i + 8}
              value={channels[i + 8] ?? 0}
              cfg={cfg}
              role={getChannelRole(i + 8, mapping)}
              calibrating={calibrating}
              calMin={calMins[i + 8] ?? 3000}
              calMax={calMaxs[i + 8] ?? 0}
            />
          ))}
        </div>
      )}

      {/* RSSI bar */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-default">
        <Radio size={12} className="text-text-tertiary" />
        <span className="text-[10px] text-text-secondary">RSSI</span>
        <span className={`w-1.5 h-1.5 rounded-full ${rssiColor}`} />
        <div className="w-20 h-2.5 bg-bg-tertiary border border-border-default overflow-hidden">
          <div
            className={`h-full transition-all duration-150 ${rssiColor}/60`}
            style={{ width: `${rssiPct}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-text-primary tabular-nums">{rssi}</span>
        <span className="text-[10px] text-text-tertiary">({rssiPct}%)</span>
      </div>
    </div>
  );
}
