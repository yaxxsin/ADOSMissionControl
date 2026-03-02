/**
 * @module GeofenceEntities
 * @description Renders geofence boundaries in the 3D simulation view.
 * Shows polygon fence as red translucent polygon, circle fence as red ellipse,
 * and max altitude ceiling as a dashed horizontal plane.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian3,
  Color,
  HeightReference,
  PolylineDashMaterialProperty,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import { useGeofenceStore } from "@/stores/geofence-store";

interface GeofenceEntitiesProps {
  viewer: CesiumViewer | null;
}

export function GeofenceEntities({ viewer }: GeofenceEntitiesProps) {
  const enabled = useGeofenceStore((s) => s.enabled);
  const fenceType = useGeofenceStore((s) => s.fenceType);
  const maxAltitude = useGeofenceStore((s) => s.maxAltitude);
  const circleCenter = useGeofenceStore((s) => s.circleCenter);
  const circleRadius = useGeofenceStore((s) => s.circleRadius);
  const polygonPoints = useGeofenceStore((s) => s.polygonPoints);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !enabled) return;

    const entities: Entity[] = [];
    const fenceColor = Color.RED.withAlpha(0.2);
    const fenceOutlineColor = Color.RED.withAlpha(0.7);

    // Polygon geofence
    if (fenceType === "polygon" && polygonPoints.length >= 3) {
      const positions = polygonPoints.map(([lat, lon]) =>
        Cartesian3.fromDegrees(lon, lat)
      );

      // Ground polygon fill
      const polyEntity = viewer.entities.add({
        polygon: {
          hierarchy: positions,
          material: fenceColor,
          heightReference: HeightReference.CLAMP_TO_GROUND,
        },
      });
      entities.push(polyEntity);

      // Outline
      const outlineEntity = viewer.entities.add({
        polyline: {
          positions: [...positions, positions[0]], // close the loop
          width: 2,
          material: new PolylineDashMaterialProperty({
            color: fenceOutlineColor,
            dashLength: 12,
          }),
          clampToGround: true,
        },
      });
      entities.push(outlineEntity);
    }

    // Circle geofence
    if (fenceType === "circle" && circleCenter) {
      const centerPos = Cartesian3.fromDegrees(circleCenter[1], circleCenter[0]);

      const circleEntity = viewer.entities.add({
        position: centerPos,
        ellipse: {
          semiMajorAxis: circleRadius,
          semiMinorAxis: circleRadius,
          material: fenceColor,
          heightReference: HeightReference.CLAMP_TO_GROUND,
          outline: true,
          outlineColor: fenceOutlineColor,
          outlineWidth: 2,
        },
      });
      entities.push(circleEntity);
    }

    // Max altitude ceiling plane
    if (maxAltitude > 0) {
      // Build a large rectangle at the geofence center to represent the altitude ceiling
      let centerLat = 0;
      let centerLon = 0;

      if (fenceType === "polygon" && polygonPoints.length >= 3) {
        centerLat = polygonPoints.reduce((s, p) => s + p[0], 0) / polygonPoints.length;
        centerLon = polygonPoints.reduce((s, p) => s + p[1], 0) / polygonPoints.length;
      } else if (fenceType === "circle" && circleCenter) {
        centerLat = circleCenter[0];
        centerLon = circleCenter[1];
      }

      if (centerLat !== 0 || centerLon !== 0) {
        // Represent ceiling as a translucent ellipse at maxAltitude
        const ceilingEntity = viewer.entities.add({
          position: Cartesian3.fromDegrees(centerLon, centerLat, maxAltitude),
          ellipse: {
            semiMajorAxis: fenceType === "circle" ? circleRadius : 500,
            semiMinorAxis: fenceType === "circle" ? circleRadius : 500,
            material: Color.RED.withAlpha(0.08),
            outline: true,
            outlineColor: Color.RED.withAlpha(0.3),
            outlineWidth: 1,
            height: maxAltitude,
          },
        });
        entities.push(ceilingEntity);
      }
    }

    return () => {
      for (const entity of entities) {
        if (!viewer.isDestroyed()) viewer.entities.remove(entity);
      }
    };
  }, [viewer, enabled, fenceType, maxAltitude, circleCenter, circleRadius, polygonPoints]);

  return null;
}
