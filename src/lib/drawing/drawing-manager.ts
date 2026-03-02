/**
 * @module drawing/drawing-manager
 * @description Manages Leaflet drawing interactions for polygon, circle, and measure tools.
 * Not a React component. Interfaces with a Leaflet map instance directly.
 * @license GPL-3.0-only
 */

import L from "leaflet";
import type { DrawingMode } from "./types";
import { haversineDistance, formatDistance, polygonArea, formatArea } from "./geo-utils";

const DRAW_COLORS = {
  stroke: "#3a82ff",
  fill: "rgba(58, 130, 255, 0.15)",
  vertex: "#ffffff",
  vertexStroke: "#3a82ff",
  preview: "rgba(58, 130, 255, 0.5)",
  measure: "#ffffff",
  measureDash: "6 4",
  label: "rgba(10, 10, 15, 0.85)",
  labelText: "#ffffff",
} as const;

interface DrawingCallbacks {
  onPolygonComplete?: (vertices: [number, number][]) => void;
  onCircleComplete?: (center: [number, number], radius: number) => void;
  onMeasureUpdate?: (
    points: [number, number][],
    segmentDistances: number[],
    totalDistance: number
  ) => void;
  onVerticesUpdate?: (vertices: [number, number][]) => void;
  onCancel?: () => void;
}

function makeVertexIcon(color: string = DRAW_COLORS.vertex): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<div style="width:10px;height:10px;background:${color};border:1.5px solid ${DRAW_COLORS.vertexStroke};box-sizing:border-box"></div>`,
  });
}

function makeDistanceLabel(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [100, 20],
    iconAnchor: [50, 10],
    html: `<div style="font-size:10px;font-family:JetBrains Mono,monospace;color:${DRAW_COLORS.labelText};white-space:nowrap;text-align:center;background:${DRAW_COLORS.label};padding:2px 6px;border:1px solid rgba(255,255,255,0.15)">${text}</div>`,
  });
}

function makeAreaLabel(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [140, 24],
    iconAnchor: [70, 12],
    html: `<div style="font-size:11px;font-family:JetBrains Mono,monospace;color:${DRAW_COLORS.labelText};white-space:nowrap;text-align:center;background:${DRAW_COLORS.label};padding:3px 8px;border:1px solid rgba(58,130,255,0.4)">${text}</div>`,
  });
}

function makeTotalLabel(text: string): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [140, 24],
    iconAnchor: [70, 12],
    html: `<div style="font-size:11px;font-family:JetBrains Mono,monospace;color:#3a82ff;white-space:nowrap;text-align:center;background:${DRAW_COLORS.label};padding:3px 8px;border:1px solid rgba(58,130,255,0.4);font-weight:600">${text}</div>`,
  });
}

export class DrawingManager {
  private map: L.Map;
  private drawingGroup: L.FeatureGroup;
  private callbacks: DrawingCallbacks;
  private mode: DrawingMode = null;

  // Polygon state
  private polygonVertices: [number, number][] = [];
  private polygonMarkers: L.Marker[] = [];
  private polygonLine: L.Polyline | null = null;
  private polygonPreviewLine: L.Polyline | null = null;
  private polygonFill: L.Polygon | null = null;
  private polygonAreaLabel: L.Marker | null = null;

  // Circle state
  private circleCenter: [number, number] | null = null;
  private circleCenterMarker: L.Marker | null = null;
  private circleShape: L.Circle | null = null;
  private circleRadiusLabel: L.Marker | null = null;
  private circleIsDragging = false;

  // Measure state
  private measurePoints: [number, number][] = [];
  private measureMarkers: L.Marker[] = [];
  private measureLine: L.Polyline | null = null;
  private measureLabels: L.Marker[] = [];
  private measureTotalLabel: L.Marker | null = null;

  // Bound handlers (for cleanup)
  private boundClick: ((e: L.LeafletMouseEvent) => void) | null = null;
  private boundDblClick: ((e: L.LeafletMouseEvent) => void) | null = null;
  private boundMouseMove: ((e: L.LeafletMouseEvent) => void) | null = null;
  private boundMouseDown: ((e: L.LeafletMouseEvent) => void) | null = null;
  private boundMouseUp: ((e: L.LeafletMouseEvent) => void) | null = null;
  private boundKeyDown: ((e: KeyboardEvent) => void) | null = null;

  constructor(map: L.Map, callbacks: DrawingCallbacks = {}) {
    this.map = map;
    this.callbacks = callbacks;
    this.drawingGroup = L.featureGroup().addTo(map);
  }

  setCallbacks(callbacks: DrawingCallbacks): void {
    this.callbacks = callbacks;
  }

  getMode(): DrawingMode {
    return this.mode;
  }

  // ── Polygon Drawing ──────────────────────────────────────────

  startPolygonDraw(): void {
    this.cancelDraw();
    this.mode = "polygon";
    this.polygonVertices = [];

    this.boundClick = (e: L.LeafletMouseEvent) => {
      // Prevent the click event from double-fire after dblclick
      if (this.mode !== "polygon") return;
      this.addPolygonVertex(e.latlng.lat, e.latlng.lng);
    };

    this.boundDblClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e);
      if (this.polygonVertices.length >= 3) {
        this.completePolygon();
      }
    };

    this.boundMouseMove = (e: L.LeafletMouseEvent) => {
      this.updatePolygonPreview(e.latlng.lat, e.latlng.lng);
    };

    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.cancelDraw();
    };

    this.map.on("click", this.boundClick);
    this.map.on("dblclick", this.boundDblClick);
    this.map.on("mousemove", this.boundMouseMove);
    document.addEventListener("keydown", this.boundKeyDown);

    // Disable double-click zoom while drawing
    this.map.doubleClickZoom.disable();
  }

  private addPolygonVertex(lat: number, lon: number): void {
    this.polygonVertices.push([lat, lon]);

    const marker = L.marker([lat, lon], {
      icon: makeVertexIcon(),
      interactive: false,
    }).addTo(this.drawingGroup);
    this.polygonMarkers.push(marker);

    this.updatePolygonShape();
    this.callbacks.onVerticesUpdate?.(this.polygonVertices);
  }

  private updatePolygonShape(): void {
    // Remove old line and fill
    if (this.polygonLine) {
      this.drawingGroup.removeLayer(this.polygonLine);
      this.polygonLine = null;
    }
    if (this.polygonFill) {
      this.drawingGroup.removeLayer(this.polygonFill);
      this.polygonFill = null;
    }
    if (this.polygonAreaLabel) {
      this.drawingGroup.removeLayer(this.polygonAreaLabel);
      this.polygonAreaLabel = null;
    }

    if (this.polygonVertices.length >= 2) {
      this.polygonLine = L.polyline(
        this.polygonVertices.map((v) => [v[0], v[1]] as L.LatLngTuple),
        { color: DRAW_COLORS.stroke, weight: 2, opacity: 0.8 }
      ).addTo(this.drawingGroup);
    }

    if (this.polygonVertices.length >= 3) {
      this.polygonFill = L.polygon(
        this.polygonVertices.map((v) => [v[0], v[1]] as L.LatLngTuple),
        {
          color: DRAW_COLORS.stroke,
          weight: 2,
          fillColor: DRAW_COLORS.fill,
          fillOpacity: 1,
          opacity: 0.8,
        }
      ).addTo(this.drawingGroup);

      // Show area label at centroid
      const area = polygonArea(this.polygonVertices);
      const cLat = this.polygonVertices.reduce((s, v) => s + v[0], 0) / this.polygonVertices.length;
      const cLon = this.polygonVertices.reduce((s, v) => s + v[1], 0) / this.polygonVertices.length;
      this.polygonAreaLabel = L.marker([cLat, cLon], {
        icon: makeAreaLabel(formatArea(area)),
        interactive: false,
      }).addTo(this.drawingGroup);
    }
  }

  private updatePolygonPreview(lat: number, lon: number): void {
    if (this.polygonVertices.length === 0) return;

    if (this.polygonPreviewLine) {
      this.drawingGroup.removeLayer(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }

    const last = this.polygonVertices[this.polygonVertices.length - 1];
    this.polygonPreviewLine = L.polyline(
      [
        [last[0], last[1]],
        [lat, lon],
      ],
      {
        color: DRAW_COLORS.preview,
        weight: 2,
        dashArray: "4 4",
        opacity: 0.7,
      }
    ).addTo(this.drawingGroup);
  }

  private completePolygon(): void {
    if (this.polygonVertices.length < 3) return;
    const vertices = [...this.polygonVertices];
    this.removeDrawingListeners();
    this.clearDrawingLayers();
    this.mode = null;
    this.map.doubleClickZoom.enable();
    this.callbacks.onPolygonComplete?.(vertices);
  }

  // ── Circle Drawing ──────────────────────────────────────────

  startCircleDraw(): void {
    this.cancelDraw();
    this.mode = "circle";
    this.circleCenter = null;
    this.circleIsDragging = false;

    this.boundMouseDown = (e: L.LeafletMouseEvent) => {
      if (this.mode !== "circle") return;
      L.DomEvent.stop(e);
      this.circleCenter = [e.latlng.lat, e.latlng.lng];
      this.circleIsDragging = true;

      this.circleCenterMarker = L.marker([e.latlng.lat, e.latlng.lng], {
        icon: makeVertexIcon(),
        interactive: false,
      }).addTo(this.drawingGroup);

      this.circleShape = L.circle([e.latlng.lat, e.latlng.lng], {
        radius: 0,
        color: DRAW_COLORS.stroke,
        weight: 2,
        fillColor: DRAW_COLORS.fill,
        fillOpacity: 1,
        opacity: 0.8,
      }).addTo(this.drawingGroup);

      // Disable map dragging while drawing circle
      this.map.dragging.disable();
    };

    this.boundMouseMove = (e: L.LeafletMouseEvent) => {
      if (!this.circleIsDragging || !this.circleCenter || !this.circleShape) return;
      const radius = haversineDistance(
        this.circleCenter[0],
        this.circleCenter[1],
        e.latlng.lat,
        e.latlng.lng
      );
      this.circleShape.setRadius(radius);

      // Update radius label
      if (this.circleRadiusLabel) {
        this.drawingGroup.removeLayer(this.circleRadiusLabel);
      }
      const midLat = (this.circleCenter[0] + e.latlng.lat) / 2;
      const midLon = (this.circleCenter[1] + e.latlng.lng) / 2;
      this.circleRadiusLabel = L.marker([midLat, midLon], {
        icon: makeDistanceLabel(`r = ${formatDistance(radius)}`),
        interactive: false,
      }).addTo(this.drawingGroup);
    };

    this.boundMouseUp = (e: L.LeafletMouseEvent) => {
      if (!this.circleIsDragging || !this.circleCenter) return;
      this.circleIsDragging = false;
      this.map.dragging.enable();

      const radius = haversineDistance(
        this.circleCenter[0],
        this.circleCenter[1],
        e.latlng.lat,
        e.latlng.lng
      );

      if (radius < 1) {
        // Too small, cancel
        this.clearDrawingLayers();
        return;
      }

      const center: [number, number] = [...this.circleCenter];
      this.removeDrawingListeners();
      this.clearDrawingLayers();
      this.mode = null;
      this.callbacks.onCircleComplete?.(center, radius);
    };

    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (this.circleIsDragging) {
          this.map.dragging.enable();
        }
        this.cancelDraw();
      }
    };

    this.map.on("mousedown", this.boundMouseDown);
    this.map.on("mousemove", this.boundMouseMove);
    this.map.on("mouseup", this.boundMouseUp);
    document.addEventListener("keydown", this.boundKeyDown);
  }

  // ── Measure Tool ──────────────────────────────────────────

  startMeasure(): void {
    this.cancelDraw();
    this.mode = "measure";
    this.measurePoints = [];

    this.boundClick = (e: L.LeafletMouseEvent) => {
      if (this.mode !== "measure") return;
      this.addMeasurePoint(e.latlng.lat, e.latlng.lng);
    };

    this.boundDblClick = (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e);
      this.completeMeasure();
    };

    this.boundMouseMove = (e: L.LeafletMouseEvent) => {
      this.updateMeasurePreview(e.latlng.lat, e.latlng.lng);
    };

    this.boundKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") this.completeMeasure();
    };

    this.map.on("click", this.boundClick);
    this.map.on("dblclick", this.boundDblClick);
    this.map.on("mousemove", this.boundMouseMove);
    document.addEventListener("keydown", this.boundKeyDown);

    this.map.doubleClickZoom.disable();
  }

  private addMeasurePoint(lat: number, lon: number): void {
    this.measurePoints.push([lat, lon]);

    const marker = L.marker([lat, lon], {
      icon: makeVertexIcon(DRAW_COLORS.measure),
      interactive: false,
    }).addTo(this.drawingGroup);
    this.measureMarkers.push(marker);

    this.updateMeasureLine();
    this.emitMeasureUpdate();
  }

  private updateMeasureLine(): void {
    // Remove old line
    if (this.measureLine) {
      this.drawingGroup.removeLayer(this.measureLine);
      this.measureLine = null;
    }
    // Remove old labels
    for (const label of this.measureLabels) {
      this.drawingGroup.removeLayer(label);
    }
    this.measureLabels = [];
    if (this.measureTotalLabel) {
      this.drawingGroup.removeLayer(this.measureTotalLabel);
      this.measureTotalLabel = null;
    }

    if (this.measurePoints.length < 2) return;

    this.measureLine = L.polyline(
      this.measurePoints.map((p) => [p[0], p[1]] as L.LatLngTuple),
      {
        color: DRAW_COLORS.measure,
        weight: 2,
        dashArray: DRAW_COLORS.measureDash,
        opacity: 0.9,
      }
    ).addTo(this.drawingGroup);

    // Segment distance labels
    let total = 0;
    for (let i = 1; i < this.measurePoints.length; i++) {
      const prev = this.measurePoints[i - 1];
      const curr = this.measurePoints[i];
      const dist = haversineDistance(prev[0], prev[1], curr[0], curr[1]);
      total += dist;

      const midLat = (prev[0] + curr[0]) / 2;
      const midLon = (prev[1] + curr[1]) / 2;
      const label = L.marker([midLat, midLon], {
        icon: makeDistanceLabel(formatDistance(dist)),
        interactive: false,
      }).addTo(this.drawingGroup);
      this.measureLabels.push(label);
    }

    // Total distance label at last point
    if (this.measurePoints.length >= 2) {
      const last = this.measurePoints[this.measurePoints.length - 1];
      this.measureTotalLabel = L.marker([last[0], last[1]], {
        icon: makeTotalLabel(`Total: ${formatDistance(total)}`),
        interactive: false,
      }).addTo(this.drawingGroup);
      // Offset label slightly above the point
      const offset = this.map.latLngToContainerPoint([last[0], last[1]]);
      const newLatLng = this.map.containerPointToLatLng([offset.x, offset.y - 20]);
      this.measureTotalLabel.setLatLng(newLatLng);
    }
  }

  private updateMeasurePreview(lat: number, lon: number): void {
    // For measure, we show a preview line from last point to cursor
    // Reuse polygonPreviewLine field for simplicity
    if (this.measurePoints.length === 0) return;

    if (this.polygonPreviewLine) {
      this.drawingGroup.removeLayer(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }

    const last = this.measurePoints[this.measurePoints.length - 1];
    this.polygonPreviewLine = L.polyline(
      [
        [last[0], last[1]],
        [lat, lon],
      ],
      {
        color: DRAW_COLORS.measure,
        weight: 1.5,
        dashArray: "3 3",
        opacity: 0.5,
      }
    ).addTo(this.drawingGroup);
  }

  private emitMeasureUpdate(): void {
    const segmentDistances: number[] = [];
    let total = 0;
    for (let i = 1; i < this.measurePoints.length; i++) {
      const prev = this.measurePoints[i - 1];
      const curr = this.measurePoints[i];
      const dist = haversineDistance(prev[0], prev[1], curr[0], curr[1]);
      segmentDistances.push(dist);
      total += dist;
    }
    this.callbacks.onMeasureUpdate?.(
      [...this.measurePoints],
      segmentDistances,
      total
    );
  }

  private completeMeasure(): void {
    this.emitMeasureUpdate();
    this.removeDrawingListeners();
    // Keep measure layers visible (don't clear) so user can see results
    this.mode = null;
    this.map.doubleClickZoom.enable();
  }

  // ── Cancel / Cleanup ──────────────────────────────────────

  cancelDraw(): void {
    if (this.mode === null) return;
    const wasCircleDragging = this.circleIsDragging;
    this.removeDrawingListeners();
    this.clearDrawingLayers();
    this.mode = null;
    this.map.doubleClickZoom.enable();
    if (wasCircleDragging) {
      this.map.dragging.enable();
    }
    this.callbacks.onCancel?.();
  }

  clearAll(): void {
    this.cancelDraw();
    this.drawingGroup.clearLayers();
  }

  private removeDrawingListeners(): void {
    if (this.boundClick) {
      this.map.off("click", this.boundClick);
      this.boundClick = null;
    }
    if (this.boundDblClick) {
      this.map.off("dblclick", this.boundDblClick);
      this.boundDblClick = null;
    }
    if (this.boundMouseMove) {
      this.map.off("mousemove", this.boundMouseMove);
      this.boundMouseMove = null;
    }
    if (this.boundMouseDown) {
      this.map.off("mousedown", this.boundMouseDown);
      this.boundMouseDown = null;
    }
    if (this.boundMouseUp) {
      this.map.off("mouseup", this.boundMouseUp);
      this.boundMouseUp = null;
    }
    if (this.boundKeyDown) {
      document.removeEventListener("keydown", this.boundKeyDown);
      this.boundKeyDown = null;
    }
  }

  private clearDrawingLayers(): void {
    // Polygon
    this.polygonVertices = [];
    for (const m of this.polygonMarkers) this.drawingGroup.removeLayer(m);
    this.polygonMarkers = [];
    if (this.polygonLine) {
      this.drawingGroup.removeLayer(this.polygonLine);
      this.polygonLine = null;
    }
    if (this.polygonPreviewLine) {
      this.drawingGroup.removeLayer(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }
    if (this.polygonFill) {
      this.drawingGroup.removeLayer(this.polygonFill);
      this.polygonFill = null;
    }
    if (this.polygonAreaLabel) {
      this.drawingGroup.removeLayer(this.polygonAreaLabel);
      this.polygonAreaLabel = null;
    }

    // Circle
    this.circleCenter = null;
    this.circleIsDragging = false;
    if (this.circleCenterMarker) {
      this.drawingGroup.removeLayer(this.circleCenterMarker);
      this.circleCenterMarker = null;
    }
    if (this.circleShape) {
      this.drawingGroup.removeLayer(this.circleShape);
      this.circleShape = null;
    }
    if (this.circleRadiusLabel) {
      this.drawingGroup.removeLayer(this.circleRadiusLabel);
      this.circleRadiusLabel = null;
    }

    // Measure
    this.measurePoints = [];
    for (const m of this.measureMarkers) this.drawingGroup.removeLayer(m);
    this.measureMarkers = [];
    if (this.measureLine) {
      this.drawingGroup.removeLayer(this.measureLine);
      this.measureLine = null;
    }
    for (const l of this.measureLabels) this.drawingGroup.removeLayer(l);
    this.measureLabels = [];
    if (this.measureTotalLabel) {
      this.drawingGroup.removeLayer(this.measureTotalLabel);
      this.measureTotalLabel = null;
    }
  }

  /**
   * Full cleanup. Call when unmounting.
   */
  destroy(): void {
    this.cancelDraw();
    this.map.removeLayer(this.drawingGroup);
  }
}
