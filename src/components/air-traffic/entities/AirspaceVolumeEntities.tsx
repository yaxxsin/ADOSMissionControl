/**
 * @module AirspaceVolumeEntities
 * @description Renders airspace zones as semi-transparent extruded 3D volumes on the CesiumJS globe.
 * Color and opacity follow aviation standard color scheme from ZONE_COLORS.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import { Cartesian3, Color, PolygonHierarchy, type Viewer as CesiumViewer } from "cesium";
import { useAirspaceStore } from "@/stores/airspace-store";
import { ZONE_COLORS, type AirspaceZone, type GeoJSONPolygon, type GeoJSONMultiPolygon } from "@/lib/airspace/types";

interface AirspaceVolumeEntitiesProps {
  viewer: CesiumViewer | null;
}

function polygonToCartesian(coords: number[][]): Cartesian3[] {
  return coords.map(([lon, lat]) => Cartesian3.fromDegrees(lon, lat));
}

export function AirspaceVolumeEntities({ viewer }: AirspaceVolumeEntitiesProps) {
  const zones = useAirspaceStore((s) => s.zones);
  const layerVisibility = useAirspaceStore((s) => s.layerVisibility);
  const operationalAltitude = useAirspaceStore((s) => s.operationalAltitude);
  const entityIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!layerVisibility.airspace) {
      // Cleanup is handled by the useEffect return; just clear the ref
      entityIdsRef.current = [];
      viewer.scene.requestRender();
      return;
    }

    const newIds: string[] = [];

    // Previous entities are removed by the useEffect cleanup return (no manual removal needed)

    for (const zone of zones) {
      // Filter by operational altitude: skip zones entirely above the slider
      if (zone.floorAltitude > operationalAltitude) continue;
      const colors = ZONE_COLORS[zone.type];
      if (!colors) continue;

      const fillColor = Color.fromCssColorString(colors.fill).withAlpha(colors.fillOpacity);
      const borderColor = Color.fromCssColorString(colors.border).withAlpha(colors.borderOpacity);

      const polygons = extractPolygons(zone.geometry);

      for (let i = 0; i < polygons.length; i++) {
        const ring = polygons[i];
        if (ring.length < 3) continue;

        const entityId = `airspace-volume-${zone.id}-${i}`;
        const positions = polygonToCartesian(ring);

        viewer.entities.add({
          id: entityId,
          name: zone.name,
          polygon: {
            hierarchy: new PolygonHierarchy(positions),
            height: zone.floorAltitude,
            extrudedHeight: zone.ceilingAltitude,
            material: fillColor,
            outline: true,
            outlineColor: borderColor,
            outlineWidth: 1,
            closeTop: true,
            closeBottom: true,
          },
          description: `<p><b>${zone.name}</b></p><p>Type: ${zone.type}</p><p>Floor: ${zone.floorAltitude}m / Ceiling: ${zone.ceilingAltitude}m</p><p>Authority: ${zone.authority}</p>`,
        });

        newIds.push(entityId);
      }
    }

    entityIdsRef.current = newIds;
    viewer.scene.requestRender();

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        for (const id of newIds) {
          viewer.entities.removeById(id);
        }
      }
    };
  }, [viewer, zones, layerVisibility.airspace, operationalAltitude]);

  return null;
}

function extractPolygons(geometry: GeoJSONPolygon | GeoJSONMultiPolygon): number[][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0]];
  }
  return geometry.coordinates.map((poly) => poly[0]);
}
