"use client";

import { useParamSafetyStore } from "@/stores/param-safety-store";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DisconnectGuardProps {
  open: boolean;
  onCommitAndDisconnect: () => void;
  onDiscardAndDisconnect: () => void;
  onCancel: () => void;
}

export function DisconnectGuard({
  open,
  onCommitAndDisconnect,
  onDiscardAndDisconnect,
  onCancel,
}: DisconnectGuardProps) {
  const pendingCount = useParamSafetyStore((s) => s.pendingWrites.size);
  const hasCritical = useParamSafetyStore((s) => s.hasCriticalPending());

  if (!open || pendingCount === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-primary border border-border-default w-[400px] p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-status-warning shrink-0" />
          <h2 className="text-sm font-semibold text-text-primary">Uncommitted Parameter Changes</h2>
        </div>

        <p className="text-xs text-text-secondary">
          {pendingCount} parameter{pendingCount !== 1 ? "s have" : " has"} been written to RAM but not committed to flash.
          Disconnecting now will lose these changes on next reboot.
        </p>

        {hasCritical && (
          <div className="p-2 bg-status-error/10 border border-status-error/20">
            <p className="text-[10px] text-status-error font-medium">
              Includes safety-critical parameters (failsafe, battery, motor, arming).
            </p>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2">
          <Button variant="primary" size="sm" onClick={onCommitAndDisconnect}>
            Commit to Flash & Disconnect
          </Button>
          <Button variant="danger" size="sm" onClick={onDiscardAndDisconnect}>
            Discard & Disconnect
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
