/**
 * @module ZoneBoundaryEntities
 * @description Renders jurisdiction-specific zone boundaries: India green/yellow/red zones,
 * USA LAANC grid cells, Australia CASA buffer rings. Filtered by current jurisdiction.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, useMemo } from "react";
import { Cartesian3, Cartesian2, Color, PolygonHierarchy, ClassificationType, LabelStyle, VerticalOrigin, HorizontalOrigin, DistanceDisplayCondition, type Viewer as CesiumViewer } from "cesium";
import { useAirspaceStore } from "@/stores/airspace-store";
import { useSettingsStore } from "@/stores/settings-store";
import { ZONE_COLORS, type AirspaceZone, type AirspaceZoneType } from "@/lib/airspace/types";

interface ZoneBoundaryEntitiesProps {
  viewer: CesiumViewer | null;
}

const JURISDICTION_ZONE_TYPES: Record<string, AirspaceZoneType[]> = {
  dgca: ["dgcaGreen", "dgcaYellow", "dgcaRed"],
  faa: ["classB", "classC", "classD", "classE"],
  casa: ["casaRestricted", "casaCaution"],
};

export function ZoneBoundaryEntities({ viewer }: ZoneBoundaryEntitiesProps) {
  const zones = useAirspaceStore((s) => s.zones);
  const layerVisibility = useAirspaceStore((s) => s.layerVisibility);
  const jurisdiction = useSettingsStore((s) => s.jurisdiction);
  const entityIdsRef = useRef<string[]>([]);

  // Filter zones to jurisdiction-specific boundary types
  const boundaryZones = useMemo(() => {
    if (!jurisdiction) return [];
    const types = JURISDICTION_ZONE_TYPES[jurisdiction] ?? [];
    return zones.filter((z) => types.includes(z.type));
  }, [zones, jurisdiction]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old
    for (const id of entityIdsRef.current) {
      viewer.entities.removeById(id);
    }
    entityIdsRef.current = [];

    if (!layerVisibility.airspace || boundaryZones.length === 0) {
      viewer.scene.requestRender();
      return;
    }


    const newIds: string[] = [];

    for (const zone of boundaryZones) {
      const colors = ZONE_COLORS[zone.type];
      if (!colors) continue;

      const borderColor = Color.fromCssColorString(colors.border).withAlpha(colors.borderOpacity);
      const fillColor = Color.fromCssColorString(colors.fill).withAlpha(Math.min(colors.fillOpacity * 0.5, 0.15));

      // Render as ground polygon (2D boundary overlay)
      const coords = zone.geometry.type === "Polygon"
        ? zone.geometry.coordinates[0]
        : zone.geometry.coordinates[0][0];

      if (!coords || coords.length < 3) continue;

      const entityId = `zone-boundary-${zone.id}`;
      const positions = coords.map(([lon, lat]: number[]) =>
        Cartesian3.fromDegrees(lon, lat)
      );

      viewer.entities.add({
        id: entityId,
        name: zone.name,
        polygon: {
          hierarchy: new PolygonHierarchy(positions),
          material: fillColor,
          outline: true,
          outlineColor: borderColor,
          outlineWidth: 2,
          height: 0,
          classificationType: ClassificationType.BOTH,
        },
        description: buildDescription(zone),
      });

      newIds.push(entityId);

      // Add center label for DGCA zones
      if (zone.type.startsWith("dgca")) {
        const labelId = `zone-label-${zone.id}`;
        const centroid = computeCentroid(coords);

        const labelText = zone.type === "dgcaGreen" ? "GREEN ZONE"
          : zone.type === "dgcaYellow" ? "YELLOW ZONE"
          : "RED ZONE";

        viewer.entities.add({
          id: labelId,
          position: Cartesian3.fromDegrees(centroid[0], centroid[1]),
          label: {
            text: labelText,
            font: "bold 11px monospace",
            fillColor: borderColor,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
            style: LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: VerticalOrigin.CENTER,
            horizontalOrigin: HorizontalOrigin.CENTER,
            disableDepthTestDistance: 5000,
            distanceDisplayCondition: new DistanceDisplayCondition(0, 150000),
            showBackground: true,
            backgroundColor: Color.fromCssColorString("#0a0a0f").withAlpha(0.6),
            backgroundPadding: new Cartesian2(6, 3),
          },
        });

        newIds.push(labelId);
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
  }, [viewer, boundaryZones, layerVisibility.airspace]);

  return null;
}

function buildDescription(zone: AirspaceZone): string {
  const meta = Object.entries(zone.metadata)
    .map(([k, v]) => `<p>${k}: ${v}</p>`)
    .join("");
  return `<p><b>${zone.name}</b></p><p>Type: ${zone.type}</p><p>Floor: ${zone.floorAltitude}m / Ceiling: ${zone.ceilingAltitude}m</p><p>Authority: ${zone.authority}</p>${meta}`;
}

function computeCentroid(coords: number[][]): [number, number] {
  let lonSum = 0;
  let latSum = 0;
  const n = coords.length;
  for (const [lon, lat] of coords) {
    lonSum += lon;
    latSum += lat;
  }
  return [lonSum / n, latSum / n];
}
