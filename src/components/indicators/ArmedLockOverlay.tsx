"use client";

import { useArmedLock } from "@/hooks/use-armed-lock";
import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Full-panel overlay that blocks config interactions while the vehicle is armed.
 * Wraps FC panel content — renders children normally when disarmed,
 * overlays with a blocking message when armed.
 */
export function ArmedLockOverlay({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { isLocked, lockMessage } = useArmedLock();

  return (
    <div className={cn("relative", className)}>
      {children}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg-primary/80 backdrop-blur-sm">
          <ShieldAlert size={32} className="text-status-warning" />
          <p className="text-sm text-text-secondary text-center max-w-xs">
            {lockMessage}
          </p>
        </div>
      )}
    </div>
  );
}
