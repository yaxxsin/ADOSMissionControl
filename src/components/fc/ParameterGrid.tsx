"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { ParameterValue } from "@/lib/protocol/types";

/** MAV_PARAM_TYPE display names. */
const PARAM_TYPE_LABELS: Record<number, string> = {
  1: "UINT8",
  2: "INT8",
  3: "UINT16",
  4: "INT16",
  5: "UINT32",
  6: "INT32",
  8: "UINT64",
  9: "INT64",
  10: "REAL32",
  11: "REAL64",
};

interface ParameterGridProps {
  parameters: ParameterValue[];
  modified: Map<string, number>;
  onModify: (name: string, value: number) => void;
  filter: string;
}

export function ParameterGrid({ parameters, modified, onModify, filter }: ParameterGridProps) {
  const [editingParam, setEditingParam] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!filter) return parameters;
    const lower = filter.toLowerCase();
    return parameters.filter((p) => p.name.toLowerCase().includes(lower));
  }, [parameters, filter]);

  const startEdit = useCallback((param: ParameterValue) => {
    const current = modified.has(param.name)
      ? modified.get(param.name)!
      : param.value;
    setEditingParam(param.name);
    setEditValue(String(current));
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [modified]);

  const commitEdit = useCallback((name: string) => {
    const num = parseFloat(editValue);
    if (!isNaN(num)) {
      onModify(name, num);
    }
    setEditingParam(null);
  }, [editValue, onModify]);

  const cancelEdit = useCallback(() => {
    setEditingParam(null);
  }, []);

  return (
    <div className="overflow-auto flex-1">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-bg-secondary z-10">
          <tr className="border-b border-border-default">
            <th className="px-3 py-2 text-left font-semibold text-text-secondary uppercase tracking-wider w-[60px]">#</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary uppercase tracking-wider">Name</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary uppercase tracking-wider w-[160px]">Value</th>
            <th className="px-3 py-2 text-left font-semibold text-text-secondary uppercase tracking-wider w-[80px]">Type</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((param) => {
            const isModified = modified.has(param.name);
            const displayValue = isModified ? modified.get(param.name)! : param.value;
            const isEditing = editingParam === param.name;

            return (
              <tr
                key={param.name}
                className={cn(
                  "border-b border-border-default h-8 transition-colors",
                  isModified && "bg-status-warning/5"
                )}
              >
                <td className="px-3 text-text-tertiary font-mono">{param.index}</td>
                <td className="px-3 font-mono text-text-primary">{param.name}</td>
                <td className="px-3">
                  {isEditing ? (
                    <input
                      ref={inputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit(param.name);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      onBlur={() => commitEdit(param.name)}
                      className="w-full h-6 px-1.5 bg-bg-tertiary border border-accent-primary text-xs font-mono text-text-primary focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => startEdit(param)}
                      className={cn(
                        "w-full h-6 px-1.5 text-left font-mono cursor-pointer transition-colors hover:bg-bg-tertiary",
                        isModified
                          ? "text-status-warning border border-status-warning/40"
                          : "text-text-primary border border-transparent"
                      )}
                    >
                      {displayValue}
                    </button>
                  )}
                </td>
                <td className="px-3 text-text-tertiary font-mono">
                  {PARAM_TYPE_LABELS[param.type] ?? `T${param.type}`}
                </td>
              </tr>
            );
          })}
          {filtered.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-8 text-center text-text-tertiary">
                {parameters.length === 0 ? "No parameters loaded" : "No matching parameters"}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
