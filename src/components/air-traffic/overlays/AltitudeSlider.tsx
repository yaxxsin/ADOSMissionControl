/**
 * @module AltitudeSlider
 * @description Vertical dual-thumb altitude range filter for aircraft visibility.
 * Positioned on the left side of the Air Traffic view. Aircraft outside the
 * selected range are hidden from the globe.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback } from "react";
import { ArrowUpDown } from "lucide-react";
import { useAirspaceStore } from "@/stores/airspace-store";

const MIN_ALT = 0;
const MAX_ALT = 15000; // meters
const STEP = 100;

function formatAlt(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`;
  return `${m}m`;
}

function formatFt(m: number): string {
  return `${Math.round(m * 3.28084).toLocaleString()}ft`;
}

export function AltitudeSlider() {
  const altitudeFilter = useAirspaceStore((s) => s.altitudeFilter);
  const setAltitudeFilter = useAirspaceStore((s) => s.setAltitudeFilter);

  const handleMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      setAltitudeFilter({
        min: Math.min(val, altitudeFilter.max - STEP),
        max: altitudeFilter.max,
      });
    },
    [altitudeFilter.max, setAltitudeFilter],
  );

  const handleMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      setAltitudeFilter({
        min: altitudeFilter.min,
        max: Math.max(val, altitudeFilter.min + STEP),
      });
    },
    [altitudeFilter.min, setAltitudeFilter],
  );

  const reset = useCallback(() => {
    setAltitudeFilter({ min: MIN_ALT, max: MAX_ALT });
  }, [setAltitudeFilter]);

  const isFiltered = altitudeFilter.min > MIN_ALT || altitudeFilter.max < MAX_ALT;

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1 px-2 py-3 bg-bg-primary/70 backdrop-blur-md border border-border-default rounded-lg">
      {/* Header */}
      <button
        onClick={reset}
        className="flex items-center gap-1 text-[9px] font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
        title="Reset altitude filter"
      >
        <ArrowUpDown size={10} />
        <span>ALT</span>
      </button>

      {/* Max label */}
      <span className="text-[8px] font-mono text-text-tertiary">{formatAlt(altitudeFilter.max)}</span>
      <span className="text-[7px] font-mono text-text-tertiary">{formatFt(altitudeFilter.max)}</span>

      {/* Vertical slider track */}
      <div className="relative h-40 w-4 flex flex-col items-center">
        {/* Max slider (top) */}
        <input
          type="range"
          min={MIN_ALT}
          max={MAX_ALT}
          step={STEP}
          value={altitudeFilter.max}
          onChange={handleMaxChange}
          className="absolute h-4 appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] [direction:rtl] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-accent-primary/50 [&::-webkit-slider-runnable-track]:bg-transparent"
          style={{ height: "160px", width: "16px" }}
          title={`Max: ${formatAlt(altitudeFilter.max)}`}
        />
        {/* Min slider (bottom) */}
        <input
          type="range"
          min={MIN_ALT}
          max={MAX_ALT}
          step={STEP}
          value={altitudeFilter.min}
          onChange={handleMinChange}
          className="absolute h-4 appearance-none bg-transparent cursor-pointer [writing-mode:vertical-lr] [direction:rtl] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-orange-400 [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-orange-400/50 [&::-webkit-slider-runnable-track]:bg-transparent"
          style={{ height: "160px", width: "16px" }}
          title={`Min: ${formatAlt(altitudeFilter.min)}`}
        />
        {/* Track background */}
        <div className="absolute inset-x-0 mx-auto w-0.5 h-full bg-border-default rounded-full pointer-events-none">
          {/* Active range indicator */}
          <div
            className="absolute w-full bg-accent-primary/40 rounded-full"
            style={{
              bottom: `${(altitudeFilter.min / MAX_ALT) * 100}%`,
              top: `${100 - (altitudeFilter.max / MAX_ALT) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Min label */}
      <span className="text-[8px] font-mono text-text-tertiary">{formatAlt(altitudeFilter.min)}</span>
      <span className="text-[7px] font-mono text-text-tertiary">{formatFt(altitudeFilter.min)}</span>

      {/* Filter active indicator */}
      {isFiltered && (
        <div className="w-1.5 h-1.5 rounded-full bg-accent-primary mt-1" title="Altitude filter active" />
      )}
    </div>
  );
}
