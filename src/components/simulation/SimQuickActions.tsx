/**
 * @module SimQuickActions
 * @description Quick action buttons: Edit in Planner, Export.
 * @license GPL-3.0-only
 */
"use client";

import { useRouter } from "next/navigation";
import { Pencil, FileDown } from "lucide-react";
import { useMissionStore } from "@/stores/mission-store";
import { useToast } from "@/components/ui/toast";
import { exportWaypointsFormat } from "@/lib/mission-io";
import { usePlanLibraryStore } from "@/stores/plan-library-store";

export function SimQuickActions() {
  const router = useRouter();
  const waypoints = useMissionStore((s) => s.waypoints);
  const activePlanId = usePlanLibraryStore((s) => s.activePlanId);
  const plans = usePlanLibraryStore((s) => s.plans);
  const { toast } = useToast();

  const activePlan = plans.find((p) => p.id === activePlanId);

  const handleEditInPlanner = () => {
    router.push("/plan");
  };

  const handleExport = () => {
    if (waypoints.length === 0) return;
    const name = activePlan?.name || "simulation";
    exportWaypointsFormat(waypoints, name);
    toast("Exported .waypoints", "success");
  };

  return (
    <div className="px-3 py-3 border-t border-border-default">
      <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
        Quick Actions
      </h3>
      <div className="flex gap-1.5">
        <button
          onClick={handleEditInPlanner}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer"
        >
          <Pencil size={10} />
          Edit in Planner
        </button>
        <button
          onClick={handleExport}
          disabled={waypoints.length === 0}
          className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer disabled:opacity-50"
        >
          <FileDown size={10} />
          Export
        </button>
      </div>
    </div>
  );
}
