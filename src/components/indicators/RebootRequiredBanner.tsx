"use client";

import { useDroneManager } from "@/stores/drone-manager";
import { cn } from "@/lib/utils";
import { RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Amber banner shown when parameter changes require a FC reboot.
 * Tracks params with rebootRequired metadata flag.
 */
export function RebootRequiredBanner({
  rebootParams,
  className,
}: {
  /** List of param names that need a reboot to take effect */
  rebootParams: string[];
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  const protocol = useDroneManager.getState().getSelectedProtocol();

  if (dismissed || rebootParams.length === 0) return null;

  async function handleReboot() {
    if (!protocol) return;
    await protocol.reboot();
  }

  return (
    <div className={cn(
      "mx-3 mb-2 rounded border border-status-warning/50 bg-status-warning/10 px-3 py-2 text-xs",
      className,
    )}>
      <div className="flex items-center gap-2">
        <RotateCcw size={14} className="text-status-warning shrink-0" />
        <span className="flex-1 text-text-primary">
          Reboot required for {rebootParams.length} parameter{rebootParams.length !== 1 ? "s" : ""} to take effect
        </span>
        <Button size="sm" variant="ghost" onClick={handleReboot}>
          Reboot FC
        </Button>
        <button onClick={() => setDismissed(true)} className="text-text-tertiary hover:text-text-primary">
          <X size={12} />
        </button>
      </div>
      <div className="mt-1 text-[10px] font-mono text-text-tertiary">
        {rebootParams.join(", ")}
      </div>
    </div>
  );
}
