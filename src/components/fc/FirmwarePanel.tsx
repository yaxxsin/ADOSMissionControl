"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import {
  Cpu, Download, Upload, AlertTriangle, CheckCircle2,
  Zap, HardDrive, RefreshCw, X, Wifi, Usb, Radio,
} from "lucide-react";
import type {
  FlashProgress,
  FlashMethod,
  ManifestBoard,
  FirmwareManifest,
  ParsedFirmware,
} from "@/lib/protocol/firmware/types";
import { ArduPilotManifest } from "@/lib/protocol/firmware/manifest";
import { FlashManager } from "@/lib/protocol/firmware/flash-manager";
import { parseApjFile } from "@/lib/protocol/firmware/apj-parser";
import { parseHexFile } from "@/lib/protocol/firmware/hex-parser";
import { STM32DfuFlasher } from "@/lib/protocol/firmware/stm32-dfu";
import type { UsbDeviceInfo } from "@/lib/usb-device-manager";

const manifest = new ArduPilotManifest();

const VEHICLE_TYPES = [
  { id: "Copter", label: "ArduCopter (Multirotor)" },
  { id: "Plane", label: "ArduPlane (Fixed Wing)" },
  { id: "Rover", label: "ArduRover (Ground Vehicle)" },
  { id: "Sub", label: "ArduSub (Submarine)" },
];

const FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try serial first, then DFU" },
  { id: "serial", label: "Serial", icon: Wifi, desc: "STM32 UART bootloader (most FCs)" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU (some H7 boards)" },
];

export function FirmwarePanel() {
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();
  const drone = getSelectedDrone();

  // ── Manifest state ─────────────────────────────────────
  const [boards, setBoards] = useState<ManifestBoard[]>([]);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [manifestError, setManifestError] = useState("");
  const [versions, setVersions] = useState<string[]>([]);

  // ── Selection state ────────────────────────────────────
  const [selectedBoard, setSelectedBoard] = useState("");
  const [selectedVehicleType, setSelectedVehicleType] = useState("Copter");
  const [selectedVersion, setSelectedVersion] = useState("");
  const [flashMethod, setFlashMethod] = useState<FlashMethod>("auto");

  // ── DFU device detection ─────────────────────────────
  const [dfuDevices, setDfuDevices] = useState<UsbDeviceInfo[]>([]);

  // ── Custom file state ──────────────────────────────────
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [showCommitButton, setShowCommitButton] = useState(false);

  // ── Flash state ────────────────────────────────────────
  const [progress, setProgress] = useState<FlashProgress | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashManagerRef = useRef<FlashManager | null>(null);
  const [flashMessage, setFlashMessage] = useState("");

  // ── Checklist ──────────────────────────────────────────
  const [checklist, setChecklist] = useState({
    paramBackup: false,
    propsRemoved: false,
    batteryOff: false,
  });

  const allChecked = checklist.paramBackup && checklist.propsRemoved && checklist.batteryOff;

  // ── Load manifest on mount ─────────────────────────────
  useEffect(() => {
    loadManifest();
  }, []);

  // ── Load versions when board or vehicle type changes ───
  useEffect(() => {
    if (selectedBoard && selectedVehicleType) {
      loadVersions(selectedBoard, selectedVehicleType);
    }
  }, [selectedBoard, selectedVehicleType]);

  // ── Auto-select connected board ────────────────────────
  useEffect(() => {
    if (drone && boards.length > 0 && !selectedBoard) {
      // Try to match connected board name
      const info = drone.vehicleInfo;
      const firmwareStr = info.firmwareVersionString?.toLowerCase() ?? "";
      const match = boards.find(
        (b) => firmwareStr.includes(b.name.toLowerCase())
      );
      if (match) {
        setSelectedBoard(match.name);
      }

      // Auto-select vehicle type
      const classMap: Record<string, string> = {
        copter: "Copter",
        plane: "Plane",
        rover: "Rover",
        sub: "Sub",
      };
      const vc = info.vehicleClass;
      if (vc && classMap[vc]) {
        setSelectedVehicleType(classMap[vc]);
      }
    }
  }, [drone, boards, selectedBoard]);

  async function loadManifest() {
    setManifestLoading(true);
    setManifestError("");
    try {
      await manifest.getManifest();
      const boardList = await manifest.getBoards();
      setBoards(boardList);
      if (boardList.length > 0 && !selectedBoard) {
        setSelectedBoard(boardList[0].name);
      }
    } catch (err) {
      setManifestError(err instanceof Error ? err.message : "Failed to load firmware manifest");
    } finally {
      setManifestLoading(false);
    }
  }

  async function loadVersions(board: string, vehicleType: string) {
    try {
      const v = await manifest.getVersions(board, vehicleType);
      setVersions(v);
      if (v.length > 0) {
        // Default to OFFICIAL/stable
        const stable = v.find((x) => x.toLowerCase().startsWith("stable") || x === "OFFICIAL") ?? v[0];
        setSelectedVersion(stable);
      }
    } catch {
      setVersions([]);
    }
  }

  // ── DFU detect handler ────────────────────────────────
  async function handleDetectDfu() {
    try {
      const device = await STM32DfuFlasher.requestDevice();
      setFlashMessage(
        `DFU device detected: ${device.productName || "DFU Device"} (${device.vendorId.toString(16).padStart(4, "0")}:${device.productId.toString(16).padStart(4, "0")})`
      );
      STM32DfuFlasher.getKnownDevices().then(setDfuDevices).catch(() => {});
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") {
        setFlashMessage("No DFU device selected. Ensure the FC is in DFU mode (hold BOOT button + plug USB), then try again.");
      } else if (err instanceof DOMException && err.name === "SecurityError") {
        setFlashMessage("WebUSB blocked — serve Command over HTTPS or localhost.");
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (!msg.includes("cancelled") && !msg.includes("aborted")) {
          setFlashMessage(`DFU detection failed: ${msg}`);
        }
      }
    }
  }

  // ── Flash handler ──────────────────────────────────────
  const handleFlash = useCallback(async () => {
    setIsFlashing(true);
    setProgress(null);
    setFlashMessage("");

    try {
      // Resolve firmware
      let firmware: ParsedFirmware;

      if (useCustom && customFile) {
        const content = await customFile.text();
        const name = customFile.name.toLowerCase();
        if (name.endsWith(".hex")) {
          firmware = parseHexFile(content);
        } else if (name.endsWith(".apj")) {
          firmware = parseApjFile(content);
        } else {
          // Try as raw binary
          const buffer = await customFile.arrayBuffer();
          firmware = {
            blocks: [{ address: 0x08000000, data: new Uint8Array(buffer) }],
            totalBytes: buffer.byteLength,
          };
        }
      } else {
        // Download from ArduPilot
        setProgress({ phase: "idle", percent: 0, message: "Downloading firmware..." });
        const url = await manifest.getFirmwareUrl(selectedBoard, selectedVehicleType, selectedVersion);
        if (!url) {
          throw new Error(`No firmware found for ${selectedBoard} / ${selectedVehicleType} / ${selectedVersion}`);
        }
        const useDfu = flashMethod === "dfu" || (flashMethod === "auto" && dfuDevices.length > 0);
        firmware = await manifest.downloadFirmware(url, { forDfu: useDfu });
      }

      setFlashMessage(`Firmware: ${(firmware.totalBytes / 1024).toFixed(1)} KB` +
        (firmware.boardId ? ` (board ID: ${firmware.boardId})` : ""));

      // Create flash manager
      const protocol = drone?.protocol ?? null;
      const transport = drone?.transport ?? null;
      const fm = new FlashManager(protocol, transport);
      flashManagerRef.current = fm;

      // Flash
      const method = flashMethod;
      await fm.flash(firmware, {
        method,
        backupParams: checklist.paramBackup,
        verify: true,
      }, (p) => setProgress(p));

    } catch (err) {
      let userMessage = err instanceof Error ? err.message : "Unknown error";
      if (err instanceof DOMException) {
        if (err.name === "NotFoundError") {
          userMessage = "No DFU device selected. Ensure the FC is in DFU mode (hold BOOT button + plug USB), then try again.";
        } else if (err.name === "SecurityError") {
          userMessage = "WebUSB blocked — serve Command over HTTPS or localhost.";
        } else if (err.name === "NetworkError") {
          userMessage = "USB device disconnected during operation. Reconnect and retry.";
        }
      }
      if (!userMessage.includes("aborted")) {
        setProgress({ phase: "error", percent: 0, message: userMessage });
        toast("Firmware flash failed", "error");
      }
    } finally {
      setIsFlashing(false);
      flashManagerRef.current = null;
    }
  }, [useCustom, customFile, selectedBoard, selectedVehicleType, selectedVersion, flashMethod, drone, checklist.paramBackup, toast]);

  const handleAbort = useCallback(() => {
    flashManagerRef.current?.abort();
  }, []);

  // ── Param backup/restore ───────────────────────────────
  const handleBackupParams = useCallback(async () => {
    const protocol = drone?.protocol;
    if (!protocol) return;

    setFlashMessage("Downloading parameters...");
    try {
      const params = await protocol.getAllParameters();
      const lines = params.map((p) => `${p.name}\t${p.value}`);
      const blob = new Blob([lines.join("\n")], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `params-backup-${Date.now()}.param`;
      a.click();
      URL.revokeObjectURL(url);
      setFlashMessage(`Backed up ${params.length} parameters`);
      setChecklist((prev) => ({ ...prev, paramBackup: true }));
      toast(`Backed up ${params.length} parameters`, "success");
    } catch (err) {
      setFlashMessage(`Backup failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      toast("Parameter backup failed", "error");
    }
  }, [drone, toast]);

  const handleRestoreParams = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".param,.txt";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      const protocol = drone?.protocol;
      if (!protocol) {
        setFlashMessage("Connect a drone first");
        return;
      }

      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim() && !l.startsWith("#"));
      setFlashMessage(`Restoring ${lines.length} parameters...`);

      let success = 0;
      let failed = 0;
      for (const line of lines) {
        const [name, valueStr] = line.split(/\s+/);
        if (!name || !valueStr) continue;
        const value = parseFloat(valueStr);
        if (isNaN(value)) continue;

        try {
          const result = await protocol.setParameter(name, value);
          if (result.success) success++;
          else failed++;
        } catch {
          failed++;
        }
      }

      setFlashMessage(`Restored ${success} parameters (${failed} failed)`);
      if (success > 0) {
        setShowCommitButton(true);
        toast(`Restored ${success} parameters`, "success");
      }
      if (failed > 0) {
        toast(`${failed} parameters failed to restore`, "warning");
      }
    };
    input.click();
  }, [drone, toast]);

  const commitToFlash = useCallback(async () => {
    const protocol = drone?.protocol;
    if (!protocol) return;
    try {
      await protocol.commitParamsToFlash();
      setShowCommitButton(false);
      toast("Written to flash — persists after reboot", "success");
    } catch {
      toast("Failed to write to flash", "error");
    }
  }, [drone, toast]);

  const handleCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFile(file);
      setUseCustom(true);
    }
  };

  // ── Browser support check (deferred to avoid hydration mismatch) ──
  const [serialSupported, setSerialSupported] = useState(false);
  const [usbSupported, setUsbSupported] = useState(false);

  useEffect(() => {
    setSerialSupported("serial" in navigator);
    setUsbSupported(STM32DfuFlasher.isSupported());

    // Enumerate known DFU devices on mount
    if (STM32DfuFlasher.isSupported()) {
      STM32DfuFlasher.getKnownDevices().then(setDfuDevices).catch(() => {});
    }
  }, []);

  // ── Phase label ────────────────────────────────────────
  const phaseLabel: Record<string, string> = {
    idle: "Ready",
    backup: "Backing up parameters...",
    rebooting: "Rebooting to bootloader...",
    bootloader_init: "Connecting to bootloader...",
    chip_detect: "Detecting chip...",
    erasing: "Erasing flash...",
    flashing: "Writing firmware...",
    verifying: "Verifying...",
    restarting: "Restarting...",
    restoring: "Restoring parameters...",
    done: "Firmware update complete!",
    error: "Flash failed",
  };

  // ── Version label formatting ───────────────────────────
  function versionLabel(v: string): string {
    const lower = v.toLowerCase();
    if (lower.startsWith("stable") || lower === "official") return `Stable ${v.replace(/^stable-/i, "")} (Recommended)`;
    if (lower === "beta") return "Latest Beta";
    if (lower === "latest") return "Latest Build";
    if (lower === "dev") return "Development (Unstable)";
    return v;
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Cpu size={20} className="text-accent-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Firmware Update</h1>
            <p className="text-xs text-text-tertiary">Flash ArduPilot firmware to your flight controller</p>
          </div>
        </div>

        {/* Browser support warnings */}
        {!serialSupported && !usbSupported && (
          <div className="bg-status-danger/10 border border-status-danger/30 p-4">
            <p className="text-xs text-status-danger font-semibold">Browser Not Supported</p>
            <p className="text-[10px] text-text-tertiary mt-1">
              Firmware flashing requires Web Serial or WebUSB APIs. Use Chrome or Edge.
            </p>
          </div>
        )}

        {/* Current board info */}
        {drone && (
          <div className="bg-bg-secondary border border-border-default p-4 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={14} className="text-status-success" />
              <span className="text-xs font-semibold text-text-primary">Connected Board</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-[10px] text-text-tertiary uppercase">Firmware</p>
                <p className="font-mono text-text-primary">{drone.vehicleInfo.firmwareVersionString || "Unknown"}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-tertiary uppercase">Vehicle</p>
                <p className="font-mono text-text-primary capitalize">{drone.vehicleInfo.vehicleClass}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-tertiary uppercase">System ID</p>
                <p className="font-mono text-text-primary">{drone.vehicleInfo.systemId}</p>
              </div>
            </div>
          </div>
        )}

        {/* Board selection */}
        <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
              <HardDrive size={14} />
              Target Board
            </h2>
            {manifestLoading && (
              <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" /> Loading manifest...
              </span>
            )}
          </div>

          {manifestError && (
            <div className="text-[10px] text-status-danger flex items-center justify-between">
              <span>{manifestError}</span>
              <button onClick={() => { manifest.clearCache(); loadManifest(); }} className="underline cursor-pointer">Retry</button>
            </div>
          )}

          <select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            disabled={manifestLoading || boards.length === 0}
            className="w-full bg-bg-tertiary text-text-primary text-xs px-3 py-2 border border-border-default focus:outline-none focus:border-accent-primary disabled:opacity-50"
          >
            {boards.length === 0 && <option>Loading boards...</option>}
            {boards.map((b) => (
              <option key={b.name} value={b.name}>{b.name}</option>
            ))}
          </select>
          <p className="text-[10px] text-text-tertiary">{boards.length} boards available from ArduPilot manifest</p>
        </div>

        {/* Firmware source */}
        <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
            <Zap size={14} />
            Firmware Source
          </h2>

          <div className="flex gap-3">
            <button
              onClick={() => setUseCustom(false)}
              className={`flex-1 px-3 py-2 text-xs border cursor-pointer ${!useCustom ? "border-accent-primary text-accent-primary bg-accent-primary/10" : "border-border-default text-text-secondary"}`}
            >
              ArduPilot Official
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`flex-1 px-3 py-2 text-xs border cursor-pointer ${useCustom ? "border-accent-primary text-accent-primary bg-accent-primary/10" : "border-border-default text-text-secondary"}`}
            >
              Custom File
            </button>
          </div>

          {!useCustom ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-text-tertiary uppercase block mb-1">Vehicle Type</label>
                <select
                  value={selectedVehicleType}
                  onChange={(e) => setSelectedVehicleType(e.target.value)}
                  className="w-full bg-bg-tertiary text-text-primary text-xs px-3 py-2 border border-border-default focus:outline-none focus:border-accent-primary"
                >
                  {VEHICLE_TYPES.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-tertiary uppercase block mb-1">Version</label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  disabled={versions.length === 0}
                  className="w-full bg-bg-tertiary text-text-primary text-xs px-3 py-2 border border-border-default focus:outline-none focus:border-accent-primary disabled:opacity-50"
                >
                  {versions.length === 0 && <option>{manifestLoading ? "Loading..." : selectedBoard ? "No versions found" : "Select board first"}</option>}
                  {versions.map((v) => (
                    <option key={v} value={v}>{versionLabel(v)}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-[10px] text-text-tertiary uppercase block mb-1">Firmware File (.apj, .bin, .hex)</label>
              <input
                type="file"
                accept=".apj,.bin,.hex"
                onChange={handleCustomFile}
                className="w-full text-xs text-text-secondary file:bg-bg-tertiary file:text-text-primary file:border file:border-border-default file:px-3 file:py-1.5 file:text-xs file:mr-3 file:cursor-pointer"
              />
              {customFile && (
                <p className="text-[10px] text-text-tertiary mt-1 font-mono">{customFile.name} ({(customFile.size / 1024).toFixed(1)} KB)</p>
              )}
            </div>
          )}
        </div>

        {/* Flash method */}
        <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-primary">Flash Method</h2>
          <div className="flex gap-3">
            {FLASH_METHODS.map(({ id, label, icon: Icon, desc }) => {
              const disabled = (id === "serial" && !serialSupported) || (id === "dfu" && !usbSupported);
              return (
                <button
                  key={id}
                  onClick={() => !disabled && setFlashMethod(id)}
                  disabled={disabled}
                  className={`flex-1 px-3 py-2 text-left border cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    flashMethod === id
                      ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                      : "border-border-default text-text-secondary"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <Icon size={12} />
                    <span className="text-xs font-semibold">{label}</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary mt-0.5">{desc}</p>
                </button>
              );
            })}
          </div>

          {/* DFU device status + detect button */}
          {(flashMethod === "dfu" || flashMethod === "auto") && usbSupported && (
            <div className="mt-3 space-y-2">
              {dfuDevices.length > 0 ? (
                <p className="text-[10px] text-status-success">
                  {dfuDevices.length} DFU device{dfuDevices.length > 1 ? "s" : ""} detected: {dfuDevices.map((d) => d.label).join(", ")}
                </p>
              ) : (
                <p className="text-[10px] text-text-tertiary">
                  No DFU devices detected. Put FC in DFU mode (hold BOOT + plug USB).
                </p>
              )}
              <button
                onClick={handleDetectDfu}
                disabled={isFlashing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Usb size={12} />
                Detect DFU Device
              </button>
            </div>
          )}
        </div>

        {/* Pre-flash checklist */}
        <div className="bg-bg-secondary border border-status-warning/30 p-4 space-y-3">
          <h2 className="text-xs font-semibold text-status-warning flex items-center gap-2">
            <AlertTriangle size={14} />
            Pre-Flash Safety Checklist
          </h2>
          <p className="text-[10px] text-text-tertiary">
            Flashing new firmware will erase all current settings. Complete all checks before proceeding.
          </p>
          <div className="space-y-2">
            {([
              { key: "paramBackup" as const, label: "I have backed up my parameters" },
              { key: "propsRemoved" as const, label: "All propellers are removed" },
              { key: "batteryOff" as const, label: "Flight battery is disconnected (USB power only)" },
            ]).map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={(e) => setChecklist((prev) => ({ ...prev, [key]: e.target.checked }))}
                  className="accent-accent-primary"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Flash progress */}
        {progress && (
          <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">
                {phaseLabel[progress.phase] || progress.phase}
              </span>
              <div className="flex items-center gap-2">
                {progress.phase !== "error" && progress.phase !== "done" && (
                  <span className="text-xs font-mono text-text-tertiary">{progress.percent}%</span>
                )}
                {isFlashing && progress.phase !== "done" && progress.phase !== "error" && (
                  <button
                    onClick={handleAbort}
                    className="flex items-center gap-1 px-2 py-0.5 text-[10px] border border-status-danger/50 text-status-danger hover:bg-status-danger/10 cursor-pointer"
                  >
                    <X size={10} />
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="w-full bg-bg-tertiary h-2">
              <div
                className={`h-full transition-all duration-300 ${
                  progress.phase === "error"
                    ? "bg-status-danger"
                    : progress.phase === "done"
                    ? "bg-status-success"
                    : "bg-accent-primary"
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            {progress.message && (
              <p className="text-[10px] text-text-tertiary font-mono whitespace-pre-wrap">{progress.message}</p>
            )}
            {progress.bytesWritten != null && progress.bytesTotal != null && (
              <p className="text-[10px] text-text-tertiary font-mono">
                {(progress.bytesWritten / 1024).toFixed(1)} / {(progress.bytesTotal / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
        )}

        {/* Status message */}
        {flashMessage && !progress && (
          <div className="bg-bg-secondary border border-border-default p-3">
            <p className="text-[10px] text-text-tertiary font-mono">{flashMessage}</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleFlash}
            disabled={!allChecked || isFlashing || (!serialSupported && !usbSupported)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-accent-primary text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-accent-primary/80 transition-colors"
          >
            <Zap size={14} />
            {isFlashing ? "Flashing..." : "Flash Firmware"}
          </button>

          <button
            onClick={handleBackupParams}
            disabled={!selectedDroneId || isFlashing}
            className="flex items-center gap-2 px-4 py-2 text-xs border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Download size={14} />
            Backup Parameters
          </button>

          <button
            onClick={handleRestoreParams}
            disabled={!selectedDroneId || isFlashing}
            className="flex items-center gap-2 px-4 py-2 text-xs border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
          >
            <Upload size={14} />
            Restore Parameters
          </button>

          {showCommitButton && (
            <button
              onClick={commitToFlash}
              className="flex items-center gap-2 px-4 py-2 text-xs border border-accent-primary/50 text-accent-primary hover:bg-accent-primary/10 cursor-pointer transition-colors"
            >
              <HardDrive size={14} />
              Write to Flash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
