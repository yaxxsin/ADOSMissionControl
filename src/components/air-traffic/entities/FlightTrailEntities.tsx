/**
 * @module FlightTrailEntities
 * @description Renders aircraft position trails as Cesium PolylineCollection
 * primitives. Trail color matches aircraft threat level with fading alpha.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import {
  Cartesian3,
  Color,
  PolylineCollection,
  Material,
  type Viewer as CesiumViewer,
  type Polyline,
} from "cesium";
import { useTrafficStore } from "@/stores/traffic-store";
import { THREAT_COLORS, type ThreatLevel } from "@/lib/airspace/types";

interface FlightTrailEntitiesProps {
  viewer: CesiumViewer | null;
}

export function FlightTrailEntities({ viewer }: FlightTrailEntitiesProps) {
  // aircraftTrails will be added by UX agent. Read with optional chaining.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const aircraftTrails = (useTrafficStore as any)((s: any) => s.aircraftTrails) as
    | Map<string, Array<{ lat: number; lon: number; alt: number }>>
    | undefined;
  const threatLevels = useTrafficStore((s) => s.threatLevels);

  const polyCollRef = useRef<PolylineCollection | null>(null);
  const polyIndexRef = useRef<Map<string, Polyline>>(new Map());

  // Initialize PolylineCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const polyColl = new PolylineCollection();
    viewer.scene.primitives.add(polyColl);
    polyCollRef.current = polyColl;

    return () => {
      if (!viewer.isDestroyed()) {
        viewer.scene.primitives.remove(polyColl);
      }
      polyCollRef.current = null;
      polyIndexRef.current.clear();
    };
  }, [viewer]);

  // Update polylines when trails change
  useEffect(() => {
    const polyColl = polyCollRef.current;
    if (!polyColl || !viewer || viewer.isDestroyed() || !aircraftTrails) return;

    const currentIcaos = new Set<string>();

    for (const [icao24, trail] of aircraftTrails) {
      if (trail.length < 2) continue;
      currentIcaos.add(icao24);

      const threat: ThreatLevel = threatLevels.get(icao24) ?? "other";
      const colorHex = THREAT_COLORS[threat] ?? THREAT_COLORS.other;
      const color = Color.fromCssColorString(colorHex).withAlpha(0.6);
      const positions = trail.map((p) => Cartesian3.fromDegrees(p.lon, p.lat, p.alt));

      const existing = polyIndexRef.current.get(icao24);
      if (existing) {
        existing.positions = positions;
        existing.material = Material.fromType("Color", { color });
      } else {
        const polyline = polyColl.add({
          positions,
          width: 2,
          material: Material.fromType("Color", { color }),
        });
        polyIndexRef.current.set(icao24, polyline);
      }
    }

    // Remove stale trails
    for (const [icao24, polyline] of polyIndexRef.current) {
      if (!currentIcaos.has(icao24)) {
        polyColl.remove(polyline);
        polyIndexRef.current.delete(icao24);
      }
    }

    viewer.scene.requestRender();
  }, [viewer, aircraftTrails, threatLevels]);

  return null;
}
