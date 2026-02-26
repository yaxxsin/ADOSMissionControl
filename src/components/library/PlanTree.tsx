/**
 * @module PlanTree
 * @description Renders the plan library as a list with optional folder grouping.
 * @license GPL-3.0-only
 */
"use client";

import type { SavedPlan, PlanFolder } from "@/lib/types";
import { usePlanLibraryStore } from "@/stores/plan-library-store";
import { PlanTreeFolder } from "./PlanTreeFolder";
import { PlanTreeItem } from "./PlanTreeItem";

interface PlanTreeProps {
  plans: SavedPlan[];
  folders: PlanFolder[];
  activePlanId: string | null;
  isDirty: boolean;
  expandedFolders: string[];
  context: "plan" | "simulate";
  onSelect: (planId: string) => void;
  /** Save handler for inline save button on active+dirty items. */
  onSave?: () => void;
  /** Called when a plan is renamed via context menu (syncs planner state for active plan). */
  onPlanRenamed?: (name: string) => void;
}

export function PlanTree({
  plans,
  folders,
  activePlanId,
  isDirty,
  expandedFolders,
  context,
  onSelect,
  onSave,
  onPlanRenamed,
}: PlanTreeProps) {
  const toggleFolder = usePlanLibraryStore((s) => s.toggleFolder);

  // Separate folder plans from root plans
  const folderMap = new Map<string, SavedPlan[]>();
  const rootPlans: SavedPlan[] = [];

  for (const plan of plans) {
    if (plan.folderId) {
      const arr = folderMap.get(plan.folderId) || [];
      arr.push(plan);
      folderMap.set(plan.folderId, arr);
    } else {
      rootPlans.push(plan);
    }
  }

  const sortedFolders = [...folders].sort((a, b) => a.order - b.order);

  return (
    <div className="p-2 flex flex-col gap-0.5">
      {sortedFolders.map((folder) => {
        const folderPlans = folderMap.get(folder.id) || [];
        if (folderPlans.length === 0) return null;
        return (
          <PlanTreeFolder
            key={folder.id}
            folder={folder}
            expanded={expandedFolders.includes(folder.id)}
            onToggle={() => toggleFolder(folder.id)}
            count={folderPlans.length}
          >
            {folderPlans.map((plan) => (
              <PlanTreeItem
                key={plan.id}
                plan={plan}
                isActive={plan.id === activePlanId}
                isDirty={plan.id === activePlanId && isDirty}
                context={context}
                onSelect={() => onSelect(plan.id)}
                onSave={plan.id === activePlanId ? onSave : undefined}
                onPlanRenamed={plan.id === activePlanId ? onPlanRenamed : undefined}
              />
            ))}
          </PlanTreeFolder>
        );
      })}

      {rootPlans.map((plan) => (
        <PlanTreeItem
          key={plan.id}
          plan={plan}
          isActive={plan.id === activePlanId}
          isDirty={plan.id === activePlanId && isDirty}
          context={context}
          onSelect={() => onSelect(plan.id)}
          onSave={plan.id === activePlanId ? onSave : undefined}
          onPlanRenamed={plan.id === activePlanId ? onPlanRenamed : undefined}
        />
      ))}
    </div>
  );
}
