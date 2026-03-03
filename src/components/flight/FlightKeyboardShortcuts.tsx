/**
 * @module FlightKeyboardShortcuts
 * @description Collapsible keyboard shortcuts reference for the flight actions panel.
 * Lists all Shift+key shortcuts for flight commands.
 * @license GPL-3.0-only
 */

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Keyboard } from "lucide-react";

const SHORTCUTS = [
  { key: "Shift+A", action: "Arm / Disarm" },
  { key: "Shift+T", action: "Takeoff" },
  { key: "Shift+L", action: "Land" },
  { key: "Shift+P", action: "Pause / Hold / Resume" },
  { key: "Shift+R", action: "Return to Home" },
  { key: "Shift+X", action: "Abort" },
];

export function FlightKeyboardShortcuts() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 text-[10px] font-mono text-text-tertiary uppercase tracking-wider hover:text-text-secondary cursor-pointer"
      >
        <Keyboard size={12} />
        Flight Shortcuts
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="mt-2 space-y-1">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <kbd className="inline-block min-w-[28px] text-center px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px] font-mono text-text-secondary">
                {s.key}
              </kbd>
              <span className="text-xs text-text-tertiary">{s.action}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
