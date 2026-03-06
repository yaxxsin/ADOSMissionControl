"use client";

import { useState, useEffect, useCallback } from "react";
import { Package, Download, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/stores/agent-store";
import type { MockModule } from "@/mock/mock-agent";

export function ModuleStoreTab() {
  const connected = useAgentStore((s) => s.connected);
  const [modules, setModules] = useState<MockModule[]>([]);

  useEffect(() => {
    if (!connected) return;
    import("@/mock/mock-agent").then((mod) =>
      setModules(mod.MOCK_MODULES.map((m) => ({ ...m })))
    );
  }, [connected]);

  const handleInstall = useCallback((name: string) => {
    setModules((prev) =>
      prev.map((m) =>
        m.name === name ? { ...m, installed: true } : m
      )
    );
  }, []);

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3 max-w-sm">
          <Package size={32} className="text-text-tertiary mx-auto" />
          <h3 className="text-sm font-medium text-text-primary">
            Module Store
          </h3>
          <p className="text-xs text-text-tertiary leading-relaxed">
            Connect to an agent to manage modules.
          </p>
        </div>
      </div>
    );
  }

  const installed = modules.filter((m) => m.installed);
  const available = modules.filter((m) => !m.installed);

  return (
    <div className="p-4 max-w-3xl space-y-4">
      {/* Installed */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
          Installed ({installed.length})
        </h3>
        <div className="space-y-2">
          {installed.map((mod) => (
            <div
              key={mod.name}
              className="flex items-center justify-between border border-border-default rounded-lg p-3 bg-bg-secondary"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {mod.name}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary">
                    v{mod.version}
                  </span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-status-success/15 text-status-success">
                    <Check size={10} />
                    Installed
                  </span>
                </div>
                <p className="text-xs text-text-tertiary mt-0.5">
                  {mod.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      {available.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-3">
            Available ({available.length})
          </h3>
          <div className="space-y-2">
            {available.map((mod) => (
              <div
                key={mod.name}
                className="flex items-center justify-between border border-border-default rounded-lg p-3 bg-bg-secondary"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {mod.name}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary">
                      v{mod.version}
                    </span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">
                    {mod.description}
                  </p>
                </div>
                <button
                  onClick={() => handleInstall(mod.name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-primary text-white rounded hover:opacity-90 transition-opacity shrink-0 ml-3"
                >
                  <Download size={12} />
                  Install
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
