"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import L from "leaflet";

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayerSwitcher = dynamic(
  () => import("@/components/map/TileLayerSwitcher").then((m) => ({ default: m.TileLayerSwitcher })),
  { ssr: false }
);
const Polyline = dynamic(
  () => import("react-leaflet").then((m) => m.Polyline),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((m) => m.Marker),
  { ssr: false }
);
const GcsMarker = dynamic(
  () => import("@/components/map/GcsMarker").then((m) => ({ default: m.GcsMarker })),
  { ssr: false }
);


/** Generate a mock path for route replay. */
function generateMockPath(): [number, number][] {
  const baseLat = 0.0;
  const baseLon = 0.0;
  const points: [number, number][] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const radius = 0.01 + Math.random() * 0.005;
    points.push([
      baseLat + Math.sin(angle) * radius,
      baseLon + Math.cos(angle) * radius * 1.2,
    ]);
  }
  return points;
}

const droneIcon = L.divIcon({
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  html: `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" fill="#3a82ff" stroke="#fafafa" stroke-width="1.5"/>
    <circle cx="8" cy="8" r="3" fill="#fafafa"/>
  </svg>`,
});

interface RouteReplayMapProps {
  path?: [number, number][];
}

export function RouteReplayMap({ path: providedPath }: RouteReplayMapProps) {
  const [path] = useState<[number, number][]>(() => providedPath ?? generateMockPath());
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentIndex = Math.min(
    Math.floor((progress / 100) * (path.length - 1)),
    path.length - 1
  );
  const currentPos = path[currentIndex] ?? path[0];

  const traveledPath = path.slice(0, currentIndex + 1);

  useEffect(() => {
    if (playing) {
      animRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setPlaying(false);
            return 100;
          }
          return p + 0.5;
        });
      }, 50);
    } else if (animRef.current) {
      clearInterval(animRef.current);
      animRef.current = null;
    }
    return () => {
      if (animRef.current) clearInterval(animRef.current);
    };
  }, [playing]);

  const handleReset = useCallback(() => {
    setPlaying(false);
    setProgress(0);
  }, []);

  const center: [number, number] = path.length > 0 ? path[0] : [0, 0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 relative">
        <MapContainer
          center={center}
          zoom={15}
          className="w-full h-full"
          zoomControl={false}
          attributionControl={false}
          style={{ background: "#0a0a0a" }}
        >
          <TileLayerSwitcher />

          {/* Full path (dim) */}
          <Polyline
            positions={path}
            pathOptions={{ color: "#1a1a1a", weight: 2 }}
          />

          {/* Traveled path */}
          {traveledPath.length >= 2 && (
            <Polyline
              positions={traveledPath}
              pathOptions={{ color: "#3a82ff", weight: 2 }}
            />
          )}

          {/* Current position marker */}
          <Marker position={currentPos} icon={droneIcon} />

          <GcsMarker />
        </MapContainer>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-border-default">
        <Button
          variant="ghost"
          size="sm"
          icon={playing ? <Pause size={12} /> : <Play size={12} />}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? "Pause" : "Play"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw size={12} />}
          onClick={handleReset}
        >
          Reset
        </Button>

        {/* Progress slider */}
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={progress}
          onChange={(e) => setProgress(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-accent-primary cursor-pointer"
        />
        <span className="text-[10px] font-mono text-text-tertiary w-8 text-right">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}
