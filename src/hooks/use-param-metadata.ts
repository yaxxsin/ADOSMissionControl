"use client";

import { useState, useEffect } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { getParamMetadata, firmwareTypeToVehicle, type ParamMetadata } from "@/lib/protocol/param-metadata";

const EMPTY_MAP = new Map<string, ParamMetadata>();

/**
 * Hook to fetch and cache parameter metadata for the connected drone's firmware.
 * Returns an empty Map when no drone is connected or metadata is unavailable.
 */
export function useParamMetadataMap(): Map<string, ParamMetadata> {
  const [metadata, setMetadata] = useState<Map<string, ParamMetadata>>(EMPTY_MAP);
  const drone = useDroneManager((s) => s.getSelectedDrone)();

  useEffect(() => {
    if (!drone?.vehicleInfo) return;
    const vehicle = firmwareTypeToVehicle(drone.vehicleInfo.firmwareType);
    if (!vehicle) return;
    let cancelled = false;
    getParamMetadata(vehicle).then((map) => {
      if (!cancelled) setMetadata(map);
    });
    return () => { cancelled = true; };
  }, [drone?.vehicleInfo?.firmwareType]);

  return metadata;
}
