"use client";

import { Select } from "@/components/ui/select";
import type { FlightMode } from "@/lib/types";

interface FlightModeSelectorProps {
  value: FlightMode;
  onChange: (mode: FlightMode) => void;
  className?: string;
}

const FLIGHT_MODES: { value: FlightMode; label: string }[] = [
  { value: "STABILIZE", label: "Stabilize" },
  { value: "ALT_HOLD", label: "Alt Hold" },
  { value: "LOITER", label: "Loiter" },
  { value: "GUIDED", label: "Guided" },
  { value: "AUTO", label: "Auto" },
  { value: "RTL", label: "RTL" },
  { value: "LAND", label: "Land" },
  { value: "MANUAL", label: "Manual" },
  { value: "ACRO", label: "Acro" },
  { value: "FBWA", label: "FBWA" },
  { value: "FBWB", label: "FBWB" },
  { value: "CRUISE", label: "Cruise" },
  { value: "AUTOTUNE", label: "Autotune" },
  { value: "CIRCLE", label: "Circle" },
  { value: "TRAINING", label: "Training" },
  { value: "QSTABILIZE", label: "QStabilize" },
  { value: "QHOVER", label: "QHover" },
  { value: "QLOITER", label: "QLoiter" },
  { value: "QLAND", label: "QLand" },
  { value: "QRTL", label: "QRTL" },
  { value: "POSHOLD", label: "PosHold" },
  { value: "BRAKE", label: "Brake" },
  { value: "SMART_RTL", label: "Smart RTL" },
  { value: "DRIFT", label: "Drift" },
  { value: "SPORT", label: "Sport" },
  { value: "FLIP", label: "Flip" },
  { value: "THROW", label: "Throw" },
  { value: "QAUTOTUNE", label: "QAutotune" },
  { value: "QACRO", label: "QAcro" },
  { value: "AVOID_ADSB", label: "Avoid ADS-B" },
  { value: "THERMAL", label: "Thermal" },
];

export function FlightModeSelector({ value, onChange, className }: FlightModeSelectorProps) {
  return (
    <Select
      options={FLIGHT_MODES}
      value={value}
      onChange={(v) => onChange(v as FlightMode)}
      className={className}
    />
  );
}
