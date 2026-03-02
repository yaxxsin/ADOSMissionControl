/**
 * @module MissionActions
 * @description Action bar at the bottom of the planner right panel.
 * Upload to drone (primary) and overflow menu with export, save-as,
 * reverse waypoints, and discard changes.
 * @license GPL-3.0-only
 */
"use client";

import { useRouter } from "next/navigation";
import { Upload, Save, MoreHorizontal, Download, FileDown, FileOutput, FileSpreadsheet, Globe, Copy, ArrowDownUp, Trash2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";

interface MissionActionsProps {
  hasWaypoints: boolean;
  hasDrone: boolean;
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  isDirty: boolean;
  onSave: () => void;
  onUpload: () => void;
  onDownloadFromDrone: () => void;
  onExportWaypoints: () => void;
  onExportPlan: () => void;
  onExportKML: () => void;
  onExportCSV: () => void;
  onSaveAs: () => void;
  onReverseWaypoints: () => void;
  onDiscard: () => void;
}

export function MissionActions({
  hasWaypoints,
  hasDrone,
  uploadState,
  isDirty,
  onSave,
  onUpload,
  onDownloadFromDrone,
  onExportWaypoints,
  onExportPlan,
  onExportKML,
  onExportCSV,
  onSaveAs,
  onReverseWaypoints,
  onDiscard,
}: MissionActionsProps) {
  const router = useRouter();

  const overflowItems = [
    { id: "download-drone", label: "Download from Drone", icon: <Download size={12} /> },
    { id: "div1", label: "", divider: true },
    { id: "export-waypoints", label: "Export .waypoints", icon: <FileDown size={12} /> },
    { id: "export-plan", label: "Export .plan (QGC)", icon: <FileOutput size={12} /> },
    { id: "export-kml", label: "Export .kml", icon: <Globe size={12} /> },
    { id: "export-csv", label: "Export .csv", icon: <FileSpreadsheet size={12} /> },
    { id: "save-as", label: "Save As New Plan", icon: <Copy size={12} /> },
    { id: "div2", label: "", divider: true },
    { id: "reverse", label: "Reverse Waypoints", icon: <ArrowDownUp size={12} /> },
    { id: "div3", label: "", divider: true },
    { id: "discard", label: "Discard Changes", icon: <Trash2 size={12} />, danger: true },
  ];

  const handleOverflow = (id: string) => {
    if (id === "download-drone") onDownloadFromDrone();
    else if (id === "export-waypoints") onExportWaypoints();
    else if (id === "export-plan") onExportPlan();
    else if (id === "export-kml") onExportKML();
    else if (id === "export-csv") onExportCSV();
    else if (id === "save-as") onSaveAs();
    else if (id === "reverse") onReverseWaypoints();
    else if (id === "discard") onDiscard();
  };

  return (
    <div className="border-t border-border-default p-3 flex flex-col gap-2">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="lg"
          icon={<Save size={14} />}
          disabled={!isDirty}
          onClick={onSave}
        >
          Save
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          icon={<Upload size={14} />}
          disabled={!hasWaypoints || !hasDrone}
          loading={uploadState === "uploading"}
          onClick={onUpload}
        >
          Upload to Drone
        </Button>
        <DropdownMenu
          trigger={
            <Button variant="ghost" size="md" icon={<MoreHorizontal size={14} />} />
          }
          items={overflowItems}
          onSelect={handleOverflow}
          align="right"
        />
      </div>
      <Button
        variant="ghost"
        size="md"
        className="w-full"
        icon={<Play size={14} />}
        disabled={!hasWaypoints}
        onClick={() => router.push("/simulate")}
      >
        Simulate in 3D
      </Button>
    </div>
  );
}
