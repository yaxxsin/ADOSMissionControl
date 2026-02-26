/**
 * @module PlanLibraryEmpty
 * @description Empty state for the plan library with call-to-action buttons.
 * @license GPL-3.0-only
 */
"use client";

import { Plus, Import } from "lucide-react";

interface PlanLibraryEmptyProps {
  onNew: () => void;
  onImport: () => void;
}

export function PlanLibraryEmpty({ onNew, onImport }: PlanLibraryEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 gap-3">
      <p className="text-xs text-text-tertiary text-center">
        No flight plans yet
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/10 transition-colors cursor-pointer"
      >
        <Plus size={12} />
        Create First Plan
      </button>
      <button
        onClick={onImport}
        className="flex items-center gap-1.5 text-[10px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
      >
        <Import size={10} />
        Import from file
      </button>
    </div>
  );
}
