/**
 * @module WaypointEntities
 * @description Renders numbered waypoint billboards at their actual altitude in the 3D scene.
 * Clicking a waypoint selects it (syncs with planner store).
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  VerticalOrigin,
  HorizontalOrigin,
  LabelStyle,
  type Viewer as CesiumViewer,
  ScreenSpaceEventType,
  ScreenSpaceEventHandler,
  defined,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { MAP_COLORS } from "@/lib/map-constants";
import { usePlannerStore } from "@/stores/planner-store";

interface WaypointEntitiesProps {
  viewer: CesiumViewer | null;
  waypoints: Waypoint[];
}

const WP_ENTITY_PREFIX = "sim-wp-";

export function WaypointEntities({ viewer, waypoints }: WaypointEntitiesProps) {
  const selectedWaypointId = usePlannerStore((s) => s.selectedWaypointId);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const entities: ReturnType<typeof viewer.entities.add>[] = [];

    for (let i = 0; i < waypoints.length; i++) {
      const wp = waypoints[i];
      const isSelected = wp.id === selectedWaypointId;
      const bgColor = isSelected
        ? Color.fromCssColorString(MAP_COLORS.accentSelected)
        : Color.fromCssColorString(MAP_COLORS.accentPrimary);
      const textColor = isSelected
        ? Color.fromCssColorString(MAP_COLORS.background)
        : Color.WHITE;

      const entity = viewer.entities.add({
        id: `${WP_ENTITY_PREFIX}${wp.id}`,
        position: Cartesian3.fromDegrees(wp.lon, wp.lat, wp.alt),
        point: {
          pixelSize: isSelected ? 14 : 10,
          color: bgColor,
          outlineColor: Color.WHITE,
          outlineWidth: isSelected ? 2 : 1,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: String(i + 1),
          font: "12px Inter, sans-serif",
          fillColor: textColor,
          style: LabelStyle.FILL,
          outlineWidth: 2,
          outlineColor: Color.BLACK,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.CENTER,
          pixelOffset: new Cartesian2(0, -16),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          showBackground: true,
          backgroundColor: bgColor.withAlpha(0.8),
          backgroundPadding: new Cartesian2(4, 2),
        },
      });
      entities.push(entity);
    }

    return () => {
      for (const entity of entities) {
        if (viewer && !viewer.isDestroyed()) {
          viewer.entities.remove(entity);
        }
      }
    };
  }, [viewer, waypoints, selectedWaypointId]);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(
      (event: { position: Cartesian2 }) => {
        const picked = viewer.scene.pick(event.position);
        if (defined(picked) && picked.id && typeof picked.id.id === "string" && picked.id.id.startsWith(WP_ENTITY_PREFIX)) {
          const wpId = picked.id.id.replace(WP_ENTITY_PREFIX, "");
          usePlannerStore.getState().setSelectedWaypoint(wpId);
        }
      },
      ScreenSpaceEventType.LEFT_CLICK
    );

    return () => {
      if (!handler.isDestroyed()) handler.destroy();
    };
  }, [viewer]);

  return null;
}
