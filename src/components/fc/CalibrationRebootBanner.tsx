"use client";

import { Button } from "@/components/ui/button";

export function CalibrationRebootBanner({
  label,
  onReboot,
}: {
  label: string;
  onReboot: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border border-status-warning/30 bg-status-warning/10 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-status-warning">Reboot Required</p>
        <p className="text-xs text-text-secondary mt-0.5">
          {label}. Reboot the flight controller to apply.
        </p>
      </div>
      <Button variant="primary" size="sm" onClick={onReboot}>
        Reboot FC
      </Button>
    </div>
  );
}
