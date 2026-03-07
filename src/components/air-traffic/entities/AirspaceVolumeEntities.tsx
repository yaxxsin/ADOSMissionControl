/**
 * @module AirspaceVolumeEntities
 * @description Renders airspace zones as semi-transparent extruded 3D volumes on the CesiumJS globe.
 * Color and opacity follow aviation standard color scheme from ZONE_COLORS.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import { Cartesian3, Color, DistanceDisplayCondition, PolygonHierarchy, type Viewer as CesiumViewer } from "cesium";
import { useAirspaceStore } from "@/stores/airspace-store";
import { ZONE_COLORS, type GeoJSONPolygon, type GeoJSONMultiPolygon } from "@/lib/airspace/types";

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
  const showIcaoZones = useAirspaceStore((s) => s.showIcaoZones);
  const activeJurisdictions = useAirspaceStore((s) => s.activeJurisdictions);
  const entityIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;
    if (!layerVisibility.airspace) {
      for (const id of entityIdsRef.current) {
        viewer.entities.removeById(id);
      }
      entityIdsRef.current = [];
      viewer.scene.requestRender();
      return;
    }

    const newIds: string[] = [];

    // Previous entities are removed by the useEffect cleanup return (no manual removal needed)

    for (const zone of zones) {
      // Filter by operational altitude: skip zones entirely above the slider
      if (zone.floorAltitude > operationalAltitude) continue;
      // Filter ICAO-generated zones by the showIcaoZones toggle
      if (zone.metadata?.generated === "icao-standard" && !showIcaoZones) continue;
      // Filter by active jurisdictions — toggling off a jurisdiction hides its volumes
      if (zone.jurisdiction && !activeJurisdictions.has(zone.jurisdiction)) continue;
      const colors = ZONE_COLORS[zone.type];
      if (!colors) continue;

      const fillColor = Color.fromCssColorString(colors.fill).withAlpha(colors.fillOpacity);
      const borderColor = Color.fromCssColorString(colors.border).withAlpha(colors.borderOpacity);

      // Compute LOD visibility range based on zone size
      const lodDistance = getZoneLodDistance(zone.type, zone.ceilingAltitude);
      const description = `<p><b>${zone.name}</b></p><p>Type: ${zone.type}</p><p>Floor: ${zone.floorAltitude}m / Ceiling: ${zone.ceilingAltitude}m</p><p>Authority: ${zone.authority}</p>`;

      if (zone.circle) {
        // Render as geodetically correct 3D cylinder
        const entityId = `airspace-volume-${zone.id}-0`;
        const extrudedHeight = Math.max(zone.ceilingAltitude, 1); // avoid zero-height degenerate volume

        viewer.entities.add({
          id: entityId,
          name: zone.name,
          position: Cartesian3.fromDegrees(zone.circle.lon, zone.circle.lat),
          ellipse: {
            semiMajorAxis: zone.circle.radiusM,
            semiMinorAxis: zone.circle.radiusM,
            height: zone.floorAltitude,
            extrudedHeight,
            material: fillColor,
            outline: true,
            outlineColor: borderColor,
            outlineWidth: 1,
            distanceDisplayCondition: new DistanceDisplayCondition(0, lodDistance),
          },
          description,
        });

        newIds.push(entityId);
      } else {
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
              distanceDisplayCondition: new DistanceDisplayCondition(0, lodDistance),
            },
            description,
          });

          newIds.push(entityId);
        }
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
  }, [viewer, zones, layerVisibility.airspace, operationalAltitude, showIcaoZones, activeJurisdictions]);

  return null;
}

/** Returns max camera distance (meters) at which this zone type should be visible. */
function getZoneLodDistance(type: string, _ceilingAlt: number): number {
  switch (type) {
    // Small zones (~5km radius): visible below 100km
    case "dgcaRed":
    case "casaRestricted":
      return 100_000;
    // Medium zones (~9-25km radius): visible below 250km
    case "dgcaYellow":
    case "classD":
    case "casaCaution":
    case "moa":
      return 250_000;
    // Large zones (~45-55km radius): visible below 500km
    case "dgcaGreen":
    case "classB":
    case "classC":
    case "classE":
      return 500_000;
    // Restrictions and TFRs: visible below 300km
    case "restricted":
    case "prohibited":
    case "tfr":
    case "ctr":
    case "tma":
      return 300_000;
    // Danger/Alert/Warning: visible below 250km
    case "danger":
    case "alert":
    case "warning":
      return 250_000;
    default:
      return 300_000;
  }
}

function extractPolygons(geometry: GeoJSONPolygon | GeoJSONMultiPolygon): number[][][] {
  if (geometry.type === "Polygon") {
    return [geometry.coordinates[0]];
  }
  return geometry.coordinates.map((poly) => poly[0]);
}
