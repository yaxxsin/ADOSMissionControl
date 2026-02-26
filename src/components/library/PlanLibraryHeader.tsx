/**
 * @module PlanLibraryHeader
 * @description Header bar for the flight plan library: title, new plan button, collapse button.
 * @license GPL-3.0-only
 */
"use client";

import { Plus, ChevronLeft } from "lucide-react";

interface PlanLibraryHeaderProps {
  onNew: () => void;
  onCollapse: () => void;
}

export function PlanLibraryHeader({ onNew, onCollapse }: PlanLibraryHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Flight Plans
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={onNew}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          title="New plan"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={onCollapse}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
          title="Collapse panel"
        >
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}
