/**
 * @module TimelineScrubber
 * @description Horizontal time bar at bottom of viewport for viewing
 * time-dependent restrictions (TFRs, NOTAMs). "Now" button snaps to current time.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback } from "react";
import { Clock, RotateCcw } from "lucide-react";
import { useAirspaceStore } from "@/stores/airspace-store";

export function TimelineScrubber() {
  const timelineTime = useAirspaceStore((s) => s.timelineTime);
  const setTimelineTime = useAirspaceStore((s) => s.setTimelineTime);

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const currentMinutes = Math.round(
    (timelineTime.getTime() - startOfDay.getTime()) / (60 * 1000)
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const minutes = parseInt(e.target.value, 10);
      const newTime = new Date(startOfDay.getTime() + minutes * 60 * 1000);
      setTimelineTime(newTime);
    },
    [startOfDay, setTimelineTime]
  );

  const snapToNow = useCallback(() => {
    setTimelineTime(new Date());
  }, [setTimelineTime]);

  // Round to 5-minute step granularity for "Now" detection
  const isNow = Math.abs(timelineTime.getTime() - now.getTime()) < 5 * 60 * 1000;

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 bg-bg-primary/70 backdrop-blur-md border border-border-default rounded-lg">
      <Clock size={12} className="text-text-tertiary shrink-0" />

      <span className="text-[10px] font-mono text-text-tertiary w-10">00:00</span>

      <input
        type="range"
        min={0}
        max={1440}
        step={5}
        value={currentMinutes}
        onChange={handleChange}
        className="w-48 h-1 rounded-full appearance-none bg-border-default accent-accent-primary cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent-primary"
      />

      <span className="text-[10px] font-mono text-text-tertiary w-10 text-right">23:59</span>

      <div className="flex items-center gap-2 pl-2 border-l border-border-default">
        <span className="text-[11px] font-mono text-text-primary font-bold w-12">
          {formatTime(timelineTime)}
        </span>

        <button
          onClick={snapToNow}
          className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
            isNow
              ? "bg-accent-primary/20 text-accent-primary"
              : "bg-bg-secondary text-text-secondary hover:text-text-primary"
          }`}
        >
          <RotateCcw size={10} className="inline mr-1" />
          NOW
        </button>
      </div>
    </div>
  );
}
