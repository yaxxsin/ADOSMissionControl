/**
 * @module DefaultsSection
 * @description Default values form for new waypoints — altitude, speed,
 * accept radius, and altitude reference frame.
 * @license GPL-3.0-only
 */
"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { AltitudeFrame } from "@/lib/types";

const FRAME_OPTIONS: { value: AltitudeFrame; label: string }[] = [
  { value: "relative", label: "Relative (AGL)" },
  { value: "absolute", label: "Absolute (MSL)" },
  { value: "terrain", label: "Terrain Following" },
];

interface DefaultsSectionProps {
  defaultAlt: number;
  defaultSpeed: number;
  defaultAcceptRadius: number;
  defaultFrame: AltitudeFrame;
  onAltChange: (alt: number) => void;
  onSpeedChange: (speed: number) => void;
  onRadiusChange: (radius: number) => void;
  onFrameChange: (frame: AltitudeFrame) => void;
}

export function DefaultsSection({
  defaultAlt,
  defaultSpeed,
  defaultAcceptRadius,
  defaultFrame,
  onAltChange,
  onSpeedChange,
  onRadiusChange,
  onFrameChange,
}: DefaultsSectionProps) {
  return (
    <div className="flex flex-col gap-2 px-3 py-2">
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Default Alt"
          type="number"
          unit="m"
          value={String(defaultAlt)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) onAltChange(v);
          }}
          onChange={() => {}}
        />
        <Input
          label="Default Speed"
          type="number"
          unit="m/s"
          value={String(defaultSpeed)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) onSpeedChange(v);
          }}
          onChange={() => {}}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Accept Radius"
          type="number"
          unit="m"
          value={String(defaultAcceptRadius)}
          onBlur={(e) => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v) && v > 0) onRadiusChange(v);
          }}
          onChange={() => {}}
        />
        <Select
          label="Alt Frame"
          options={FRAME_OPTIONS}
          value={defaultFrame}
          onChange={(v) => onFrameChange(v as AltitudeFrame)}
        />
      </div>
      {defaultFrame === "terrain" && (
        <p className="text-[10px] text-text-tertiary font-mono px-0.5">
          Waypoint altitudes will be adjusted to maintain constant height above ground
        </p>
      )}
    </div>
  );
}
