/**
 * @module mission-store
 * @description Zustand store for mission waypoint state, undo/redo history,
 * and mission upload/download via the drone protocol abstraction.
 *
 * Undo/redo uses a bounded stack (max 50 entries). Each mutation pushes the
 * current waypoints array onto the undo stack and clears the redo stack.
 * Undo pops from undo → sets waypoints → pushes to redo (and vice versa).
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Mission, Waypoint, WaypointCommand, MissionState, SuiteType } from "@/lib/types";
import type { MissionItem } from "@/lib/protocol/types";
import { useDroneManager } from "./drone-manager";
import { indexedDBStorage } from "@/lib/storage";

/** Maximum undo/redo history depth. */
const MAX_UNDO = 50;

interface MissionStoreState {
  activeMission: Mission | null;
  waypoints: Waypoint[];
  progress: number;
  currentWaypoint: number;
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  undoStack: Waypoint[][];
  redoStack: Waypoint[][];

  setMission: (mission: Mission | null) => void;
  setWaypoints: (waypoints: Waypoint[]) => void;
  addWaypoint: (waypoint: Waypoint) => void;
  insertWaypoint: (waypoint: Waypoint, atIndex: number) => void;
  removeWaypoint: (id: string) => void;
  updateWaypoint: (id: string, update: Partial<Waypoint>) => void;
  reorderWaypoints: (fromIndex: number, toIndex: number) => void;
  setProgress: (progress: number, currentWaypoint: number) => void;
  setMissionState: (state: MissionState) => void;
  setUploadState: (state: "idle" | "uploading" | "uploaded" | "error") => void;
  createMission: (name: string, droneId: string, suiteType?: SuiteType) => void;
  clearMission: () => void;
  uploadMission: () => Promise<void>;
  downloadMission: () => Promise<void>;
  undo: () => void;
  redo: () => void;
}

function pushUndo(state: { undoStack: Waypoint[][]; waypoints: Waypoint[] }) {
  const stack = [...state.undoStack, [...state.waypoints]];
  if (stack.length > MAX_UNDO) stack.shift();
  return { undoStack: stack, redoStack: [] as Waypoint[][] };
}

export const useMissionStore = create<MissionStoreState>()(
  persist(
    (set, get) => ({
  activeMission: null,
  waypoints: [],
  progress: 0,
  currentWaypoint: 0,
  uploadState: "idle",
  undoStack: [],
  redoStack: [],

  setMission: (activeMission) => set({
    activeMission,
    waypoints: activeMission?.waypoints ?? [],
    progress: activeMission?.progress ?? 0,
    currentWaypoint: activeMission?.currentWaypoint ?? 0,
  }),

  setWaypoints: (waypoints) => set((s) => ({
    ...pushUndo(s),
    waypoints,
  })),

  addWaypoint: (waypoint) =>
    set((s) => ({
      ...pushUndo(s),
      waypoints: [...s.waypoints, waypoint],
    })),

  insertWaypoint: (waypoint, atIndex) =>
    set((s) => {
      const wps = [...s.waypoints];
      wps.splice(atIndex, 0, waypoint);
      return { ...pushUndo(s), waypoints: wps };
    }),

  removeWaypoint: (id) =>
    set((s) => ({
      ...pushUndo(s),
      waypoints: s.waypoints.filter((w) => w.id !== id),
    })),

  updateWaypoint: (id, update) =>
    set((s) => ({
      ...pushUndo(s),
      waypoints: s.waypoints.map((w) =>
        w.id === id ? { ...w, ...update } : w
      ),
    })),

  reorderWaypoints: (fromIndex, toIndex) =>
    set((s) => {
      const wps = [...s.waypoints];
      const [moved] = wps.splice(fromIndex, 1);
      wps.splice(toIndex, 0, moved);
      return { ...pushUndo(s), waypoints: wps };
    }),

  setProgress: (progress, currentWaypoint) =>
    set({ progress, currentWaypoint }),

  setMissionState: (state) =>
    set((s) =>
      s.activeMission
        ? { activeMission: { ...s.activeMission, state } }
        : {}
    ),

  setUploadState: (uploadState) => set({ uploadState }),

  createMission: (name, droneId, suiteType) =>
    set({
      activeMission: {
        id: Math.random().toString(36).substring(2, 10),
        name,
        droneId,
        suiteType,
        waypoints: [],
        state: "planning",
        progress: 0,
        currentWaypoint: 0,
      },
      waypoints: [],
      progress: 0,
      currentWaypoint: 0,
      uploadState: "idle",
      undoStack: [],
      redoStack: [],
    }),

  clearMission: () =>
    set((s) => ({
      ...pushUndo(s),
      activeMission: null,
      waypoints: [],
      progress: 0,
      currentWaypoint: 0,
      uploadState: "idle",
    })),

  undo: () =>
    set((s) => {
      if (s.undoStack.length === 0) return s;
      const stack = [...s.undoStack];
      const prev = stack.pop();
      if (!prev) return s;
      return {
        undoStack: stack,
        redoStack: [...s.redoStack, [...s.waypoints]].slice(-MAX_UNDO),
        waypoints: prev,
      };
    }),

  redo: () =>
    set((s) => {
      if (s.redoStack.length === 0) return s;
      const stack = [...s.redoStack];
      const next = stack.pop();
      if (!next) return s;
      return {
        redoStack: stack,
        undoStack: [...s.undoStack, [...s.waypoints]].slice(-MAX_UNDO),
        waypoints: next,
      };
    }),

  uploadMission: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) return;
    const { waypoints } = get();
    if (waypoints.length === 0) return;

    set({ uploadState: "uploading" });

    const cmdMap = {
      WAYPOINT: 16, SPLINE_WAYPOINT: 82, LOITER: 17, LOITER_TURNS: 18, LOITER_TIME: 19,
      RTL: 20, LAND: 21, TAKEOFF: 22, ROI: 201, DO_SET_SPEED: 178,
      DO_SET_CAM_TRIGG: 206, DO_DIGICAM: 203, DO_JUMP: 177, DELAY: 112,
      CONDITION_YAW: 115,
    } satisfies Record<WaypointCommand, number>;

    const items: MissionItem[] = waypoints.map((wp, i) => ({
      seq: i,
      frame: 3,     // MAV_FRAME_GLOBAL_RELATIVE_ALT
      command: cmdMap[wp.command ?? "WAYPOINT"] ?? 16,
      current: i === 0 ? 1 : 0,
      autocontinue: 1,
      param1: wp.holdTime ?? 0,
      param2: wp.param1 ?? 0,
      param3: wp.param2 ?? 0,
      param4: wp.param3 ?? 0,
      x: Math.round(wp.lat * 1e7),
      y: Math.round(wp.lon * 1e7),
      z: wp.alt,
    }));

    try {
      const result = await protocol.uploadMission(items);
      set({ uploadState: result.success ? "uploaded" : "error" });
    } catch {
      set({ uploadState: "error" });
    }
  },

  downloadMission: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol) return;

    const reverseCmd: Record<number, string> = {
      16: "WAYPOINT", 17: "LOITER", 18: "LOITER_TURNS", 19: "LOITER_TIME",
      20: "RTL", 21: "LAND", 22: "TAKEOFF", 201: "ROI", 178: "DO_SET_SPEED",
      177: "DO_JUMP", 112: "DELAY", 115: "CONDITION_YAW",
    };

    try {
      const items = await protocol.downloadMission();
      const waypoints: Waypoint[] = items.map((item) => ({
        id: Math.random().toString(36).substring(2, 10),
        lat: item.x / 1e7,
        lon: item.y / 1e7,
        alt: item.z,
        holdTime: item.param1 || undefined,
        command: (reverseCmd[item.command] ?? "WAYPOINT") as Waypoint["command"],
      }));
      set({ waypoints });
    } catch {
      // downloadMission not yet implemented on protocol — silent fail
    }
  },
    }),
    {
      name: "altcmd:mission-store",
      storage: createJSONStorage(indexedDBStorage.storage),
      version: 1,
      partialize: (state) => ({
        waypoints: state.waypoints,
        activeMission: state.activeMission,
      }),
    }
  )
);
