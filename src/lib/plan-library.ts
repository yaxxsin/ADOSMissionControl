/**
 * @module plan-library
 * @description Utility functions for the flight plan library.
 * Search, sort, tree building, distance calculation, time formatting.
 * @license GPL-3.0-only
 */

import type { SavedPlan, PlanFolder, Waypoint } from "@/lib/types";

/** Filter plans by search query (matches name). */
export function filterPlans(plans: SavedPlan[], query: string): SavedPlan[] {
  if (!query.trim()) return plans;
  const q = query.toLowerCase();
  return plans.filter((p) => p.name.toLowerCase().includes(q));
}

/** Sort plans by the given field and direction. */
export function sortPlans(
  plans: SavedPlan[],
  sortBy: "name" | "date" | "waypoints",
  direction: "asc" | "desc"
): SavedPlan[] {
  const sorted = [...plans].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name);
      case "date":
        return a.updatedAt - b.updatedAt;
      case "waypoints":
        return a.waypoints.length - b.waypoints.length;
    }
  });
  return direction === "desc" ? sorted.reverse() : sorted;
}

/** Build a tree of folders and plans for rendering. */
export interface TreeNode {
  type: "folder" | "plan";
  folder?: PlanFolder;
  plan?: SavedPlan;
  children: TreeNode[];
}

export function buildTree(plans: SavedPlan[], folders: PlanFolder[]): TreeNode[] {
  const tree: TreeNode[] = [];

  // Add folders first
  const sortedFolders = [...folders].sort((a, b) => a.order - b.order);
  for (const folder of sortedFolders) {
    if (folder.parentId === null) {
      const folderPlans = plans
        .filter((p) => p.folderId === folder.id)
        .map((p) => ({ type: "plan" as const, plan: p, children: [] }));
      tree.push({ type: "folder", folder, children: folderPlans });
    }
  }

  // Add root-level plans (no folder)
  const rootPlans = plans.filter((p) => p.folderId === null);
  for (const plan of rootPlans) {
    tree.push({ type: "plan", plan, children: [] });
  }

  return tree;
}

/** Calculate total distance (meters) for a waypoint array using Haversine. */
export function totalDistance(waypoints: Waypoint[]): number {
  let dist = 0;
  for (let i = 1; i < waypoints.length; i++) {
    dist += haversine(
      waypoints[i - 1].lat, waypoints[i - 1].lon,
      waypoints[i].lat, waypoints[i].lon
    );
  }
  return dist;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Format a relative time ago string. */
export function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

/** Format distance for display. */
export function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${Math.round(meters)}m`;
}
