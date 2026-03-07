/**
 * @module AltitudeSlider
 * @description Vertical slider on the right side of the viewport.
 * Sets operational altitude for filtering which zones are shown as restricted.
 * Uses a rotated horizontal slider for cross-browser compatibility.
 * @license GPL-3.0-only
 */

"use client";

import { useAirspaceStore } from "@/stores/airspace-store";

export function AltitudeSlider() {
  const altitude = useAirspaceStore((s) => s.operationalAltitude);
  const setAltitude = useAirspaceStore((s) => s.setOperationalAltitude);

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-2">
      {/* Value label */}
      <div className="bg-bg-primary/70 backdrop-blur-md border border-border-default rounded px-2 py-1">
        <span className="text-[10px] font-mono font-bold text-text-primary">
          {altitude}m
        </span>
      </div>

      {/* Vertical slider via CSS rotation of a horizontal range input */}
      <div className="relative w-6 h-48 flex items-center justify-center">
        <input
          type="range"
          min={0}
          max={500}
          step={10}
          value={altitude}
          onChange={(e) => setAltitude(parseInt(e.target.value, 10))}
          className="absolute w-48 appearance-none bg-transparent cursor-pointer origin-center -rotate-90 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-border-default [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary [&::-webkit-slider-thumb]:-mt-[5px] [&::-moz-range-track]:h-1 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-border-default [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent-primary [&::-moz-range-thumb]:border-0"
        />
      </div>

      {/* Label */}
      <div className="bg-bg-primary/70 backdrop-blur-md border border-border-default rounded px-2 py-1">
        <span className="text-[9px] font-mono text-text-tertiary uppercase">Alt</span>
      </div>
    </div>
  );
}
