"use client";

import { useState, useMemo } from "react";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { DroneCard } from "@/components/shared/drone-card";
import { useConnectDialogStore } from "@/stores/connect-dialog-store";
import { Plus, Search, ChevronLeft } from "lucide-react";

interface DroneListPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export function DroneListPanel({ collapsed, onToggleCollapse }: DroneListPanelProps) {
  const drones = useFleetStore((s) => s.drones);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);

  const [search, setSearch] = useState("");
  const openDialog = useConnectDialogStore((s) => s.openDialog);

  const filtered = useMemo(() => {
    if (!search.trim()) return drones;
    const q = search.toLowerCase();
    return drones.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        (d.suiteName && d.suiteName.toLowerCase().includes(q))
    );
  }, [drones, search]);

  if (collapsed) {
    return (
      <button
        onClick={onToggleCollapse}
        className="w-10 shrink-0 flex flex-col items-center justify-center h-full border-r border-border-default bg-bg-secondary hover:bg-bg-tertiary transition-colors cursor-pointer group"
        title="Expand fleet panel"
      >
        <span
          className="text-[10px] font-semibold uppercase tracking-widest text-text-tertiary group-hover:text-text-secondary transition-colors"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Fleet
        </span>
      </button>
    );
  }

  return (
    <div className="w-64 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Fleet
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={openDialog}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            title="Collapse fleet panel"
          >
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border-default">
        <div className="flex items-center gap-2 px-2 py-1 bg-bg-primary border border-border-default">
          <Search size={12} className="text-text-tertiary shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search drones..."
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </div>

      {/* Drone list */}
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
            {search ? "No drones match search" : "No drones"}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border-default">
        <span className="text-[10px] text-text-tertiary">
          {drones.length} drone{drones.length !== 1 ? "s" : ""}
        </span>
      </div>

    </div>
  );
}
