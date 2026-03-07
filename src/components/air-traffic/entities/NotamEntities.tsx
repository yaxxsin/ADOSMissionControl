/**
 * @module NotamEntities
 * @description Renders NOTAM-affected areas as warning-styled circles or polygons
 * on the CesiumJS globe.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import type { Viewer as CesiumViewer } from "cesium";
import { useAirspaceStore } from "@/stores/airspace-store";

interface NotamEntitiesProps {
  viewer: CesiumViewer | null;
}

export function NotamEntities({ viewer }: NotamEntitiesProps) {
  const notams = useAirspaceStore((s) => s.notams);
  const layerVisibility = useAirspaceStore((s) => s.layerVisibility);
  const timelineTime = useAirspaceStore((s) => s.timelineTime);
  const entityIdsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    // Remove old entities
    for (const id of entityIdsRef.current) {
      viewer.entities.removeById(id);
    }
    entityIdsRef.current = [];

    if (!layerVisibility.restrictions) {
      viewer.scene.requestRender();
      return;
    }

    const Cesium = require("cesium");
    const newIds: string[] = [];

    // Filter NOTAMs by timeline time (only show active at selected time)
    const timeMs = timelineTime.getTime();
    const activeNotams = notams.filter((n) => {
      if (!n.effectiveFrom || !n.effectiveTo) return true; // show if no time range
      const from = new Date(n.effectiveFrom).getTime();
      const to = new Date(n.effectiveTo).getTime();
      return timeMs >= from && timeMs <= to;
    });

    for (const notam of activeNotams) {
      if (notam.lat == null || notam.lon == null) continue;

      const entityId = `notam-${notam.id}`;
      const radiusM = (notam.radius ?? 5) * 1000; // default 5km if not specified

      viewer.entities.add({
        id: entityId,
        name: notam.title,
        position: Cesium.Cartesian3.fromDegrees(notam.lon, notam.lat),
        ellipse: {
          semiMajorAxis: radiusM,
          semiMinorAxis: radiusM,
          height: notam.floorAltitude ?? 0,
          extrudedHeight: notam.ceilingAltitude ?? 1000,
          material: Cesium.Color.fromCssColorString("#FF8C00").withAlpha(0.15),
          outline: true,
          outlineColor: Cesium.Color.fromCssColorString("#FF8C00").withAlpha(0.6),
          outlineWidth: 1,
        },
        label: {
          text: `NOTAM: ${notam.title}`,
          font: "9px monospace",
          fillColor: Cesium.Color.fromCssColorString("#FF8C00"),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: Cesium.Color.fromCssColorString("#0a0a0f").withAlpha(0.7),
          backgroundPadding: new Cesium.Cartesian2(4, 2),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 200000),
        },
        description: `<p><b>${notam.title}</b></p><p>${notam.text}</p><p>Issuer: ${notam.issuer}</p><p>From: ${notam.effectiveFrom}</p><p>To: ${notam.effectiveTo}</p>`,
      });

      newIds.push(entityId);
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
  }, [viewer, notams, layerVisibility.restrictions, timelineTime]);

  return null;
}
