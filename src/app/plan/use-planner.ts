/**
 * @module use-planner
 * @description Core hook for the mission planner page. Encapsulates all planner
 * logic: store connections, local state, map/context handlers, save/load,
 * autosave recovery, auto-save to library, and the cancel-on-unmount cleanup.
 * @license GPL-3.0-only
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { useMissionStore } from "@/stores/mission-store";
import { usePlannerStore } from "@/stores/planner-store";
import { useFleetStore } from "@/stores/fleet-store";
import { usePlanLibraryStore } from "@/stores/plan-library-store";
import { useToast } from "@/components/ui/toast";
import { randomId } from "@/lib/utils";
import { DEFAULT_CENTER } from "@/lib/map-constants";
import { useSettingsStore } from "@/stores/settings-store";
import {
  autoSave,
  cancelAutoSave,
  getAutoSave,
  clearAutoSave,
  exportWaypointsFormat,
  exportQGCPlan,
  exportMissionKML,
  exportMissionCSV,
} from "@/lib/mission-io";
import { useDrawingStore } from "@/stores/drawing-store";
import { useRallyStore } from "@/stores/rally-store";
import { usePatternStore } from "@/stores/pattern-store";
import { useGeofenceStore } from "@/stores/geofence-store";
import type { ContextMenuItem } from "@/components/planner/MapContextMenu";
import type { SuiteType, Waypoint } from "@/lib/types";
import type { DrawnPolygon, DrawnCircle } from "@/lib/drawing/types";

/** Clamp a latitude to [-90, 90]. */
function clampLat(lat: number): number {
  return Math.max(-90, Math.min(90, lat));
}

/** Clamp a longitude to [-180, 180]. */
function clampLon(lon: number): number {
  return Math.max(-180, Math.min(180, lon));
}

/** Clamp altitude to >= 0. */
function clampAlt(alt: number): number {
  return Math.max(0, alt);
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  lat?: number;
  lon?: number;
  waypointId?: string;
}

export function usePlanner() {
  const {
    waypoints, addWaypoint, removeWaypoint, updateWaypoint, insertWaypoint,
    reorderWaypoints, uploadMission, downloadMission, uploadState,
    undoStack, redoStack, undo, redo, clearMission, setWaypoints,
  } = useMissionStore();

  const {
    activeTool, setActiveTool,
    panelCollapsed, togglePanel,
    altProfileCollapsed, toggleAltProfile,
    expandedWaypointId, setExpandedWaypoint,
    selectedWaypointId, setSelectedWaypoint,
    defaultAlt, defaultSpeed, defaultAcceptRadius, defaultFrame,
    setDefaults,
  } = usePlannerStore();

  const drones = useFleetStore((s) => s.drones);
  const { toast } = useToast();

  // Mission setup state
  const [missionName, setMissionName] = useState("");
  const [selectedDroneId, setSelectedDroneId] = useState("");
  const [suiteType, setSuiteType] = useState("");

  // Geofence state
  const [geofenceEnabled, setGeofenceEnabled] = useState(false);
  const [geofenceType, setGeofenceType] = useState("circle");
  const [geofenceMaxAlt, setGeofenceMaxAlt] = useState("120");
  const [geofenceAction, setGeofenceAction] = useState("RTL");

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Clear confirm
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Plan library integration
  const activePlanId = usePlanLibraryStore((s) => s.activePlanId);
  const isDirty = usePlanLibraryStore((s) => s.isDirty);

  // Rally point state
  const rallyPoints = useRallyStore((s) => s.points);
  const addRallyPoint = useRallyStore((s) => s.addPoint);
  const [addingRallyPoint, setAddingRallyPoint] = useState(false);

  // Drawing store
  const drawingMode = useDrawingStore((s) => s.drawingMode);
  const drawnPolygons = useDrawingStore((s) => s.polygons);
  const drawnCircles = useDrawingStore((s) => s.circles);
  const measureLine = useDrawingStore((s) => s.measureLine);
  const clearDrawings = useDrawingStore((s) => s.clearAll);

  // ── Autosave recovery ─────────────────────────────────────
  const autoSaveChecked = useRef(false);
  useEffect(() => {
    if (autoSaveChecked.current) return;
    autoSaveChecked.current = true;
    (async () => {
      const saved = await getAutoSave();
      if (saved && saved.waypoints.length > 0) {
        toast("Unsaved mission found — restoring", "info");
        setWaypoints(saved.waypoints);
        if (saved.metadata.name) setMissionName(saved.metadata.name);
        if (saved.metadata.droneId) setSelectedDroneId(saved.metadata.droneId);
        if (saved.metadata.suiteType) setSuiteType(saved.metadata.suiteType);
      }
    })();
  }, [setWaypoints, toast]);

  // Auto-save to IndexedDB (legacy autosave key) on waypoint changes
  useEffect(() => {
    if (waypoints.length > 0) {
      autoSave(waypoints, {
        name: missionName,
        droneId: selectedDroneId || undefined,
        suiteType: (suiteType as SuiteType) || undefined,
      });
    }
    return () => cancelAutoSave();
  }, [waypoints, missionName, selectedDroneId, suiteType]);

  // Auto-save to library plan (debounced 3s) when waypoints change
  const libAutoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const libStore = usePlanLibraryStore.getState();
    if (!libStore.activePlanId || waypoints.length === 0) return;

    if (libAutoSaveTimer.current) clearTimeout(libAutoSaveTimer.current);
    libAutoSaveTimer.current = setTimeout(() => {
      const current = usePlanLibraryStore.getState();
      if (!current.activePlanId || !current.isDirty) return;
      current.savePlan(current.activePlanId, waypoints, {
        droneId: selectedDroneId || undefined,
        suiteType: (suiteType as SuiteType) || undefined,
      });
    }, 3000);

    return () => {
      if (libAutoSaveTimer.current) clearTimeout(libAutoSaveTimer.current);
    };
  }, [waypoints, selectedDroneId, suiteType]);

  // Auto-sync plan name to library when it changes
  useEffect(() => {
    const libStore = usePlanLibraryStore.getState();
    if (!libStore.activePlanId || !missionName) return;
    libStore.updatePlanName(libStore.activePlanId, missionName);
  }, [missionName]);

  // Dirty detection — compare waypoints + name to saved snapshot
  useEffect(() => {
    const libStore = usePlanLibraryStore.getState();
    if (!libStore.activePlanId) return;
    const waypointsDirty = JSON.stringify(waypoints) !== libStore.savedSnapshot;
    const plan = libStore.plans.find((p) => p.id === libStore.activePlanId);
    const nameDirty = plan ? plan.name !== missionName : false;
    libStore.setDirty(waypointsDirty || nameDirty);
  }, [waypoints, missionName]);

  // ── Map handlers ──────────────────────────────────────────
  const handleMapClick = useCallback(
    (lat: number, lon: number) => {
      // Rally point placement mode
      if (addingRallyPoint) {
        addRallyPoint({
          id: randomId(),
          lat: clampLat(lat),
          lon: clampLon(lon),
          alt: clampAlt(defaultAlt),
        });
        setAddingRallyPoint(false);
        return;
      }
      if (!activePlanId) {
        toast("Create or select a flight plan first", "info");
        return;
      }
      const wp: Waypoint = {
        id: randomId(),
        lat: clampLat(lat),
        lon: clampLon(lon),
        alt: clampAlt(defaultAlt),
        speed: defaultSpeed,
        command: "WAYPOINT",
      };
      addWaypoint(wp);
    },
    [activePlanId, addWaypoint, addRallyPoint, addingRallyPoint, defaultAlt, defaultSpeed, toast]
  );

  const handleMapRightClick = useCallback(
    (lat: number, lon: number, x: number, y: number) => {
      setContextMenu({
        x, y, lat, lon,
        items: [
          { id: "add-wp", label: "Add Waypoint" },
          { id: "add-takeoff", label: "Add Takeoff" },
          { id: "add-land", label: "Add Land" },
          { id: "add-roi", label: "Set ROI" },
          { id: "div1", label: "", divider: true },
          { id: "add-rally", label: "Add Rally Point Here" },
          { id: "div2", label: "", divider: true },
          { id: "center", label: "Center Map Here" },
        ],
      });
    },
    []
  );

  const handleWaypointRightClick = useCallback(
    (id: string, x: number, y: number) => {
      setContextMenu({
        x, y, waypointId: id,
        items: [
          { id: "edit", label: "Edit" },
          { id: "insert-before", label: "Insert Before" },
          { id: "insert-after", label: "Insert After" },
          { id: "div1", label: "", divider: true },
          { id: "delete-wp", label: "Delete", danger: true },
        ],
      });
    },
    []
  );

  const handleContextAction = useCallback(
    (actionId: string) => {
      if (!contextMenu) return;
      const { lat, lon, waypointId } = contextMenu;

      const addActions = ["add-wp", "add-takeoff", "add-land", "add-roi"];
      if (addActions.includes(actionId) && !activePlanId) {
        toast("Create or select a flight plan first", "info");
        setContextMenu(null);
        return;
      }

      const makeWp = (cmd: Waypoint["command"]): Waypoint => ({
        id: randomId(),
        lat: clampLat(lat ?? 0),
        lon: clampLon(lon ?? 0),
        alt: cmd === "LAND" ? 0 : clampAlt(defaultAlt),
        command: cmd,
      });

      switch (actionId) {
        case "add-wp":
          addWaypoint(makeWp("WAYPOINT"));
          break;
        case "add-takeoff":
          addWaypoint(makeWp("TAKEOFF"));
          break;
        case "add-land":
          addWaypoint(makeWp("LAND"));
          break;
        case "add-roi":
          addWaypoint(makeWp("ROI"));
          break;
        case "add-rally":
          addRallyPoint({
            id: randomId(),
            lat: clampLat(lat ?? 0),
            lon: clampLon(lon ?? 0),
            alt: clampAlt(defaultAlt),
          });
          break;
        case "center":
          break;
        case "edit":
          if (waypointId) {
            setSelectedWaypoint(waypointId);
            setExpandedWaypoint(waypointId);
          }
          break;
        case "insert-before":
        case "insert-after": {
          if (!waypointId) break;
          const idx = waypoints.findIndex((w) => w.id === waypointId);
          if (idx === -1) break;
          const ref = waypoints[idx];
          const newWp: Waypoint = {
            id: randomId(),
            lat: clampLat(ref.lat + 0.0005),
            lon: clampLon(ref.lon + 0.0005),
            alt: clampAlt(defaultAlt),
            command: "WAYPOINT",
          };
          insertWaypoint(newWp, actionId === "insert-before" ? idx : idx + 1);
          break;
        }
        case "delete-wp":
          if (waypointId) removeWaypoint(waypointId);
          break;
      }
      setContextMenu(null);
    },
    [contextMenu, activePlanId, addWaypoint, addRallyPoint, insertWaypoint, removeWaypoint, defaultAlt, waypoints, setSelectedWaypoint, setExpandedWaypoint, toast]
  );

  const handleWaypointClick = useCallback(
    (id: string) => setSelectedWaypoint(id),
    [setSelectedWaypoint]
  );

  const handleWaypointDragEnd = useCallback(
    (id: string, lat: number, lon: number) => {
      updateWaypoint(id, { lat: clampLat(lat), lon: clampLon(lon) });
    },
    [updateWaypoint]
  );

  // ── Toolbar handlers ──────────────────────────────────────
  const handleClearAll = useCallback(() => {
    if (waypoints.length > 0) setShowClearConfirm(true);
  }, [waypoints.length]);

  const confirmClear = useCallback(() => {
    clearMission();
    void clearAutoSave();
    setSelectedWaypoint(null);
    setExpandedWaypoint(null);
    setMissionName("");
    setSelectedDroneId("");
    setSuiteType("");
    setShowClearConfirm(false);
    toast("Mission cleared", "info");
  }, [clearMission, setSelectedWaypoint, setExpandedWaypoint, toast]);

  // ── Save/Load (Library-based) ────────────────────────────
  /** Cmd+S — save to active plan in library, or create new if none. */
  const handleSave = useCallback(() => {
    const libStore = usePlanLibraryStore.getState();
    if (libStore.activePlanId) {
      // Sync plan name to library before saving
      if (missionName) {
        libStore.updatePlanName(libStore.activePlanId, missionName);
      }
      libStore.savePlan(libStore.activePlanId, waypoints, {
        droneId: selectedDroneId || undefined,
        suiteType: (suiteType as SuiteType) || undefined,
        totalDistance: undefined,
        estimatedTime: undefined,
      });
    } else {
      libStore.createPlan(missionName || "Untitled Plan", waypoints, {
        droneId: selectedDroneId || undefined,
        suiteType: (suiteType as SuiteType) || undefined,
      });
    }
    // Cancel pending library auto-save since we just saved explicitly
    if (libAutoSaveTimer.current) clearTimeout(libAutoSaveTimer.current);
    useSettingsStore.getState().incrementSaveCount();
    toast("Plan saved", "success");
  }, [waypoints, missionName, selectedDroneId, suiteType, toast]);

  /** Save As — always create a new plan in the library. */
  const handleSaveAs = useCallback(() => {
    const libStore = usePlanLibraryStore.getState();
    libStore.createPlan(missionName || "Untitled Plan", waypoints, {
      droneId: selectedDroneId || undefined,
      suiteType: (suiteType as SuiteType) || undefined,
    });
    useSettingsStore.getState().incrementSaveCount();
    toast("Plan saved as new copy", "success");
  }, [waypoints, missionName, selectedDroneId, suiteType, toast]);

  /** Export as .waypoints file download. */
  const handleExportWaypoints = useCallback(() => {
    exportWaypointsFormat(waypoints, missionName || "mission");
    toast("Exported (.waypoints)", "success");
  }, [waypoints, missionName, toast]);

  /** Export as QGC .plan file download. */
  const handleExportPlan = useCallback(() => {
    exportQGCPlan(waypoints, missionName || "mission");
    toast("Exported (.plan)", "success");
  }, [waypoints, missionName, toast]);

  /** Export as .kml file download. */
  const handleExportKML = useCallback(() => {
    exportMissionKML(waypoints, missionName || "mission");
    toast("Exported (.kml)", "success");
  }, [waypoints, missionName, toast]);

  /** Export as .csv file download. */
  const handleExportCSV = useCallback(() => {
    exportMissionCSV(waypoints, missionName || "mission");
    toast("Exported (.csv)", "success");
  }, [waypoints, missionName, toast]);

  /** Callback from FlightPlanLibrary when a plan is selected/loaded. */
  const handlePlanLoaded = useCallback(
    (plan: { name: string; droneId?: string; suiteType?: string }) => {
      setMissionName(plan.name);
      setSelectedDroneId(plan.droneId || "");
      setSuiteType(plan.suiteType || "");
    },
    []
  );

  /** Called when the active plan is renamed via context menu — syncs local missionName. */
  const handlePlanRenamed = useCallback((name: string) => {
    setMissionName(name);
  }, []);

  /** New plan — clear state and create in library. */
  const handleNewPlan = useCallback(() => {
    const libStore = usePlanLibraryStore.getState();
    libStore.createPlan();
    clearMission();
    setMissionName("Untitled Plan");
    setSelectedDroneId("");
    setSuiteType("");
    setSelectedWaypoint(null);
    setExpandedWaypoint(null);
    toast("New plan created", "info");
  }, [clearMission, setSelectedWaypoint, setExpandedWaypoint, toast]);

  /** Focus library search — dispatches custom event for the search bar. */
  const handleFocusSearch = useCallback(() => {
    document.dispatchEvent(new CustomEvent("plan-library:focus-search"));
  }, []);

  const handleReverseWaypoints = useCallback(() => {
    if (waypoints.length < 2) return;
    setWaypoints([...waypoints].reverse());
    toast("Waypoints reversed", "info");
  }, [waypoints, setWaypoints, toast]);

  const handleUpload = useCallback(() => {
    uploadMission();
  }, [uploadMission]);

  /** Handle a completed drawing shape (polygon or circle). */
  const handleDrawingComplete = useCallback(
    (shape: DrawnPolygon | DrawnCircle) => {
      setActiveTool("select");

      const patternStore = usePatternStore.getState();
      const patternType = patternStore.activePatternType;
      const geoStore = useGeofenceStore.getState();

      if ("vertices" in shape) {
        // Polygon drawn — route to geofence if enabled, else pattern/generic
        if (geofenceEnabled && geoStore.fenceType === "polygon") {
          geoStore.setPolygonPoints(shape.vertices);
          toast(`Geofence polygon set (${shape.vertices.length} vertices)`, "success");
        } else if (patternType === "survey") {
          patternStore.updateSurveyConfig({ polygon: shape.vertices });
          toast(`Survey area set (${shape.vertices.length} vertices)`, "success");
        } else {
          toast(`Polygon drawn (${shape.vertices.length} vertices)`, "success");
        }
      } else {
        // Circle drawn — route to geofence if enabled, else pattern/generic
        if (geofenceEnabled && geoStore.fenceType === "circle") {
          geoStore.setCircle(shape.center, shape.radius);
          toast(`Geofence circle set (r=${Math.round(shape.radius)}m)`, "success");
        } else if (patternType === "orbit") {
          patternStore.updateOrbitConfig({ center: shape.center, radius: shape.radius });
          toast(`Orbit area set (r=${Math.round(shape.radius)}m)`, "success");
        } else {
          toast(`Circle drawn (r=${Math.round(shape.radius)}m)`, "success");
        }
      }
    },
    [setActiveTool, geofenceEnabled, toast]
  );

  /** Apply generated pattern waypoints to the mission. */
  const handlePatternApply = useCallback(() => {
    const patternStore = usePatternStore.getState();
    const result = patternStore.patternResult;
    if (!result || result.waypoints.length === 0) {
      toast("No pattern generated yet", "info");
      return;
    }
    if (!activePlanId) {
      toast("Create or select a flight plan first", "info");
      return;
    }

    // Convert pattern waypoints to mission waypoints
    const newWaypoints: Waypoint[] = result.waypoints.map((pw) => ({
      id: randomId(),
      lat: pw.lat,
      lon: pw.lon,
      alt: pw.alt,
      speed: pw.speed,
      command: (pw.command ?? "WAYPOINT") as Waypoint["command"],
      param1: pw.param1,
      param2: pw.param2,
    }));

    // Optionally prepend TAKEOFF if first waypoint isn't one
    const firstCmd = newWaypoints[0]?.command;
    if (firstCmd !== "TAKEOFF") {
      const takeoffWp: Waypoint = {
        id: randomId(),
        lat: newWaypoints[0].lat,
        lon: newWaypoints[0].lon,
        alt: newWaypoints[0].alt,
        command: "TAKEOFF",
      };
      newWaypoints.unshift(takeoffWp);
    }

    // Append RTL at end
    const lastWp = newWaypoints[newWaypoints.length - 1];
    newWaypoints.push({
      id: randomId(),
      lat: lastWp.lat,
      lon: lastWp.lon,
      alt: 0,
      command: "RTL",
    });

    setWaypoints(newWaypoints);
    patternStore.clear();

    const stats = result.stats;
    const distStr = stats.totalDistance >= 1000
      ? `${(stats.totalDistance / 1000).toFixed(1)} km`
      : `${Math.round(stats.totalDistance)} m`;
    const timeStr = stats.estimatedTime >= 60
      ? `${Math.round(stats.estimatedTime / 60)} min`
      : `${Math.round(stats.estimatedTime)} sec`;

    toast(`Pattern applied: ${newWaypoints.length} waypoints, ${distStr}, ~${timeStr}`, "success");
  }, [activePlanId, setWaypoints, toast]);

  const handleAddManualWaypoint = useCallback(() => {
    if (!activePlanId) {
      toast("Create or select a flight plan first", "info");
      return;
    }
    const lastWp = waypoints[waypoints.length - 1];
    const wp: Waypoint = {
      id: randomId(),
      lat: clampLat(lastWp ? lastWp.lat + 0.001 : DEFAULT_CENTER[0]),
      lon: clampLon(lastWp ? lastWp.lon + 0.001 : DEFAULT_CENTER[1]),
      alt: clampAlt(defaultAlt),
      command: "WAYPOINT",
    };
    addWaypoint(wp);
  }, [activePlanId, waypoints, addWaypoint, defaultAlt, toast]);

  return {
    // Store state
    waypoints, undoStack, redoStack, uploadState,
    activeTool, setActiveTool,
    panelCollapsed, togglePanel,
    altProfileCollapsed, toggleAltProfile,
    expandedWaypointId, setExpandedWaypoint,
    selectedWaypointId, setSelectedWaypoint,
    defaultAlt, defaultSpeed, defaultAcceptRadius, defaultFrame, setDefaults,
    drones,

    // Mission setup
    missionName, setMissionName,
    selectedDroneId, setSelectedDroneId,
    suiteType, setSuiteType,

    // Geofence
    geofenceEnabled, setGeofenceEnabled,
    geofenceType, setGeofenceType,
    geofenceMaxAlt, setGeofenceMaxAlt,
    geofenceAction, setGeofenceAction,

    // Context menu
    contextMenu, setContextMenu,
    showClearConfirm, setShowClearConfirm,

    // Library integration
    isDirty,
    activePlanId,

    // Handlers
    handleMapClick,
    handleMapRightClick,
    handleWaypointRightClick,
    handleContextAction,
    handleWaypointClick,
    handleWaypointDragEnd,
    handleClearAll,
    confirmClear,
    handleSave,
    handleSaveAs,
    handleExportWaypoints,
    handleExportPlan,
    handleExportKML,
    handleExportCSV,
    handlePlanLoaded,
    handlePlanRenamed,
    handleNewPlan,
    handleFocusSearch,
    handleReverseWaypoints,
    handleUpload,
    handleAddManualWaypoint,

    // Drawing state
    drawingMode,
    drawnPolygons,
    drawnCircles,
    measureLine,
    clearDrawings,
    handleDrawingComplete,
    handlePatternApply,

    // Rally points
    rallyPoints,
    addingRallyPoint,
    setAddingRallyPoint,

    // Store actions passed through
    undo, redo,
    updateWaypoint, removeWaypoint, reorderWaypoints,
    downloadMission,
  };
}
