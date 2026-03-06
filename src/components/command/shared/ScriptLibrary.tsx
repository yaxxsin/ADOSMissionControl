"use client";

/**
 * @module ScriptLibrary
 * @description Left panel showing script templates, user scripts, and management actions.
 * @license GPL-3.0-only
 */

import { useState } from "react";
import { Plus, FileCode, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScriptInfo } from "@/lib/agent/types";

interface ScriptLibraryProps {
  scripts: ScriptInfo[];
  selectedId: string | null;
  onSelect: (script: ScriptInfo) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

export function ScriptLibrary({
  scripts,
  selectedId,
  onSelect,
  onNew,
  onDelete,
}: ScriptLibraryProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  const templates = scripts.filter((s) => s.suite);
  const userScripts = scripts.filter((s) => !s.suite);

  return (
    <div className="flex flex-col w-[220px] border-r border-border-default bg-bg-secondary shrink-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Scripts
        </span>
        <button
          onClick={onNew}
          className="p-1 text-text-tertiary hover:text-accent-primary transition-colors"
          title="New Script"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {templates.length > 0 && (
          <div className="py-2">
            <div className="px-3 pb-1">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                Templates
              </span>
            </div>
            {templates.map((script) => (
              <ScriptItem
                key={script.id}
                script={script}
                selected={selectedId === script.id}
                hovered={hovered === script.id}
                onSelect={() => onSelect(script)}
                onDelete={() => onDelete(script.id)}
                onHover={(h) => setHovered(h ? script.id : null)}
              />
            ))}
          </div>
        )}

        {userScripts.length > 0 && (
          <div className="py-2">
            <div className="px-3 pb-1">
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                My Scripts
              </span>
            </div>
            {userScripts.map((script) => (
              <ScriptItem
                key={script.id}
                script={script}
                selected={selectedId === script.id}
                hovered={hovered === script.id}
                onSelect={() => onSelect(script)}
                onDelete={() => onDelete(script.id)}
                onHover={(h) => setHovered(h ? script.id : null)}
              />
            ))}
          </div>
        )}

        {scripts.length === 0 && (
          <p className="px-3 py-4 text-xs text-text-tertiary text-center">
            No scripts yet
          </p>
        )}
      </div>
    </div>
  );
}

function ScriptItem({
  script,
  selected,
  hovered,
  onSelect,
  onDelete,
  onHover,
}: {
  script: ScriptInfo;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onHover: (h: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-colors",
        selected
          ? "bg-accent-primary/10 text-accent-primary"
          : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary"
      )}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <FileCode size={12} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs truncate block">{script.name}</span>
        {script.suite && (
          <span className="text-[10px] text-text-tertiary">{script.suite}</span>
        )}
      </div>
      {hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-0.5 text-text-tertiary hover:text-status-error transition-colors"
          title="Delete script"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}
