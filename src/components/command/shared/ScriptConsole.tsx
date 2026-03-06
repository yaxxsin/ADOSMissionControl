"use client";

/**
 * @module ScriptConsole
 * @description Console output panel for script execution results.
 * @license GPL-3.0-only
 */

import { useRef, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScriptRunResult } from "@/lib/agent/types";

interface ScriptConsoleProps {
  output: ScriptRunResult | null;
  isRunning: boolean;
}

export function ScriptConsole({ output, isRunning }: ScriptConsoleProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"stdout" | "stderr">("stdout");

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  const hasStderr = output?.stderr && output.stderr.length > 0;

  return (
    <div className="border border-border-default rounded-lg overflow-hidden bg-bg-secondary">
      <div className="flex items-center gap-1 px-2 py-1 border-b border-border-default">
        <button
          onClick={() => setActiveTab("stdout")}
          className={cn(
            "px-2 py-0.5 text-[10px] rounded transition-colors",
            activeTab === "stdout"
              ? "bg-bg-tertiary text-text-primary"
              : "text-text-tertiary hover:text-text-secondary"
          )}
        >
          stdout
        </button>
        <button
          onClick={() => setActiveTab("stderr")}
          className={cn(
            "px-2 py-0.5 text-[10px] rounded transition-colors",
            activeTab === "stderr"
              ? "bg-bg-tertiary text-text-primary"
              : "text-text-tertiary hover:text-text-secondary",
            hasStderr && "text-status-error"
          )}
        >
          stderr
          {hasStderr && " *"}
        </button>
        {output && (
          <div className="flex items-center gap-2 ml-auto text-[10px] text-text-tertiary">
            <span
              className={cn(
                "font-mono",
                output.exitCode === 0 ? "text-status-success" : "text-status-error"
              )}
            >
              exit {output.exitCode}
            </span>
            <span className="font-mono">{output.durationMs}ms</span>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="h-[160px] overflow-y-auto p-2 font-mono text-xs"
      >
        {isRunning && (
          <div className="text-accent-primary animate-pulse">
            Running script...
          </div>
        )}
        {!isRunning && !output && (
          <div className="text-text-tertiary">
            Script output will appear here
          </div>
        )}
        {!isRunning && output && (
          <pre className="whitespace-pre-wrap text-text-secondary">
            {activeTab === "stdout" ? output.stdout : output.stderr || "(no stderr)"}
          </pre>
        )}
      </div>
    </div>
  );
}
