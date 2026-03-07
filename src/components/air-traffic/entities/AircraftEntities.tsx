/**
 * @module AircraftEntities
 * @description Renders live aircraft positions as billboards with heading rotation
 * and threat-level coloring on the CesiumJS globe.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import { Cartesian3, Cartesian2, Color, LabelStyle, VerticalOrigin, HorizontalOrigin, Math as CesiumMath, type Viewer as CesiumViewer } from "cesium";
import { useTrafficStore } from "@/stores/traffic-store";
import { THREAT_COLORS, type ThreatLevel } from "@/lib/airspace/types";

interface AircraftEntitiesProps {
  viewer: CesiumViewer | null;
}

/** SVG aircraft icon (top-down silhouette) rendered as a data URI. */
function createAircraftSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <path d="M16 2 L20 14 L30 18 L20 20 L18 30 L16 24 L14 30 L12 20 L2 18 L12 14 Z" fill="${color}" stroke="#000" stroke-width="0.5"/>
  </svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

export function AircraftEntities({ viewer }: AircraftEntitiesProps) {
  const aircraft = useTrafficStore((s) => s.aircraft);
  const threatLevels = useTrafficStore((s) => s.threatLevels);
  const altitudeFilter = useTrafficStore((s) => s.altitudeFilter);
  const layerVisible = useTrafficStore((s) => s.polling);
  const entityIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const currentIds = new Set<string>();

    for (const [icao24, ac] of aircraft) {
      // Filter by altitude
      if (ac.altitudeMsl !== null && ac.altitudeMsl > altitudeFilter) continue;
      // Skip aircraft with no position
      if (ac.lat === 0 && ac.lon === 0) continue;

      const entityId = `aircraft-${icao24}`;
      currentIds.add(entityId);

      const threat: ThreatLevel = threatLevels.get(icao24) ?? "other";
      const color = THREAT_COLORS[threat];
      const altM = ac.altitudeMsl ?? 0;
      const heading = ac.heading ?? 0;
      const callsign = ac.callsign?.trim() || icao24.toUpperCase();

      const existing = viewer.entities.getById(entityId);
      if (existing) {
        // Update position and rotation
        existing.position = Cartesian3.fromDegrees(ac.lon, ac.lat, altM) as any;
        if (existing.billboard) {
          existing.billboard.rotation = CesiumMath.toRadians(-heading) as any;
          existing.billboard.image = createAircraftSvg(color) as any;
        }
      } else {
        viewer.entities.add({
          id: entityId,
          name: callsign,
          position: Cartesian3.fromDegrees(ac.lon, ac.lat, altM),
          billboard: {
            image: createAircraftSvg(color),
            width: 24,
            height: 24,
            rotation: CesiumMath.toRadians(-heading),
            alignedAxis: Cartesian3.UNIT_Z,
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: callsign,
            font: "10px monospace",
            fillColor: Color.fromCssColorString(color),
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.BOTTOM,
            pixelOffset: new Cartesian2(0, -16),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            showBackground: true,
            backgroundColor: Color.fromCssColorString("#0a0a0f").withAlpha(0.7),
            backgroundPadding: new Cartesian2(4, 2),
          },
          description: `<p><b>${callsign}</b></p><p>ICAO: ${icao24}</p><p>Alt: ${altM.toFixed(0)}m MSL</p><p>Speed: ${ac.velocity?.toFixed(0) ?? "?"} m/s</p><p>Heading: ${heading.toFixed(0)}&deg;</p><p>VRate: ${ac.verticalRate?.toFixed(1) ?? "?"} m/s</p><p>Country: ${ac.originCountry}</p>`,
        });
      }
    }

    // Remove stale entities
    for (const id of entityIdsRef.current) {
      if (!currentIds.has(id)) {
        viewer.entities.removeById(id);
      }
    }

    entityIdsRef.current = currentIds;
    viewer.scene.requestRender();
  }, [viewer, aircraft, threatLevels, altitudeFilter, layerVisible]);

  // Click handling consolidated in AirTrafficViewer to avoid duplicate ScreenSpaceEventHandlers

  return null;
}
