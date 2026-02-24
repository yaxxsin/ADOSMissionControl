/**
 * ArduPilot parameter metadata service.
 *
 * Fetches, parses, and caches parameter metadata (descriptions, ranges,
 * defaults, enums) from the ArduPilot autotest server. Uses IndexedDB
 * for persistent caching with a 7-day TTL, and in-memory Map for hot cache.
 *
 * Gracefully degrades — all errors return empty Map, never throws.
 *
 * @module protocol/param-metadata
 * @license GPL-3.0-only
 */

import { get, set } from "idb-keyval";
import type { FirmwareType } from "./types";

// ── Types ─────────────────────────────────────────────────────

export interface ParamMetadata {
  name: string;
  humanName: string;
  description: string;
  range?: { min: number; max: number };
  units?: string;
  values?: Map<number, string>;
  bitmask?: Map<number, string>;
  increment?: number;
  defaultValue?: number;
  rebootRequired?: boolean;
}

export type ArduPilotVehicle = "ArduCopter" | "ArduPlane" | "Rover" | "ArduSub";

// ── Constants ─────────────────────────────────────────────────

const BASE_URL = "https://autotest.ardupilot.org/Parameters";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IDB_PREFIX = "altcmd:param-meta:";

// ── In-memory hot cache ───────────────────────────────────────

const memoryCache = new Map<ArduPilotVehicle, Map<string, ParamMetadata>>();

// ── Public API ────────────────────────────────────────────────

/** Map FirmwareType to ArduPilot vehicle name. Returns null for non-ArduPilot. */
export function firmwareTypeToVehicle(ft: FirmwareType): ArduPilotVehicle | null {
  switch (ft) {
    case "ardupilot-copter": return "ArduCopter";
    case "ardupilot-plane":  return "ArduPlane";
    case "ardupilot-rover":  return "Rover";
    case "ardupilot-sub":    return "ArduSub";
    default: return null;
  }
}

/**
 * Get parameter metadata for a vehicle type.
 * Returns from: memory cache > IndexedDB cache (7-day TTL) > network fetch.
 * Never throws — returns empty Map on any failure.
 */
export async function getParamMetadata(
  vehicle: ArduPilotVehicle,
): Promise<Map<string, ParamMetadata>> {
  // 1. Memory cache
  const mem = memoryCache.get(vehicle);
  if (mem) return mem;

  // 2. IndexedDB cache
  try {
    const cached = await get<{ timestamp: number; data: SerializedMeta[] }>(
      IDB_PREFIX + vehicle,
    );
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const map = deserializeMetaMap(cached.data);
      memoryCache.set(vehicle, map);
      return map;
    }
  } catch (e) {
    console.warn("[param-metadata] IndexedDB read failed:", e);
  }

  // 3. Network fetch
  return fetchAndCache(vehicle);
}

/** Force-fetch metadata, bypassing all caches. */
export async function refreshParamMetadata(
  vehicle: ArduPilotVehicle,
): Promise<Map<string, ParamMetadata>> {
  memoryCache.delete(vehicle);
  return fetchAndCache(vehicle);
}

// ── Internal ──────────────────────────────────────────────────

type SerializedMeta = Omit<ParamMetadata, "values" | "bitmask"> & {
  values?: [number, string][];
  bitmask?: [number, string][];
};

function serializeMeta(meta: ParamMetadata): SerializedMeta {
  return {
    ...meta,
    values: meta.values ? Array.from(meta.values.entries()) : undefined,
    bitmask: meta.bitmask ? Array.from(meta.bitmask.entries()) : undefined,
  };
}

function deserializeMeta(s: SerializedMeta): ParamMetadata {
  return {
    ...s,
    values: s.values ? new Map(s.values) : undefined,
    bitmask: s.bitmask ? new Map(s.bitmask) : undefined,
  };
}

function deserializeMetaMap(arr: SerializedMeta[]): Map<string, ParamMetadata> {
  const map = new Map<string, ParamMetadata>();
  for (const s of arr) {
    map.set(s.name, deserializeMeta(s));
  }
  return map;
}

async function fetchAndCache(
  vehicle: ArduPilotVehicle,
): Promise<Map<string, ParamMetadata>> {
  try {
    const url = `${BASE_URL}/${vehicle}/apm.pdef.xml`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[param-metadata] Fetch failed: ${res.status} ${res.statusText}`);
      return new Map();
    }
    const text = await res.text();
    const map = parseParamXml(text);
    memoryCache.set(vehicle, map);

    // Persist to IndexedDB
    try {
      const serialized = Array.from(map.values()).map(serializeMeta);
      await set(IDB_PREFIX + vehicle, { timestamp: Date.now(), data: serialized });
    } catch (e) {
      console.warn("[param-metadata] IndexedDB write failed:", e);
    }

    return map;
  } catch (e) {
    console.warn("[param-metadata] Network fetch failed:", e);
    return new Map();
  }
}

// ── XML Parser ────────────────────────────────────────────────

function parseParamXml(xml: string): Map<string, ParamMetadata> {
  const map = new Map<string, ParamMetadata>();
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "text/xml");

  // Parse both <vehicles> and <libraries> sections
  const paramFiles = doc.querySelectorAll("paramfile");
  for (const pf of paramFiles) {
    parseParamFile(pf, map);
  }

  // Also parse top-level params (some XMLs have flat structure)
  const topParams = doc.querySelectorAll("param");
  for (const p of topParams) {
    if (p.parentElement?.tagName === "paramfile" || p.parentElement?.tagName === "vehicles") {
      continue; // Already handled
    }
    parseParamElement(p, "", map);
  }

  return map;
}

function parseParamFile(
  pf: Element,
  map: Map<string, ParamMetadata>,
): void {
  const params = pf.querySelectorAll("param");
  for (const p of params) {
    parseParamElement(p, "", map);
  }
}

function parseParamElement(
  el: Element,
  _prefix: string,
  map: Map<string, ParamMetadata>,
): void {
  let name = el.getAttribute("name") ?? "";
  const humanName = el.getAttribute("humanName") ?? "";
  const documentation = el.getAttribute("documentation") ?? "";

  // Strip "Vehicle:" prefix if present (e.g. "ArduPlane:PILOT_THR_FILT")
  const colonIdx = name.indexOf(":");
  if (colonIdx !== -1) {
    name = name.slice(colonIdx + 1);
  }

  if (!name) return;

  const meta: ParamMetadata = {
    name,
    humanName,
    description: documentation,
  };

  // Parse child elements for field data
  for (const child of el.children) {
    const tag = child.tagName.toLowerCase();
    const text = child.textContent?.trim() ?? "";

    switch (tag) {
      case "field": {
        const fieldName = child.getAttribute("name")?.toLowerCase() ?? "";
        switch (fieldName) {
          case "range": {
            const parts = text.split(/\s+/);
            if (parts.length >= 2) {
              const min = parseFloat(parts[0]);
              const max = parseFloat(parts[1]);
              if (!isNaN(min) && !isNaN(max)) {
                meta.range = { min, max };
              }
            }
            break;
          }
          case "units":
            meta.units = text;
            break;
          case "increment": {
            const inc = parseFloat(text);
            if (!isNaN(inc)) meta.increment = inc;
            break;
          }
          case "rebootrequired":
            meta.rebootRequired = text.toLowerCase() === "true";
            break;
          case "default": {
            const def = parseFloat(text);
            if (!isNaN(def)) meta.defaultValue = def;
            break;
          }
        }
        break;
      }
      case "values": {
        const values = new Map<number, string>();
        for (const v of child.children) {
          const code = v.getAttribute("code");
          const valText = v.textContent?.trim() ?? "";
          if (code !== null) {
            const num = parseInt(code, 10);
            if (!isNaN(num)) values.set(num, valText);
          }
        }
        if (values.size > 0) meta.values = values;
        break;
      }
      case "bitmask": {
        const bitmask = new Map<number, string>();
        for (const b of child.children) {
          const bit = b.getAttribute("bit");
          const bitText = b.textContent?.trim() ?? "";
          if (bit !== null) {
            const num = parseInt(bit, 10);
            if (!isNaN(num)) bitmask.set(num, bitText);
          }
        }
        if (bitmask.size > 0) meta.bitmask = bitmask;
        break;
      }
    }
  }

  // Also parse field data from attributes (some formats use this)
  const rangeAttr = el.getAttribute("Range");
  if (rangeAttr && !meta.range) {
    const parts = rangeAttr.split(/\s+/);
    if (parts.length >= 2) {
      const min = parseFloat(parts[0]);
      const max = parseFloat(parts[1]);
      if (!isNaN(min) && !isNaN(max)) meta.range = { min, max };
    }
  }

  const unitsAttr = el.getAttribute("Units");
  if (unitsAttr && !meta.units) meta.units = unitsAttr;

  const incrAttr = el.getAttribute("Increment");
  if (incrAttr && meta.increment === undefined) {
    const inc = parseFloat(incrAttr);
    if (!isNaN(inc)) meta.increment = inc;
  }

  // Parse values from "Values" attribute (comma-separated "code:label" pairs)
  const valuesAttr = el.getAttribute("Values");
  if (valuesAttr && !meta.values) {
    const values = new Map<number, string>();
    for (const pair of valuesAttr.split(",")) {
      const [code, ...labelParts] = pair.trim().split(":");
      const num = parseInt(code, 10);
      if (!isNaN(num)) values.set(num, labelParts.join(":").trim());
    }
    if (values.size > 0) meta.values = values;
  }

  // Parse bitmask from "Bitmask" attribute
  const bitmaskAttr = el.getAttribute("Bitmask");
  if (bitmaskAttr && !meta.bitmask) {
    const bitmask = new Map<number, string>();
    for (const pair of bitmaskAttr.split(",")) {
      const [bit, ...labelParts] = pair.trim().split(":");
      const num = parseInt(bit, 10);
      if (!isNaN(num)) bitmask.set(num, labelParts.join(":").trim());
    }
    if (bitmask.size > 0) meta.bitmask = bitmask;
  }

  // Derive default value from range min if no explicit default
  if (meta.values && meta.defaultValue === undefined) {
    // First enum value is often the default — but we can't be sure
    // Leave undefined to show "—" rather than guess wrong
  }

  const rebootAttr = el.getAttribute("RebootRequired");
  if (rebootAttr) meta.rebootRequired = rebootAttr.toLowerCase() === "true";

  map.set(name, meta);
}
