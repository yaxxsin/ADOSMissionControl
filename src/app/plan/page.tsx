"use client";

/**
 * @module MissionPlannerPage
 * @description Top-level page component for the mission planner view.
 * Pure layout — all logic lives in {@link usePlanner} and {@link useKeyboardShortcuts}.
 * @license GPL-3.0-only
 */

import dynamic from "next/dynamic";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { MissionEditor } from "@/components/planner/MissionEditor";
import { WaypointList } from "@/components/planner/WaypointList";
import { GeofenceEditor } from "@/components/planner/GeofenceEditor";
import { DefaultsSection } from "@/components/planner/DefaultsSection";
import { MapToolbar } from "@/components/planner/MapToolbar";
import { MapContextMenu } from "@/components/planner/MapContextMenu";
import { MissionStatsBar } from "@/components/planner/MissionStatsBar";
import { MissionActions } from "@/components/planner/MissionActions";
import { SaveMissionDialog } from "@/components/planner/SaveMissionDialog";
import { LoadMissionDialog } from "@/components/planner/LoadMissionDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { usePlanner } from "./use-planner";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

const PlannerMap = dynamic(
  () => import("@/components/planner/PlannerMap").then((m) => m.PlannerMap),
  { ssr: false }
);
const AltitudeProfile = dynamic(
  () => import("@/components/planner/AltitudeProfile").then((m) => m.AltitudeProfile),
  { ssr: false }
);

export default function MissionPlannerPage() {
  const p = usePlanner();

  useKeyboardShortcuts({
    activeTool: p.activeTool,
    setActiveTool: p.setActiveTool,
    undo: p.undo,
    redo: p.redo,
    selectedWaypointId: p.selectedWaypointId,
    removeWaypoint: p.removeWaypoint,
    setSelectedWaypoint: p.setSelectedWaypoint,
    expandedWaypointId: p.expandedWaypointId,
    setExpandedWaypoint: p.setExpandedWaypoint,
    handleSave: p.handleSave,
  });

  return (
    <>
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Map area */}
          <div className="flex-1 relative min-w-0">
            <PlannerMap
              waypoints={p.waypoints}
              activeTool={p.activeTool}
              selectedWaypointId={p.selectedWaypointId}
              onMapClick={p.handleMapClick}
              onMapRightClick={p.handleMapRightClick}
              onWaypointClick={p.handleWaypointClick}
              onWaypointDragEnd={p.handleWaypointDragEnd}
              onWaypointRightClick={p.handleWaypointRightClick}
            />

            <MapToolbar
              activeTool={p.activeTool}
              onToolChange={p.setActiveTool}
              canUndo={p.undoStack.length > 0}
              canRedo={p.redoStack.length > 0}
              onUndo={p.undo}
              onRedo={p.redo}
              onClearAll={p.handleClearAll}
            />

            <MissionStatsBar waypoints={p.waypoints} defaultSpeed={p.defaultSpeed} />

            <AltitudeProfile
              waypoints={p.waypoints}
              collapsed={p.altProfileCollapsed}
              onToggle={p.toggleAltProfile}
              selectedWaypointId={p.selectedWaypointId}
              onSelectWaypoint={(id) => {
                p.setSelectedWaypoint(id);
                p.setExpandedWaypoint(id);
              }}
            />
          </div>

          {/* Right panel */}
          {!p.panelCollapsed && (
            <div className="w-[320px] shrink-0 flex flex-col border-l border-border-default bg-bg-secondary">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                <h2 className="text-sm font-display font-semibold text-text-primary">Mission Planner</h2>
                <button
                  onClick={p.togglePanel}
                  className="text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                <CollapsibleSection title="Mission Setup" defaultOpen={true}>
                  <MissionEditor
                    drones={p.drones}
                    missionName={p.missionName}
                    selectedDroneId={p.selectedDroneId}
                    suiteType={p.suiteType}
                    onNameChange={p.setMissionName}
                    onDroneChange={p.setSelectedDroneId}
                    onSuiteChange={p.setSuiteType}
                  />
                </CollapsibleSection>

                <CollapsibleSection title="Defaults">
                  <DefaultsSection
                    defaultAlt={p.defaultAlt}
                    defaultSpeed={p.defaultSpeed}
                    defaultAcceptRadius={p.defaultAcceptRadius}
                    defaultFrame={p.defaultFrame}
                    onAltChange={(v) => p.setDefaults({ defaultAlt: v })}
                    onSpeedChange={(v) => p.setDefaults({ defaultSpeed: v })}
                    onRadiusChange={(v) => p.setDefaults({ defaultAcceptRadius: v })}
                    onFrameChange={(v) => p.setDefaults({ defaultFrame: v })}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Waypoints"
                  defaultOpen={true}
                  count={p.waypoints.length}
                  trailing={
                    <button
                      onClick={p.handleAddManualWaypoint}
                      className="text-text-tertiary hover:text-accent-primary cursor-pointer"
                    >
                      <Plus size={14} />
                    </button>
                  }
                >
                  <WaypointList
                    waypoints={p.waypoints}
                    selectedId={p.selectedWaypointId}
                    expandedId={p.expandedWaypointId}
                    onSelect={p.handleWaypointClick}
                    onExpand={p.setExpandedWaypoint}
                    onUpdate={p.updateWaypoint}
                    onRemove={p.removeWaypoint}
                    onReorder={p.reorderWaypoints}
                    onAddManual={p.handleAddManualWaypoint}
                  />
                </CollapsibleSection>

                <CollapsibleSection
                  title="Geofence"
                  trailing={
                    <span className="text-[10px] font-mono text-text-tertiary">
                      {p.geofenceEnabled ? "on" : "off"}
                    </span>
                  }
                >
                  <GeofenceEditor
                    enabled={p.geofenceEnabled}
                    onToggle={p.setGeofenceEnabled}
                    type={p.geofenceType}
                    onTypeChange={p.setGeofenceType}
                    maxAlt={p.geofenceMaxAlt}
                    onMaxAltChange={p.setGeofenceMaxAlt}
                    action={p.geofenceAction}
                    onActionChange={p.setGeofenceAction}
                  />
                </CollapsibleSection>
              </div>

              <MissionActions
                hasWaypoints={p.waypoints.length > 0}
                hasDrone={!!p.selectedDroneId}
                uploadState={p.uploadState}
                onUpload={p.handleUpload}
                onSave={() => p.setShowSaveDialog(true)}
                onLoad={() => p.setShowLoadDialog(true)}
                onDownloadFromDrone={p.downloadMission}
                onReverseWaypoints={p.handleReverseWaypoints}
                onDiscard={p.handleClearAll}
              />
            </div>
          )}

          {/* Collapsed panel toggle */}
          {p.panelCollapsed && (
            <button
              onClick={p.togglePanel}
              className="w-8 shrink-0 flex items-center justify-center border-l border-border-default bg-bg-secondary hover:bg-bg-tertiary cursor-pointer"
            >
              <ChevronLeft size={14} className="text-text-tertiary" />
            </button>
          )}

          {/* Context menu */}
          {p.contextMenu && (
            <MapContextMenu
              x={p.contextMenu.x}
              y={p.contextMenu.y}
              items={p.contextMenu.items}
              onSelect={p.handleContextAction}
              onClose={() => p.setContextMenu(null)}
            />
          )}
        </div>
      </div>

      {/* Modals rendered OUTSIDE the overflow-hidden container */}
      <SaveMissionDialog
        open={p.showSaveDialog}
        onClose={() => p.setShowSaveDialog(false)}
        missionName={p.missionName}
        onSaveNative={p.handleSaveNative}
        onSaveWaypoints={p.handleSaveWaypoints}
        onSaveQGCPlan={p.handleSaveQGCPlan}
      />

      <LoadMissionDialog
        open={p.showLoadDialog}
        onClose={() => p.setShowLoadDialog(false)}
        onImportFile={p.handleImportFile}
        onLoadRecent={p.handleLoadRecent}
      />

      <ConfirmDialog
        open={p.showClearConfirm}
        onConfirm={p.confirmClear}
        onCancel={() => p.setShowClearConfirm(false)}
        title="Discard Changes"
        message="This will remove all waypoints and mission data. This action cannot be undone."
        confirmLabel="Discard"
        variant="danger"
      />
    </>
  );
}
