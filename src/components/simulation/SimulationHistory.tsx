/**
 * @module SimulationHistory
 * @description Collapsible list of recent simulation runs.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Clock, Trash2 } from "lucide-react";
import { useSimHistoryStore } from "@/stores/simulation-history-store";
import { timeAgo } from "@/lib/plan-library";
import { formatDuration } from "@/lib/utils";

export function SimulationHistory() {
  const entries = useSimHistoryStore((s) => s.entries);
  const clearHistory = useSimHistoryStore((s) => s.clearHistory);
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) return null;

  return (
    <div className="border-t border-border-default">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-tertiary transition-colors cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={10} className="text-text-tertiary" />
        ) : (
          <ChevronRight size={10} className="text-text-tertiary" />
        )}
        <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
          History ({entries.length})
        </h3>
      </button>

      {expanded && (
        <div className="px-3 pb-2">
          <div className="space-y-1">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-1.5 py-1"
              >
                <Clock size={10} className="text-text-tertiary shrink-0" />
                <span className="text-[10px] font-mono text-text-primary truncate flex-1">
                  {entry.planName}
                </span>
                <span className="text-[10px] font-mono text-text-tertiary">
                  {formatDuration(entry.duration)}
                </span>
                <span className="text-[10px] font-mono text-text-tertiary">
                  {timeAgo(entry.timestamp)}
                </span>
              </div>
            ))}
          </div>
          <button
            onClick={clearHistory}
            className="flex items-center gap-1 mt-2 text-[10px] text-text-tertiary hover:text-status-error transition-colors cursor-pointer"
          >
            <Trash2 size={10} />
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}
