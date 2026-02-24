"use client";

import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, X } from "lucide-react";

interface WriteConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  changes: { name: string; oldValue: number; newValue: number }[];
}

export function WriteConfirmDialog({ open, onCancel, onConfirm, changes }: WriteConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title="Confirm Parameter Write" className="max-w-lg">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-status-warning">
          <AlertTriangle size={16} />
          <span className="text-sm">
            {changes.length} parameter{changes.length !== 1 ? "s" : ""} will be written to the flight controller.
          </span>
        </div>

        <div className="max-h-[300px] overflow-y-auto border border-border-default">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-bg-secondary">
              <tr className="border-b border-border-default">
                <th className="px-3 py-2 text-left font-semibold text-text-secondary">Parameter</th>
                <th className="px-3 py-2 text-right font-semibold text-text-secondary">Old</th>
                <th className="px-3 py-2 text-right font-semibold text-text-secondary">New</th>
              </tr>
            </thead>
            <tbody>
              {changes.map(({ name, oldValue, newValue }) => (
                <tr key={name} className="border-b border-border-default">
                  <td className="px-3 py-1.5 font-mono text-text-primary">{name}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-text-tertiary">{oldValue}</td>
                  <td className="px-3 py-1.5 text-right font-mono text-status-warning">{newValue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" icon={<X size={12} />} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" icon={<Check size={12} />} onClick={onConfirm}>
            Write {changes.length} Parameter{changes.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
