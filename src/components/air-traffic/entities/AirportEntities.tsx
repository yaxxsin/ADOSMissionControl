/**
 * @module AirportEntities
 * @description Renders airports on the CesiumJS globe using PointPrimitiveCollection + LabelCollection.
 * Camera-altitude-based LOD: large airports visible first, details at close range.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Cartesian3,
  Cartographic,
  Color,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  NearFarScalar,
  Math as CesiumMath,
  PointPrimitiveCollection,
  LabelCollection,
  type Viewer as CesiumViewer,
} from "cesium";
import {
  getAirportsSync,
  preloadAirports,
  type Airport,
} from "@/lib/airspace/airport-database";

interface AirportEntitiesProps {
  viewer: CesiumViewer | null;
}

const LOD_GLOBAL = 500_000; // >500km: large airports as faint dots
const LOD_REGIONAL = 100_000; // 100-500km: all airports + ICAO labels for large
const DEBOUNCE_MS = 200;
const DOT_COLOR = Color.WHITE.withAlpha(0.5);
const DOT_COLOR_BRIGHT = Color.WHITE.withAlpha(1.0);

function getBbox(
  viewer: CesiumViewer,
): { south: number; north: number; west: number; east: number } | null {
  const canvas = viewer.scene.canvas;
  const camera = viewer.scene.camera;
  const tl = camera.pickEllipsoid(
    new Cartesian3(0, 0, 0),
    viewer.scene.globe.ellipsoid,
  );
  const br = camera.pickEllipsoid(
    new Cartesian3(canvas.clientWidth, canvas.clientHeight, 0),
    viewer.scene.globe.ellipsoid,
  );
  if (!tl || !br) {
    // Fallback: use camera position + rough extent from altitude
    const camPos = Cartographic.fromCartesian(camera.positionWC);
    const lat = CesiumMath.toDegrees(camPos.latitude);
    const lon = CesiumMath.toDegrees(camPos.longitude);
    const altKm = camPos.height / 1000;
    const spread = Math.min(altKm / 111, 80);
    return {
      south: lat - spread,
      north: lat + spread,
      west: lon - spread * 1.5,
      east: lon + spread * 1.5,
    };
  }
  const tlCarto = Cartographic.fromCartesian(tl);
  const brCarto = Cartographic.fromCartesian(br);
  return {
    south: Math.min(
      CesiumMath.toDegrees(tlCarto.latitude),
      CesiumMath.toDegrees(brCarto.latitude),
    ),
    north: Math.max(
      CesiumMath.toDegrees(tlCarto.latitude),
      CesiumMath.toDegrees(brCarto.latitude),
    ),
    west: Math.min(
      CesiumMath.toDegrees(tlCarto.longitude),
      CesiumMath.toDegrees(brCarto.longitude),
    ),
    east: Math.max(
      CesiumMath.toDegrees(tlCarto.longitude),
      CesiumMath.toDegrees(brCarto.longitude),
    ),
  };
}

interface AirportEntry {
  point: ReturnType<PointPrimitiveCollection["add"]>;
  label: ReturnType<LabelCollection["add"]> | null;
}

export function AirportEntities({ viewer }: AirportEntitiesProps) {
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);
  const indexRef = useRef<Map<string, AirportEntry>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize persistent collections once
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const points = new PointPrimitiveCollection();
    const labels = new LabelCollection({ scene: viewer.scene });
    viewer.scene.primitives.add(points);
    viewer.scene.primitives.add(labels);
    pointsRef.current = points;
    labelsRef.current = labels;

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(points);
        viewer.scene.primitives.remove(labels);
      }
      pointsRef.current = null;
      labelsRef.current = null;
      indexRef.current.clear();
    };
  }, [viewer]);

  const updateEntities = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;
    const points = pointsRef.current;
    const labels = labelsRef.current;
    if (!points || !labels) return;

    const airports = getAirportsSync();
    if (airports.length === 0) return;

    const camPos = Cartographic.fromCartesian(viewer.scene.camera.positionWC);
    const altMeters = camPos.height;
    const bbox = getBbox(viewer);
    if (!bbox) return;

    // Filter airports in viewport
    const visible = airports.filter(
      (a) =>
        a.lat >= bbox.south &&
        a.lat <= bbox.north &&
        a.lon >= bbox.west &&
        a.lon <= bbox.east,
    );

    // LOD filtering
    const isGlobal = altMeters > LOD_GLOBAL;
    const isRegional = altMeters > LOD_REGIONAL;
    const filtered = isGlobal
      ? visible.filter((a) => a.type === "large_airport")
      : visible;

    // Find closest airport to camera for highlight
    const camLat = CesiumMath.toDegrees(camPos.latitude);
    const camLon = CesiumMath.toDegrees(camPos.longitude);
    let closestDist = Infinity;
    let closestIcao = "";
    for (const a of filtered) {
      const d = (a.lat - camLat) ** 2 + (a.lon - camLon) ** 2;
      if (d < closestDist) {
        closestDist = d;
        closestIcao = a.icao;
      }
    }

    const currentIcaos = new Set<string>();

    for (const airport of filtered) {
      currentIcaos.add(airport.icao);
      const position = Cartesian3.fromDegrees(airport.lon, airport.lat);
      const isClosest = airport.icao === closestIcao;
      const pixelSize = isGlobal ? 3 : isRegional ? 4 : 5;
      const color = isClosest ? DOT_COLOR_BRIGHT : DOT_COLOR;

      const showLabel = isGlobal
        ? false
        : isRegional
          ? airport.type === "large_airport"
          : true;

      const existing = indexRef.current.get(airport.icao);
      if (existing) {
        // Update existing point
        existing.point.position = position;
        existing.point.pixelSize = pixelSize;
        existing.point.color = color;

        // Update or add/remove label
        if (showLabel) {
          const isDetailed = !isRegional;
          const text = isDetailed
            ? `${airport.name}${airport.iata ? ` (${airport.iata})` : ""}\n${airport.elevation}m`
            : airport.icao;

          if (existing.label) {
            existing.label.position = position;
            existing.label.text = text;
            existing.label.font = isDetailed ? "11px monospace" : "10px monospace";
            existing.label.show = true;
          } else {
            existing.label = labels.add({
              position,
              text,
              font: isDetailed ? "11px monospace" : "10px monospace",
              fillColor: Color.WHITE.withAlpha(0.8),
              outlineColor: Color.BLACK.withAlpha(0.6),
              outlineWidth: 2,
              style: LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: VerticalOrigin.BOTTOM,
              horizontalOrigin: HorizontalOrigin.LEFT,
              pixelOffset: new Cartesian3(6, -4, 0),
              disableDepthTestDistance: 5000,
              scaleByDistance: new NearFarScalar(5_000, 1.0, 500_000, 0.4),
            });
          }
        } else if (existing.label) {
          existing.label.show = false;
        }
      } else {
        // Add new point
        const point = points.add({
          position,
          pixelSize,
          color,
          disableDepthTestDistance: 5000,
        });

        let label: ReturnType<LabelCollection["add"]> | null = null;
        if (showLabel) {
          const isDetailed = !isRegional;
          const text = isDetailed
            ? `${airport.name}${airport.iata ? ` (${airport.iata})` : ""}\n${airport.elevation}m`
            : airport.icao;

          label = labels.add({
            position,
            text,
            font: isDetailed ? "11px monospace" : "10px monospace",
            fillColor: Color.WHITE.withAlpha(0.8),
            outlineColor: Color.BLACK.withAlpha(0.6),
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            horizontalOrigin: HorizontalOrigin.LEFT,
            pixelOffset: new Cartesian3(6, -4, 0),
            disableDepthTestDistance: 5000,
            scaleByDistance: new NearFarScalar(5_000, 1.0, 500_000, 0.4),
          });
        }

        indexRef.current.set(airport.icao, { point, label });
      }
    }

    // Remove stale entries
    for (const [icao, entry] of indexRef.current) {
      if (!currentIcaos.has(icao)) {
        points.remove(entry.point);
        if (entry.label) labels.remove(entry.label);
        indexRef.current.delete(icao);
      }
    }
  }, [viewer]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Preload airports, then do initial render
    preloadAirports().then(() => {
      updateEntities();
    });

    const onCameraMove = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(updateEntities, DEBOUNCE_MS);
    };

    viewer.camera.moveEnd.addEventListener(onCameraMove);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (viewer && !viewer.isDestroyed()) {
        viewer.camera.moveEnd.removeEventListener(onCameraMove);
      }
    };
  }, [viewer, updateEntities]);

  return null;
}
