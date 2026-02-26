/**
 * @module UnsavedChangesDialog
 * @description Dialog shown when switching plans with unsaved changes.
 * Three options: Save & Switch, Discard & Switch, Cancel.
 * @license GPL-3.0-only
 */
"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  open: boolean;
  onSaveAndSwitch: () => void;
  onDiscardAndSwitch: () => void;
  onCancel: () => void;
}

export function UnsavedChangesDialog({
  open,
  onSaveAndSwitch,
  onDiscardAndSwitch,
  onCancel,
}: UnsavedChangesDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Unsaved Changes" className="max-w-sm">
      <div className="flex flex-col gap-4">
        <p className="text-xs text-text-secondary">
          You have unsaved changes to the current plan. What would you like to do?
        </p>
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="md" className="w-full" onClick={onSaveAndSwitch}>
            Save & Switch
          </Button>
          <Button variant="secondary" size="md" className="w-full" onClick={onDiscardAndSwitch}>
            Discard & Switch
          </Button>
          <Button variant="ghost" size="md" className="w-full" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
}
