"use client";

import { useState, useMemo } from "react";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { DroneCard } from "@/components/shared/drone-card";
import { DroneTile } from "@/components/shared/drone-tile";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

interface CommandFleetPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function CommandFleetPanel({ collapsed, onToggleCollapse }: CommandFleetPanelProps) {
  const drones = useFleetStore((s) => s.drones);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);

  const [search, setSearch] = useState("");

  const agentDrones = useMemo(() => drones.filter((d) => d.hasAgent), [drones]);

  const filtered = useMemo(() => {
    if (!search.trim()) return agentDrones;
    const q = search.toLowerCase();
    return agentDrones.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.suiteName && d.suiteName.toLowerCase().includes(q))
    );
  }, [agentDrones, search]);

  if (collapsed) {
    return (
      <div className="w-12 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
        <div className="flex flex-col items-center gap-1.5 px-1 py-2 border-b border-border-default">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
            ADOS
          </span>
          <button
            onClick={onToggleCollapse}
            className="w-full aspect-square flex items-center justify-center hover:bg-bg-tertiary transition-colors cursor-pointer group"
            title="Expand fleet panel"
          >
            <ChevronRight size={12} className="text-text-tertiary group-hover:text-text-secondary transition-colors" />
          </button>
        </div>

        <div className="flex-1 overflow-auto flex flex-col items-center gap-1 py-1.5">
          {agentDrones.map((drone) => (
            <DroneTile
              key={drone.id}
              drone={drone}
              selected={drone.id === selectedDroneId}
              onClick={selectDrone}
            />
          ))}
        </div>

        <div className="text-center py-1 border-t border-border-default">
          <span className="text-[9px] text-text-tertiary font-mono">{agentDrones.length}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          ADOS Fleet
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          title="Collapse fleet panel"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border-default">
        <div className="flex items-center gap-2 px-2 py-1 bg-bg-primary border border-border-default">
          <Search size={12} className="text-text-tertiary shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2 flex flex-col gap-2">
        {filtered.map((drone) => (
          <DroneCard
            key={drone.id}
            drone={drone}
            selected={drone.id === selectedDroneId}
            onClick={selectDrone}
          />
        ))}
        {filtered.length === 0 && (
          <div className="text-xs text-text-tertiary text-center py-4">
            {search ? "No agents match search" : "No ADOS agents"}
          </div>
        )}
      </div>

      <div className="px-3 py-1.5 border-t border-border-default">
        <span className="text-[10px] text-text-tertiary">
          {agentDrones.length} agent{agentDrones.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
