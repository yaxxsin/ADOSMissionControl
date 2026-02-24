/**
 * @module mission-io
 * @description Mission save/load/autosave utilities for the .altmission file format.
 *
 * File format: `.altmission` — JSON with `{ version, metadata, waypoints }`.
 * Autosave uses a 2-second debounce timer writing to IndexedDB under
 * the key `altcmd_autosave`. Call {@link cancelAutoSave} on page unmount
 * to prevent stale timer fires after navigation.
 *
 * Data persisted via idb-keyval (IndexedDB). On first load, any existing
 * localStorage data is migrated to IndexedDB automatically.
 *
 * @license GPL-3.0-only
 */

import { get, set, del } from "idb-keyval";
import type { Waypoint, WaypointCommand, SuiteType } from "@/lib/types";

const AUTOSAVE_KEY = "altcmd_autosave";
const RECENT_KEY = "altcmd_recent_missions";
const MAX_RECENT = 10;

/** MAVLink command string → number mapping. */
const cmdMap: Record<WaypointCommand, number> = {
  WAYPOINT: 16, SPLINE_WAYPOINT: 82, LOITER: 17, LOITER_TURNS: 18, LOITER_TIME: 19,
  RTL: 20, LAND: 21, TAKEOFF: 22, ROI: 201, DO_SET_SPEED: 178,
  DO_SET_CAM_TRIGG: 206, DO_DIGICAM: 203, DO_JUMP: 177, DELAY: 112,
  CONDITION_YAW: 115,
};

/** MAVLink command number → string mapping. */
const reverseCmd: Record<number, WaypointCommand> = Object.fromEntries(
  Object.entries(cmdMap).map(([k, v]) => [v, k as WaypointCommand])
) as Record<number, WaypointCommand>;

export interface MissionMetadata {
  name: string;
  droneId?: string;
  suiteType?: SuiteType;
  createdAt: number;
  updatedAt: number;
}

export interface MissionFile {
  version: 1;
  metadata: MissionMetadata;
  waypoints: Waypoint[];
}

interface RecentMission {
  name: string;
  date: number;
  wpCount: number;
  key: string;
}

// ── One-time localStorage → IndexedDB migration ────────────

async function migrateFromLocalStorage(): Promise<void> {
  if (typeof window === "undefined") return;
  const migrated = await get("altcmd:migrated");
  if (migrated) return;

  try {
    const autosave = localStorage.getItem(AUTOSAVE_KEY);
    if (autosave) {
      await set(AUTOSAVE_KEY, JSON.parse(autosave));
      localStorage.removeItem(AUTOSAVE_KEY);
    }

    const recent = localStorage.getItem(RECENT_KEY);
    if (recent) {
      await set(RECENT_KEY, JSON.parse(recent));
      localStorage.removeItem(RECENT_KEY);
    }

    const keysToMigrate: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("altcmd_mission_")) {
        keysToMigrate.push(key);
      }
    }
    for (const key of keysToMigrate) {
      const val = localStorage.getItem(key);
      if (val) {
        await set(key, JSON.parse(val));
        localStorage.removeItem(key);
      }
    }

    await set("altcmd:migrated", true);
  } catch {
    // Migration failed — not critical
  }
}

if (typeof window !== "undefined") {
  migrateFromLocalStorage();
}

// ── File download/upload (unchanged) ────────────────────────

/** Save mission as downloadable .altmission JSON file. */
export async function downloadMissionFile(waypoints: Waypoint[], metadata: MissionMetadata): Promise<void> {
  const file: MissionFile = {
    version: 1,
    metadata: { ...metadata, updatedAt: Date.now() },
    waypoints,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${metadata.name || "mission"}.altmission`;
  a.click();
  URL.revokeObjectURL(url);
  await addToRecent(metadata.name, waypoints.length);
}

/** Load mission from a File object. */
export async function loadMissionFile(file: File): Promise<MissionFile> {
  const text = await file.text();
  const data = JSON.parse(text) as MissionFile;
  if (!data.version || !data.waypoints || !Array.isArray(data.waypoints)) {
    throw new Error("Invalid .altmission file");
  }
  return data;
}

// ── Autosave ────────────────────────────────────────────────

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

export function autoSave(waypoints: Waypoint[], metadata: Partial<MissionMetadata>): void {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const data: MissionFile = {
      version: 1,
      metadata: {
        name: metadata.name || "Untitled",
        droneId: metadata.droneId,
        suiteType: metadata.suiteType,
        createdAt: metadata.createdAt || Date.now(),
        updatedAt: Date.now(),
      },
      waypoints,
    };
    set(AUTOSAVE_KEY, data).catch(() => {});
  }, 2000);
}

/** Cancel any pending auto-save timer. Call on page unmount. */
export function cancelAutoSave(): void {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
}

/** Get auto-saved mission data. */
export async function getAutoSave(): Promise<MissionFile | null> {
  try {
    const data = await get<MissionFile>(AUTOSAVE_KEY);
    if (!data || !data.waypoints?.length) return null;
    return data;
  } catch {
    return null;
  }
}

/** Clear auto-save. */
export async function clearAutoSave(): Promise<void> {
  try {
    await del(AUTOSAVE_KEY);
  } catch {
    // silent
  }
}

// ── Named mission storage ───────────────────────────────────

/** Save to IndexedDB with a named key + add to recents. */
export async function saveMissionToStorage(waypoints: Waypoint[], metadata: MissionMetadata): Promise<void> {
  const key = `altcmd_mission_${Date.now()}`;
  const file: MissionFile = {
    version: 1,
    metadata: { ...metadata, updatedAt: Date.now() },
    waypoints,
  };
  try {
    await set(key, file);
    await addToRecent(metadata.name, waypoints.length, key);
  } catch {
    // silent
  }
}

/** Get recent missions list. */
export async function getRecentMissions(): Promise<RecentMission[]> {
  try {
    const recent = await get<RecentMission[]>(RECENT_KEY);
    return recent ?? [];
  } catch {
    return [];
  }
}

/** Load a mission from IndexedDB by key. */
export async function loadMissionFromStorage(key: string): Promise<MissionFile | null> {
  try {
    const data = await get<MissionFile>(key);
    return data ?? null;
  } catch {
    return null;
  }
}

// ── .waypoints Export (ArduPilot / Mission Planner format) ───

/**
 * Export waypoints as a `.waypoints` file (QGC WPL 110 format).
 * Tab-separated plain text compatible with Mission Planner and ArduPilot.
 */
export function exportWaypointsFormat(waypoints: Waypoint[], name: string): void {
  const lines: string[] = ["QGC WPL 110"];

  // Row 0 = home (use first waypoint lat/lon at alt 0, or 0/0/0)
  const home = waypoints[0];
  lines.push(
    `0\t1\t0\t16\t0\t0\t0\t0\t${home?.lat ?? 0}\t${home?.lon ?? 0}\t0\t1`
  );

  waypoints.forEach((wp, i) => {
    const cmd = cmdMap[wp.command ?? "WAYPOINT"] ?? 16;
    const p1 = wp.holdTime ?? wp.param1 ?? 0;
    const p2 = wp.param2 ?? 0;
    const p3 = wp.param3 ?? 0;
    const p4 = 0;
    lines.push(
      `${i + 1}\t0\t3\t${cmd}\t${p1}\t${p2}\t${p3}\t${p4}\t${wp.lat}\t${wp.lon}\t${wp.alt}\t1`
    );
  });

  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "mission"}.waypoints`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── .waypoints Import ────────────────────────────────────────

/** Parse a `.waypoints` (QGC WPL 110) file into Waypoint array. */
export function parseWaypointsFile(text: string): Waypoint[] {
  const lines = text.trim().split("\n");
  if (!lines[0]?.startsWith("QGC WPL")) {
    throw new Error("Invalid .waypoints file — missing QGC WPL header");
  }

  const waypoints: Waypoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split("\t");
    if (cols.length < 12) continue;

    const seq = parseInt(cols[0]);
    if (seq === 0) continue; // skip home waypoint

    const cmdNum = parseInt(cols[3]);
    const command = reverseCmd[cmdNum] ?? "WAYPOINT";
    const lat = parseFloat(cols[8]);
    const lon = parseFloat(cols[9]);
    const alt = parseFloat(cols[10]);
    const p1 = parseFloat(cols[4]) || undefined;
    const p2 = parseFloat(cols[5]) || undefined;
    const p3 = parseFloat(cols[6]) || undefined;

    waypoints.push({
      id: Math.random().toString(36).substring(2, 10),
      lat, lon, alt,
      command,
      holdTime: (command === "LOITER" || command === "LOITER_TIME") ? p1 : undefined,
      param1: (command !== "LOITER" && command !== "LOITER_TIME") ? p1 : undefined,
      param2: p2,
      param3: p3,
    });
  }

  return waypoints;
}

// ── .plan Export (QGroundControl JSON format) ────────────────

/** Export waypoints as a `.plan` file (QGC JSON format). */
export function exportQGCPlan(
  waypoints: Waypoint[],
  name: string,
  metadata?: { cruiseSpeed?: number; vehicleType?: number }
): void {
  const home = waypoints[0];
  const items = waypoints.map((wp, i) => ({
    autoContinue: true,
    command: cmdMap[wp.command ?? "WAYPOINT"] ?? 16,
    doJumpId: i + 1,
    frame: 3,
    params: [
      wp.holdTime ?? wp.param1 ?? 0,
      wp.param2 ?? 0,
      wp.param3 ?? 0,
      0,
      wp.lat,
      wp.lon,
      wp.alt,
    ],
    type: "SimpleItem",
  }));

  const plan = {
    fileType: "Plan",
    groundStation: "Altnautica Command",
    version: 1,
    mission: {
      cruiseSpeed: metadata?.cruiseSpeed ?? 15,
      firmwareType: 3,
      items,
      plannedHomePosition: [home?.lat ?? 0, home?.lon ?? 0, 0],
      vehicleType: metadata?.vehicleType ?? 2,
      version: 2,
    },
    geoFence: { circles: [], polygons: [], version: 2 },
    rallyPoints: { points: [], version: 2 },
  };

  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name || "mission"}.plan`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── .plan Import ─────────────────────────────────────────────

/** Parse a `.plan` (QGC JSON) file into Waypoint array. */
export function parseQGCPlan(text: string): Waypoint[] {
  const data = JSON.parse(text);
  if (data.fileType !== "Plan" || !data.mission?.items) {
    throw new Error("Invalid .plan file — missing Plan fileType or mission items");
  }

  const waypoints: Waypoint[] = [];
  for (const item of data.mission.items) {
    if (item.type !== "SimpleItem") continue;

    const cmdNum = item.command ?? 16;
    const command = reverseCmd[cmdNum] ?? "WAYPOINT";
    const params = item.params ?? [];
    const lat = params[4] ?? 0;
    const lon = params[5] ?? 0;
    const alt = params[6] ?? 0;
    const p1 = params[0] || undefined;
    const p2 = params[1] || undefined;
    const p3 = params[2] || undefined;

    waypoints.push({
      id: Math.random().toString(36).substring(2, 10),
      lat, lon, alt,
      command,
      holdTime: (command === "LOITER" || command === "LOITER_TIME") ? p1 : undefined,
      param1: (command !== "LOITER" && command !== "LOITER_TIME") ? p1 : undefined,
      param2: p2,
      param3: p3,
    });
  }

  return waypoints;
}

// ── Format detection ─────────────────────────────────────────

/** Detect mission file format by extension and parse appropriately. */
export async function importMissionFile(file: File): Promise<{ waypoints: Waypoint[]; metadata?: MissionMetadata }> {
  const text = await file.text();
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "waypoints") {
    return { waypoints: parseWaypointsFile(text) };
  }

  if (ext === "plan") {
    return { waypoints: parseQGCPlan(text) };
  }

  // Default: try .altmission / .json
  const data = JSON.parse(text) as MissionFile;
  if (!data.version || !data.waypoints || !Array.isArray(data.waypoints)) {
    throw new Error("Invalid mission file format");
  }
  return { waypoints: data.waypoints, metadata: data.metadata };
}

// ── Recent missions ──────────────────────────────────────────

async function addToRecent(name: string, wpCount: number, key?: string): Promise<void> {
  try {
    const recent = await getRecentMissions();
    recent.unshift({ name, date: Date.now(), wpCount, key: key || "" });
    if (recent.length > MAX_RECENT) recent.length = MAX_RECENT;
    await set(RECENT_KEY, recent);
  } catch {
    // silent
  }
}
