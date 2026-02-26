/**
 * @module PlanLibraryFooter
 * @description Footer bar with plan count and import button.
 * @license GPL-3.0-only
 */
"use client";

import { Import } from "lucide-react";

interface PlanLibraryFooterProps {
  count: number;
  onImport: () => void;
}

export function PlanLibraryFooter({ count, onImport }: PlanLibraryFooterProps) {
  return (
    <div className="px-3 py-1.5 border-t border-border-default flex items-center justify-between">
      <span className="text-[10px] text-text-tertiary">
        {count} plan{count !== 1 ? "s" : ""}
      </span>
      <button
        onClick={onImport}
        className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
        title="Import plan file"
      >
        <Import size={10} />
        Import
      </button>
    </div>
  );
}
