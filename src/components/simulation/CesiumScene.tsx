/**
 * @module CesiumScene
 * @description CesiumJS Viewer wrapper with terrain, imagery, and dark theme configuration.
 * Sets CESIUM_BASE_URL before import, creates viewer with dark CARTO tiles.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

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

export interface CesiumSceneHandle {
  viewer: CesiumViewer | null;
}

interface CesiumSceneProps {
  onReady?: (viewer: CesiumViewer) => void;
}

const CesiumScene = forwardRef<CesiumSceneHandle, CesiumSceneProps>(
  function CesiumScene({ onReady }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<CesiumViewer | null>(null);

    useImperativeHandle(ref, () => ({
      get viewer() {
        return viewerRef.current;
      },
    }));

    useEffect(() => {
      if (!containerRef.current) return;

      const token = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
      if (token) {
        Ion.defaultAccessToken = token;
      }

      const viewer = new Viewer(containerRef.current, {
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

      viewerRef.current = viewer;

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

      // Hide Cesium credits
      const creditContainer = viewer.cesiumWidget.creditContainer as HTMLElement;
      if (creditContainer) creditContainer.style.display = "none";

      onReady?.(viewer);

      return () => {
        if (viewer && !viewer.isDestroyed()) viewer.destroy();
        viewerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <div ref={containerRef} className="w-full h-full absolute inset-0" />;
  }
);

export default CesiumScene;
