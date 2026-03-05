/**
 * @module PlannerMap
 * @description Leaflet-based mission planner map component. Renders waypoint markers
 * (draggable in select mode), path polyline, segment distance/bearing labels,
 * drawing overlays (polygon, circle, measure), and handles click/right-click/drag events.
 * Uses dark CARTO tiles.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useCallback, useMemo, useState, useRef } from "react";
import dynamic from "next/dynamic";
import type { Waypoint, PlannerTool } from "@/lib/types";
import type { RallyPoint } from "@/stores/rally-store";
import type { DrawnPolygon, DrawnCircle } from "@/lib/drawing/types";
import { haversineDistance, bearing } from "@/lib/telemetry-utils";
import { MAP_COLORS } from "@/lib/map-constants";
import { useDefaultCenter } from "@/hooks/use-default-center";
import { DrawingManager } from "@/lib/drawing/drawing-manager";
import { useDrawingStore } from "@/stores/drawing-store";
import { usePlannerStore } from "@/stores/planner-store";
import { polygonArea } from "@/lib/drawing/geo-utils";
import { randomId } from "@/lib/utils";
import L from "leaflet";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayerSwitcher = dynamic(
  () => import("@/components/map/TileLayerSwitcher").then((m) => ({ default: m.TileLayerSwitcher })),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const GcsMarker = dynamic(
  () => import("@/components/map/GcsMarker").then((m) => ({ default: m.GcsMarker })),
  { ssr: false }
);
const PatternOverlay = dynamic(
  () => import("@/components/planner/PatternOverlay").then((m) => ({ default: m.PatternOverlay })),
  { ssr: false }
);
const LocateControl = dynamic(
  () => import("@/components/map/LocateControl").then((m) => ({ default: m.LocateControl })),
  { ssr: false }
);

const DRAWING_TOOLS: PlannerTool[] = ["polygon", "circle", "measure"];

function makeWaypointIcon(index: number, selected: boolean): L.DivIcon {
  const fill = selected ? MAP_COLORS.accentSelected : MAP_COLORS.accentPrimary;
  const stroke = selected ? MAP_COLORS.accentPrimary : MAP_COLORS.foreground;
  const textFill = selected ? MAP_COLORS.background : "#fff";
  return L.divIcon({
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="11" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
      <text x="12" y="16" text-anchor="middle" fill="${textFill}" font-size="11" font-family="JetBrains Mono, monospace" font-weight="600">${index + 1}</text>
    </svg>`,
  });
}

function makeSegmentLabel(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [80, 16],
    iconAnchor: [40, 8],
    html: `<div style="font-size:9px;font-family:JetBrains Mono,monospace;color:${MAP_COLORS.muted};white-space:nowrap;text-align:center;background:rgba(10,10,15,0.7);padding:1px 4px;border:1px solid rgba(255,255,255,0.1)">${text}</div>`,
  });
}

function makeRallyIcon(index: number): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    html: `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <polygon points="11,2 20,19 2,19" fill="${MAP_COLORS.rally}" stroke="${MAP_COLORS.foreground}" stroke-width="1.2"/>
      <text x="11" y="16" text-anchor="middle" fill="${MAP_COLORS.foreground}" font-size="9" font-family="JetBrains Mono, monospace" font-weight="600">R${index + 1}</text>
    </svg>`,
  });
}

function formatDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

const PLACEMENT_TOOLS: PlannerTool[] = ["waypoint", "takeoff", "land", "loiter", "roi", "rally"];

const TOOL_CURSORS: Record<PlannerTool, string> = {
  select: "default",
  waypoint: "crosshair",
  takeoff: "crosshair",
  land: "crosshair",
  loiter: "crosshair",
  roi: "crosshair",
  rally: "crosshair",
  polygon: "crosshair",
  circle: "crosshair",
  measure: "help",
};

const TOOL_INSTRUCTIONS: Partial<Record<PlannerTool, string>> = {
  takeoff: "Click map to place takeoff point",
  land: "Click map to place landing point",
  loiter: "Click map to place loiter point",
  roi: "Click map to set region of interest",
  rally: "Click map to place rally point",
};

function makeMeasureLabel(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [120, 20],
    iconAnchor: [60, -4],
    html: `<div style="font-size:10px;font-family:JetBrains Mono,monospace;color:${MAP_COLORS.foreground};white-space:nowrap;text-align:center;background:rgba(10,10,15,0.85);padding:2px 6px;border:1px solid ${MAP_COLORS.muted}">${text}</div>`,
  });
}

interface PlannerMapProps {
  waypoints: Waypoint[];
  activeTool: PlannerTool;
  selectedWaypointId: string | null;
  hasActivePlan: boolean;
  rallyPoints?: RallyPoint[];
  onMapClick: (lat: number, lon: number) => void;
  onMapRightClick: (lat: number, lon: number, x: number, y: number) => void;
  onWaypointClick: (id: string) => void;
  onWaypointDragEnd: (id: string, lat: number, lon: number) => void;
  onWaypointRightClick: (id: string, x: number, y: number) => void;
  onDrawingComplete?: (shape: DrawnPolygon | DrawnCircle) => void;
}

export function PlannerMap({
  waypoints,
  activeTool,
  selectedWaypointId,
  hasActivePlan,
  rallyPoints = [],
  onMapClick,
  onMapRightClick,
  onWaypointClick,
  onWaypointDragEnd,
  onWaypointRightClick,
  onDrawingComplete,
}: PlannerMapProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [zoom, setZoom] = useState(13);
  const drawingManagerRef = useRef<DrawingManager | null>(null);

  const drawingMode = useDrawingStore((s) => s.drawingMode);
  const setDrawingMode = useDrawingStore((s) => s.setDrawingMode);
  const addPolygon = useDrawingStore((s) => s.addPolygon);
  const addCircle = useDrawingStore((s) => s.addCircle);
  const setMeasureLine = useDrawingStore((s) => s.setMeasureLine);
  const setActiveDrawingVertices = useDrawingStore((s) => s.setActiveDrawingVertices);
  const measureLine = useDrawingStore((s) => s.measureLine);

  const setActiveTool = usePlannerStore((s) => s.setActiveTool);
  const fitRequestTs = usePlannerStore((s) => s.fitRequestTs);
  const clearFitRequest = usePlannerStore((s) => s.clearFitRequest);

  const defaultCenter = useDefaultCenter();
  const isDrawingTool = DRAWING_TOOLS.includes(activeTool);

  // Initialize DrawingManager when map is ready
  useEffect(() => {
    if (!mapInstance) return;

    const manager = new DrawingManager(mapInstance);
    drawingManagerRef.current = manager;

    return () => {
      manager.destroy();
      drawingManagerRef.current = null;
    };
  }, [mapInstance]);

  // Update DrawingManager callbacks (they depend on store actions)
  useEffect(() => {
    const manager = drawingManagerRef.current;
    if (!manager) return;

    manager.setCallbacks({
      onPolygonComplete: (vertices) => {
        const id = randomId();
        const area = polygonArea(vertices);
        const shape: DrawnPolygon = { id, vertices, area };
        addPolygon(shape);
        onDrawingComplete?.(shape);
        setDrawingMode(null);
        setActiveDrawingVertices([]);
      },
      onCircleComplete: (center, radius) => {
        const id = randomId();
        const shape: DrawnCircle = { id, center, radius };
        addCircle(shape);
        onDrawingComplete?.(shape);
        setDrawingMode(null);
      },
      onMeasureUpdate: (points, segmentDistances, totalDistance) => {
        setMeasureLine({ points, segmentDistances, totalDistance });
      },
      onVerticesUpdate: (vertices) => {
        setActiveDrawingVertices(vertices);
      },
      onCancel: () => {
        setDrawingMode(null);
        setActiveDrawingVertices([]);
      },
    });
  }, [addPolygon, addCircle, setMeasureLine, setDrawingMode, setActiveDrawingVertices, onDrawingComplete]);

  // Route activeTool changes to DrawingManager
  useEffect(() => {
    const manager = drawingManagerRef.current;
    if (!manager) return;

    if (activeTool === "polygon") {
      setDrawingMode("polygon");
      manager.startPolygonDraw();
    } else if (activeTool === "circle") {
      setDrawingMode("circle");
      manager.startCircleDraw();
    } else if (activeTool === "measure") {
      setDrawingMode("measure");
      setMeasureLine(null);
      manager.startMeasure();
    } else {
      // select, placement tools: cancel any active drawing
      if (manager.getMode() !== null) {
        manager.cancelDraw();
        setDrawingMode(null);
        setActiveDrawingVertices([]);
      }
    }
  }, [activeTool, setDrawingMode, setMeasureLine, setActiveDrawingVertices]);

  // Auto-restart drawing when previous draw completes but tool is still active
  useEffect(() => {
    const manager = drawingManagerRef.current;
    if (!manager || drawingMode !== null) return;
    if (activeTool === "polygon") {
      setDrawingMode("polygon");
      manager.startPolygonDraw();
    } else if (activeTool === "circle") {
      setDrawingMode("circle");
      manager.startCircleDraw();
    }
    // Measure: don't auto-restart (single measurement is the typical use)
  }, [drawingMode, activeTool, setDrawingMode]);

  // Map click handler: only fire for waypoint tool (not drawing tools)
  useEffect(() => {
    if (!mapInstance) return;

    const clickHandler = (e: L.LeafletMouseEvent) => {
      if (PLACEMENT_TOOLS.includes(activeTool)) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
      // Drawing tools handle their own click events via DrawingManager
    };

    const contextHandler = (e: L.LeafletMouseEvent) => {
      e.originalEvent.preventDefault();
      if (DRAWING_TOOLS.includes(activeTool)) {
        // Right-click exits drawing tool
        const manager = drawingManagerRef.current;
        if (manager && manager.getMode() !== null) {
          manager.cancelDraw();
          setDrawingMode(null);
          setActiveDrawingVertices([]);
        }
        setActiveTool("select");
        return;
      }
      const point = mapInstance.latLngToContainerPoint(e.latlng);
      const rect = mapInstance.getContainer().getBoundingClientRect();
      onMapRightClick(e.latlng.lat, e.latlng.lng, rect.left + point.x, rect.top + point.y);
    };

    const zoomHandler = () => setZoom(mapInstance.getZoom());

    mapInstance.on("click", clickHandler);
    mapInstance.on("contextmenu", contextHandler);
    mapInstance.on("zoomend", zoomHandler);

    return () => {
      mapInstance.off("click", clickHandler);
      mapInstance.off("contextmenu", contextHandler);
      mapInstance.off("zoomend", zoomHandler);
    };
  }, [mapInstance, activeTool, onMapClick, onMapRightClick, setActiveTool, setDrawingMode, setActiveDrawingVertices]);

  // Set cursor based on tool
  useEffect(() => {
    if (!mapInstance) return;
    mapInstance.getContainer().style.cursor = TOOL_CURSORS[activeTool];
  }, [mapInstance, activeTool]);

  // Fit map bounds when fitRequestTs changes (triggered by download from drone, etc.)
  useEffect(() => {
    if (!mapInstance || fitRequestTs === 0 || waypoints.length === 0) return;
    const bounds = L.latLngBounds(waypoints.map((wp) => [wp.lat, wp.lon] as [number, number]));
    mapInstance.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
    clearFitRequest();
  }, [mapInstance, fitRequestTs, waypoints, clearFitRequest]);

  const polylinePositions: [number, number][] = waypoints.map((wp) => [wp.lat, wp.lon]);

  // Compute segment labels
  const segments = useMemo(() => {
    if (zoom < 14 || waypoints.length < 2) return [];
    return waypoints.slice(1).map((wp, i) => {
      const prev = waypoints[i];
      const dist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);
      const brg = bearing(prev.lat, prev.lon, wp.lat, wp.lon);
      const midLat = (prev.lat + wp.lat) / 2;
      const midLon = (prev.lon + wp.lon) / 2;
      return {
        key: `seg-${prev.id}-${wp.id}`,
        position: [midLat, midLon] as [number, number],
        label: `${formatDist(dist)} ${Math.round(brg)}°`,
      };
    });
  }, [waypoints, zoom]);

  return (
    <div className="w-full h-full relative">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        className="w-full h-full"
        zoomControl={false}
        attributionControl={false}
        style={{ background: "#0a0a0a" }}
        ref={(instance) => {
          if (instance) setMapInstance(instance);
        }}
      >
        <TileLayerSwitcher />

        {/* Path polyline */}
        {polylinePositions.length >= 2 && (
          <Polyline
            positions={polylinePositions}
            pathOptions={{
              color: MAP_COLORS.accentPrimary,
              weight: 2,
              dashArray: "6 4",
              opacity: 0.8,
            }}
          />
        )}

        {/* Segment distance/bearing labels */}
        {segments.map((seg) => (
          <Marker
            key={seg.key}
            position={seg.position}
            icon={makeSegmentLabel(seg.label)}
            interactive={false}
          />
        ))}

        <GcsMarker />
        <LocateControl />
        <PatternOverlay />

        {/* Waypoint markers */}
        {waypoints.map((wp, i) => (
          <Marker
            key={wp.id}
            position={[wp.lat, wp.lon]}
            icon={makeWaypointIcon(i, wp.id === selectedWaypointId)}
            draggable={activeTool === "select"}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                onWaypointClick(wp.id);
              },
              dragend: (e) => {
                const latlng = e.target.getLatLng();
                onWaypointDragEnd(wp.id, latlng.lat, latlng.lng);
              },
              contextmenu: (e) => {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                onWaypointRightClick(wp.id, e.originalEvent.clientX, e.originalEvent.clientY);
              },
            }}
          />
        ))}

        {/* Rally point markers (orange triangles) */}
        {rallyPoints.map((rp, i) => (
          <Marker
            key={`rally-${rp.id}`}
            position={[rp.lat, rp.lon]}
            icon={makeRallyIcon(i)}
            interactive={false}
          />
        ))}

        {/* Measure line overlay */}
        {measureLine && measureLine.points.length >= 2 && (
          <>
            <Polyline
              positions={measureLine.points.map((p) => [p[0], p[1]] as [number, number])}
              pathOptions={{ color: MAP_COLORS.muted, weight: 2, dashArray: "4 4" }}
            />
            {measureLine.points.map((pt, i) =>
              i > 0 ? (
                <Marker
                  key={`meas-seg-${i}`}
                  position={[
                    (pt[0] + measureLine.points[i - 1][0]) / 2,
                    (pt[1] + measureLine.points[i - 1][1]) / 2,
                  ]}
                  icon={makeSegmentLabel(formatDist(measureLine.segmentDistances[i - 1]))}
                  interactive={false}
                />
              ) : null
            )}
            <Marker
              position={measureLine.points[measureLine.points.length - 1]}
              icon={makeMeasureLabel(`Total: ${formatDist(measureLine.totalDistance)}`)}
              interactive={false}
            />
          </>
        )}
      </MapContainer>

      {/* Instructions overlay — placement tools */}
      {TOOL_INSTRUCTIONS[activeTool] && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-bg-secondary/90 border border-accent-primary/30 px-3 py-1.5">
            <span className="text-xs text-accent-primary font-mono">
              {TOOL_INSTRUCTIONS[activeTool]}
            </span>
          </div>
        </div>
      )}

      {/* Instructions overlay — default (no waypoints, no special tool) */}
      {waypoints.length === 0 && !isDrawingTool && !TOOL_INSTRUCTIONS[activeTool] && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-bg-secondary/90 border border-border-default px-3 py-1.5">
            <span className="text-xs text-text-secondary font-mono">
              {hasActivePlan
                ? "Click on map to add waypoints"
                : "Create or select a flight plan to start"}
            </span>
          </div>
        </div>
      )}

      {/* Drawing mode instructions */}
      {isDrawingTool && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="bg-bg-secondary/90 border border-accent-primary/30 px-3 py-1.5">
            <span className="text-xs text-accent-primary font-mono">
              {activeTool === "polygon" && "Click to place vertices, double-click to close. Right-click to cancel."}
              {activeTool === "circle" && "Click and drag to draw circle. Right-click to cancel."}
              {activeTool === "measure" && "Click to add points, double-click to finish. Right-click to cancel."}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
