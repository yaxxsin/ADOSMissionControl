/**
 * @module CesiumScene
 * @description CesiumJS Viewer wrapper with terrain, imagery, and dark theme configuration.
 * Sets CESIUM_BASE_URL before import, creates viewer with dark CARTO tiles.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";

// Set CESIUM_BASE_URL before cesium is imported
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).CESIUM_BASE_URL =
    process.env.CESIUM_BASE_URL ||
    "https://cesium.com/downloads/cesiumjs/releases/1.138/Build/Cesium/";
}

import {
  Viewer,
  Ion,
  Terrain,
  ArcGISTiledElevationTerrainProvider,
  SceneMode,
  ImageryLayer,
  UrlTemplateImageryProvider,
  Color,
  type Viewer as CesiumViewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

interface CesiumSceneProps {
  onReady?: (viewer: CesiumViewer) => void;
  onError?: (error: Error) => void;
  /** Cesium Ion access token. When set, enables Cesium World Terrain. Otherwise falls back to ArcGIS elevation. */
  cesiumToken?: string;
}

export default function CesiumScene({ onReady, onError, cesiumToken }: CesiumSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let viewer: InstanceType<typeof Viewer> | null = null;

    try {
      const token = cesiumToken;
      if (token) {
        Ion.defaultAccessToken = token;
      }

      viewer = new Viewer(containerRef.current, {
        sceneMode: SceneMode.SCENE3D,
        animation: false,
        timeline: false,
        baseLayerPicker: false,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        sceneModePicker: false,
        selectionIndicator: false,
        vrButton: false,
        orderIndependentTranslucency: false,
      });

      // Dark sky
      viewer.scene.backgroundColor = Color.fromCssColorString("#0a0a0f");
      viewer.scene.globe.baseColor = Color.fromCssColorString("#0a0a0f");
      viewer.scene.globe.showGroundAtmosphere = false;
      if (viewer.scene.skyAtmosphere) viewer.scene.skyAtmosphere.show = false;
      if (viewer.scene.sun) viewer.scene.sun.show = false;
      if (viewer.scene.moon) viewer.scene.moon.show = false;
      if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
      viewer.scene.fog.enabled = false;

      // Dark CARTO tiles
      viewer.imageryLayers.removeAll();
      const darkTiles = new ImageryLayer(
        new UrlTemplateImageryProvider({
          url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
          credit: "CARTO",
          minimumLevel: 0,
          maximumLevel: 18,
        })
      );
      viewer.imageryLayers.add(darkTiles);

      // Terrain: Cesium World Terrain (with Ion token) or free ArcGIS elevation
      if (token) {
        viewer.scene.setTerrain(
          Terrain.fromWorldTerrain({
            requestVertexNormals: true,
            requestWaterMask: true,
          })
        );
      } else {
        viewer.scene.setTerrain(
          new Terrain(
            ArcGISTiledElevationTerrainProvider.fromUrl(
              "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer"
            )
          )
        );
      }

      // Terrain rendering settings
      viewer.scene.globe.depthTestAgainstTerrain = false;
      viewer.scene.globe.enableLighting = false;

      // Prevent camera from clipping through terrain at deep zoom
      viewer.scene.screenSpaceCameraController.minimumZoomDistance = 15;

      // Hide Cesium credits
      const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
      if (creditContainer) creditContainer.style.display = "none";

      onReady?.(viewer);
    } catch (err) {
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }

    return () => {
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
    // Re-create viewer when token changes (e.g. loaded from Convex after mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cesiumToken]);

  return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
}
