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

export function AirportEntities({ viewer }: AirportEntitiesProps) {
  const pointsRef = useRef<PointPrimitiveCollection | null>(null);
  const labelsRef = useRef<LabelCollection | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateEntities = useCallback(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old primitives
    if (pointsRef.current) {
      viewer.scene.primitives.remove(pointsRef.current);
      pointsRef.current = null;
    }
    if (labelsRef.current) {
      viewer.scene.primitives.remove(labelsRef.current);
      labelsRef.current = null;
    }

    const airports = getAirportsSync();
    if (airports.length === 0) return;

    const camPos = Cartographic.fromCartesian(
      viewer.scene.camera.positionWC,
    );
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

    if (filtered.length === 0) return;

    const points = new PointPrimitiveCollection();
    const labels = new LabelCollection({ scene: viewer.scene });

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

    for (const airport of filtered) {
      const position = Cartesian3.fromDegrees(airport.lon, airport.lat);
      const isClosest = airport.icao === closestIcao;

      points.add({
        position,
        pixelSize: isGlobal ? 3 : isRegional ? 4 : 5,
        color: isClosest ? DOT_COLOR_BRIGHT : DOT_COLOR,
        disableDepthTestDistance: 5000,
      });

      // Labels
      const showLabel = isGlobal
        ? false
        : isRegional
          ? airport.type === "large_airport"
          : true;

      if (showLabel) {
        const isDetailed = !isRegional;
        const text = isDetailed
          ? `${airport.name}${airport.iata ? ` (${airport.iata})` : ""}\n${airport.elevation}m`
          : airport.icao;

        labels.add({
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
    }

    viewer.scene.primitives.add(points);
    viewer.scene.primitives.add(labels);
    pointsRef.current = points;
    labelsRef.current = labels;
    viewer.scene.requestRender();
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
        if (pointsRef.current) {
          viewer.scene.primitives.remove(pointsRef.current);
          pointsRef.current = null;
        }
        if (labelsRef.current) {
          viewer.scene.primitives.remove(labelsRef.current);
          labelsRef.current = null;
        }
      }
    };
  }, [viewer, updateEntities]);

  return null;
}
