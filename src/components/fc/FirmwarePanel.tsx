"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { useDroneManager } from "@/stores/drone-manager";
import {
  AlertTriangle,
  Zap, HardDrive, RefreshCw, Wifi, Usb, Radio,
  Wrench, Loader2,
} from "lucide-react";
import type {
  FlashProgress,
  FlashMethod,
  FirmwareStack,
  ManifestBoard,
  ParsedFirmware,
  BetaflightTarget,
  BetaflightRelease,
  BetaflightBuildOptions,
  BetaflightBuildStatus,
  PX4Release,
  PX4Board,
} from "@/lib/protocol/firmware/types";
import { ArduPilotManifest } from "@/lib/protocol/firmware/manifest";
import { BetaflightManifest } from "@/lib/protocol/firmware/betaflight-manifest";
import { PX4Manifest } from "@/lib/protocol/firmware/px4-manifest";
import { FlashManager } from "@/lib/protocol/firmware/flash-manager";
import { parseApjFile } from "@/lib/protocol/firmware/apj-parser";
import { parseHexFile } from "@/lib/protocol/firmware/hex-parser";
import { parsePx4File } from "@/lib/protocol/firmware/px4-parser";
import { STM32DfuFlasher } from "@/lib/protocol/firmware/stm32-dfu";
import type { UsbDeviceInfo } from "@/lib/usb-device-manager";
import { FirmwareFlashProgress } from "./FirmwareFlashProgress";
import { FirmwareBoardInfo } from "./FirmwareBoardInfo";
import { FirmwareBackupRestore } from "./FirmwareBackupRestore";
import { Select } from "@/components/ui/select";

const apManifest = new ArduPilotManifest();
const bfManifest = new BetaflightManifest();
const px4Manifest = new PX4Manifest();

const VEHICLE_TYPES = [
  { value: "Copter", label: "ArduCopter (Multirotor)" },
  { value: "Plane", label: "ArduPlane (Fixed Wing)" },
  { value: "Rover", label: "ArduRover (Ground Vehicle)" },
  { value: "Sub", label: "ArduSub (Submarine)" },
];

const FIRMWARE_STACKS: { id: FirmwareStack; label: string }[] = [
  { id: "ardupilot", label: "ArduPilot" },
  { id: "betaflight", label: "Betaflight" },
  { id: "px4", label: "PX4" },
];

const AP_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try serial first, then DFU" },
  { id: "serial", label: "Serial", icon: Wifi, desc: "STM32 UART bootloader (most FCs)" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU (some H7 boards)" },
];

const BF_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try serial first, then DFU" },
  { id: "serial", label: "Serial", icon: Wifi, desc: "STM32 UART bootloader" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU" },
];

const PX4_FLASH_METHODS: { id: FlashMethod; label: string; icon: typeof Wifi; desc: string }[] = [
  { id: "auto", label: "Auto", icon: Radio, desc: "Try PX4 serial first, then DFU" },
  { id: "px4-serial", label: "PX4 Serial", icon: Wifi, desc: "PX4 bootloader (px_uploader)" },
  { id: "dfu", label: "USB DFU", icon: Usb, desc: "Native USB DFU" },
];

export function FirmwarePanel() {
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const getSelectedDrone = useDroneManager((s) => s.getSelectedDrone);
  const { toast } = useToast();
  const drone = getSelectedDrone();

  // ── Firmware stack ───────────────────────────────────────
  const [firmwareStack, setFirmwareStack] = useState<FirmwareStack>("ardupilot");

  // ── ArduPilot state ──────────────────────────────────────
  const [apBoards, setApBoards] = useState<ManifestBoard[]>([]);
  const [apLoading, setApLoading] = useState(false);
  const [apError, setApError] = useState("");
  const [apVersions, setApVersions] = useState<string[]>([]);
  const [selectedApBoard, setSelectedApBoard] = useState("");
  const [selectedVehicleType, setSelectedVehicleType] = useState("Copter");
  const [selectedApVersion, setSelectedApVersion] = useState("");

  // ── Betaflight state ─────────────────────────────────────
  const [bfTargets, setBfTargets] = useState<BetaflightTarget[]>([]);
  const [bfReleases, setBfReleases] = useState<BetaflightRelease[]>([]);
  const [bfLoading, setBfLoading] = useState(false);
  const [bfError, setBfError] = useState("");
  const [selectedBfTarget, setSelectedBfTarget] = useState("");
  const [selectedBfRelease, setSelectedBfRelease] = useState("");
  const [bfCustomBuild, setBfCustomBuild] = useState(false);
  const [bfBuildOptions, setBfBuildOptions] = useState<BetaflightBuildOptions | null>(null);
  const [bfSelectedOptions, setBfSelectedOptions] = useState<string[]>([]);
  const [bfBuildStatus, setBfBuildStatus] = useState<BetaflightBuildStatus | null>(null);
  const [bfBuildPolling, setBfBuildPolling] = useState(false);

  // ── PX4 state ────────────────────────────────────────────
  const [px4Releases, setPx4Releases] = useState<PX4Release[]>([]);
  const [px4Loading, setPx4Loading] = useState(false);
  const [px4Error, setPx4Error] = useState("");
  const [selectedPx4Release, setSelectedPx4Release] = useState("");
  const [selectedPx4Board, setSelectedPx4Board] = useState("");

  // ── Common state ─────────────────────────────────────────
  const [flashMethod, setFlashMethod] = useState<FlashMethod>("auto");
  const [dfuDevices, setDfuDevices] = useState<UsbDeviceInfo[]>([]);
  const [customFile, setCustomFile] = useState<File | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [progress, setProgress] = useState<FlashProgress | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashManagerRef = useRef<FlashManager | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoDetected = useRef(false);
  const [flashMessage, setFlashMessage] = useState("");
  const [checklist, setChecklist] = useState({
    paramBackup: false,
    propsRemoved: false,
    batteryOff: false,
  });
  const allChecked = checklist.paramBackup && checklist.propsRemoved && checklist.batteryOff;
  const [serialSupported, setSerialSupported] = useState(false);
  const [usbSupported, setUsbSupported] = useState(false);

  // ── Browser support check ────────────────────────────────
  useEffect(() => {
    setSerialSupported("serial" in navigator);
    setUsbSupported(STM32DfuFlasher.isSupported());
    if (STM32DfuFlasher.isSupported()) {
      STM32DfuFlasher.getKnownDevices().then(setDfuDevices).catch(() => {});
    }
  }, []);

  // ── Cleanup BF build polling on unmount ─────────────────
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  // ── Auto-detect firmware stack from connected drone (first connection only) ──
  useEffect(() => {
    if (drone && !hasAutoDetected.current) {
      hasAutoDetected.current = true;
      const ft = drone.vehicleInfo.firmwareType;
      if (ft.startsWith("ardupilot")) setFirmwareStack("ardupilot");
      else if (ft === "betaflight") setFirmwareStack("betaflight");
      else if (ft === "px4") setFirmwareStack("px4");
    }
  }, [drone]);

  // ── Load data when firmware stack changes ────────────────
  useEffect(() => {
    if (firmwareStack === "ardupilot" && apBoards.length === 0) {
      loadApManifest();
    } else if (firmwareStack === "betaflight" && bfTargets.length === 0) {
      loadBfTargets();
    } else if (firmwareStack === "px4" && px4Releases.length === 0) {
      loadPx4Releases();
    }
    // Reset flash method to auto when switching stacks
    setFlashMethod("auto");
  }, [firmwareStack]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load ArduPilot versions on board/vehicle change ──────
  useEffect(() => {
    if (firmwareStack === "ardupilot" && selectedApBoard && selectedVehicleType) {
      setSelectedApVersion(""); // Reset before loading new versions
      loadApVersions(selectedApBoard, selectedVehicleType);
    }
  }, [selectedApBoard, selectedVehicleType, firmwareStack]);

  // ── Load BF releases when target changes ─────────────────
  useEffect(() => {
    if (firmwareStack === "betaflight" && selectedBfTarget) {
      loadBfReleases(selectedBfTarget);
    }
  }, [selectedBfTarget, firmwareStack]);

  // ── Load BF build options when release changes ───────────
  useEffect(() => {
    if (firmwareStack === "betaflight" && bfCustomBuild && selectedBfRelease) {
      loadBfBuildOptions(selectedBfRelease);
    }
  }, [selectedBfRelease, bfCustomBuild, firmwareStack]);

  // ── Auto-select connected board (ArduPilot) ──────────────
  useEffect(() => {
    if (drone && apBoards.length > 0 && !selectedApBoard && firmwareStack === "ardupilot") {
      const info = drone.vehicleInfo;
      const firmwareStr = info.firmwareVersionString?.toLowerCase() ?? "";
      const match = apBoards.find((b) => firmwareStr.includes(b.name.toLowerCase()));
      if (match) setSelectedApBoard(match.name);

      const classMap: Record<string, string> = { copter: "Copter", plane: "Plane", rover: "Rover", sub: "Sub" };
      const vc = info.vehicleClass;
      if (vc && classMap[vc]) setSelectedVehicleType(classMap[vc]);
    }
  }, [drone, apBoards, selectedApBoard, firmwareStack]);

  // ── Manifest loaders ─────────────────────────────────────

  async function loadApManifest() {
    setApLoading(true);
    setApError("");
    try {
      await apManifest.getManifest();
      const boardList = await apManifest.getBoards();
      setApBoards(boardList);
      if (boardList.length > 0 && !selectedApBoard) {
        setSelectedApBoard(boardList[0].name);
      }
    } catch (err) {
      setApError(err instanceof Error ? err.message : "Failed to load ArduPilot manifest");
    } finally {
      setApLoading(false);
    }
  }

  async function loadApVersions(board: string, vehicleType: string) {
    try {
      const v = await apManifest.getVersions(board, vehicleType);
      setApVersions(v);
      if (v.length > 0) {
        const stable = v.find((x) => x.toLowerCase().startsWith("stable") || x === "OFFICIAL") ?? v[0];
        setSelectedApVersion(stable);
      }
    } catch {
      setApVersions([]);
    }
  }

  async function loadBfTargets() {
    setBfLoading(true);
    setBfError("");
    try {
      const targets = await bfManifest.getTargets();
      setBfTargets(targets);
      if (targets.length > 0 && !selectedBfTarget) {
        setSelectedBfTarget(targets[0].target);
      }
    } catch (err) {
      setBfError(err instanceof Error ? err.message : "Failed to load Betaflight targets");
    } finally {
      setBfLoading(false);
    }
  }

  async function loadBfReleases(target: string) {
    try {
      const releases = await bfManifest.getReleasesForTarget(target);
      setBfReleases(releases);
      if (releases.length > 0) {
        setSelectedBfRelease(releases[0].release);
      }
    } catch {
      setBfReleases([]);
    }
  }

  async function loadBfBuildOptions(release: string) {
    try {
      const opts = await bfManifest.getBuildOptions(release);
      setBfBuildOptions(opts);
    } catch {
      setBfBuildOptions(null);
    }
  }

  async function loadPx4Releases() {
    setPx4Loading(true);
    setPx4Error("");
    try {
      const releases = await px4Manifest.getReleases();
      setPx4Releases(releases);
      // Default to first stable release
      const stable = releases.find((r) => !r.prerelease);
      if (stable) {
        setSelectedPx4Release(stable.tag);
      } else if (releases.length > 0) {
        setSelectedPx4Release(releases[0].tag);
      }
    } catch (err) {
      setPx4Error(err instanceof Error ? err.message : "Failed to load PX4 releases");
    } finally {
      setPx4Loading(false);
    }
  }

  // ── Betaflight cloud build ───────────────────────────────

  async function handleBfCloudBuild() {
    if (!selectedBfTarget || !selectedBfRelease) return;
    setBfBuildPolling(true);
    setBfBuildStatus(null);
    try {
      const status = await bfManifest.requestBuild({
        target: selectedBfTarget,
        release: selectedBfRelease,
        options: bfSelectedOptions,
      });
      setBfBuildStatus(status);
      if (status.status !== "success" && status.status !== "error") {
        pollBfBuild(status.key);
      }
    } catch (err) {
      setBfBuildPolling(false);
      toast(err instanceof Error ? err.message : "Cloud build failed", "error");
    }
  }

  function pollBfBuild(key: string, attempt = 0) {
    if (attempt > 60) { // 5 min max (60 * 5s)
      setBfBuildPolling(false);
      setBfBuildStatus((prev) => prev ? { ...prev, status: "error" } : null);
      return;
    }
    pollTimeoutRef.current = setTimeout(async () => {
      try {
        const status = await bfManifest.pollBuildStatus(key);
        setBfBuildStatus(status);
        if (status.status === "success" || status.status === "error") {
          setBfBuildPolling(false);
          return;
        }
        pollBfBuild(key, attempt + 1);
      } catch {
        setBfBuildPolling(false);
      }
    }, 5000);
  }

  function toggleBfOption(option: string) {
    setBfSelectedOptions((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
    );
  }

  // ── DFU detect handler ────────────────────────────────────
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
        setFlashMessage("WebUSB blocked. Serve Command over HTTPS or localhost.");
      } else {
        const msg = err instanceof Error ? err.message : "Unknown error";
        if (!msg.includes("cancelled") && !msg.includes("aborted")) {
          setFlashMessage(`DFU detection failed: ${msg}`);
        }
      }
    }
  }

  // ── Flash handler ──────────────────────────────────────────
  const handleFlash = useCallback(async () => {
    setIsFlashing(true);
    setProgress(null);
    setFlashMessage("");

    try {
      let firmware: ParsedFirmware;

      if (useCustom && customFile) {
        const content = await customFile.text();
        const name = customFile.name.toLowerCase();
        if (name.endsWith(".hex")) {
          firmware = parseHexFile(content);
        } else if (name.endsWith(".apj")) {
          firmware = parseApjFile(content);
        } else if (name.endsWith(".px4")) {
          firmware = parsePx4File(content);
        } else {
          const buffer = await customFile.arrayBuffer();
          firmware = {
            blocks: [{ address: 0x08000000, data: new Uint8Array(buffer) }],
            totalBytes: buffer.byteLength,
          };
        }
      } else if (firmwareStack === "ardupilot") {
        setProgress({ phase: "idle", percent: 0, message: "Downloading firmware..." });
        const url = await apManifest.getFirmwareUrl(selectedApBoard, selectedVehicleType, selectedApVersion);
        if (!url) {
          throw new Error(`No firmware found for ${selectedApBoard} / ${selectedVehicleType} / ${selectedApVersion}`);
        }
        const useDfu = flashMethod === "dfu" || (flashMethod === "auto" && dfuDevices.length > 0);
        firmware = await apManifest.downloadFirmware(url, { forDfu: useDfu });
      } else if (firmwareStack === "betaflight") {
        setProgress({ phase: "idle", percent: 0, message: "Downloading firmware..." });
        if (bfCustomBuild) {
          if (!bfBuildStatus || bfBuildStatus.status !== "success" || !bfBuildStatus.url) {
            throw new Error("Custom build not ready. Build firmware first, then flash.");
          }
          firmware = await bfManifest.downloadFirmware(bfBuildStatus.url);
        } else {
          const info = await bfManifest.getBuildInfo(selectedBfTarget, selectedBfRelease);
          firmware = await bfManifest.downloadFirmware(info.url);
        }
      } else {
        // PX4
        setProgress({ phase: "idle", percent: 0, message: "Downloading firmware..." });
        const url = await px4Manifest.getFirmwareUrl(selectedPx4Release, selectedPx4Board);
        if (!url) {
          throw new Error(`No firmware found for ${selectedPx4Release} / ${selectedPx4Board}`);
        }
        firmware = await px4Manifest.downloadFirmware(url);
      }

      setFlashMessage(`Firmware: ${(firmware.totalBytes / 1024).toFixed(1)} KB` +
        (firmware.boardId ? ` (board ID: ${firmware.boardId})` : ""));

      const protocol = drone?.protocol ?? null;
      const transport = drone?.transport ?? null;
      const fm = new FlashManager(protocol, transport);
      flashManagerRef.current = fm;

      // For PX4 with auto flash method, prefer px4-serial
      let method = flashMethod;
      if (firmwareStack === "px4" && method === "auto") {
        method = "px4-serial";
      }

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
          userMessage = "WebUSB blocked. Serve Command over HTTPS or localhost.";
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
  }, [useCustom, customFile, firmwareStack, selectedApBoard, selectedVehicleType, selectedApVersion,
      selectedBfTarget, selectedBfRelease, bfCustomBuild, bfBuildStatus,
      selectedPx4Release, selectedPx4Board,
      flashMethod, drone, checklist.paramBackup, toast, dfuDevices.length]);

  const handleAbort = useCallback(() => {
    flashManagerRef.current?.abort();
  }, []);

  const handleCustomFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCustomFile(file);
      setUseCustom(true);
    }
  };

  // ── Helpers ──────────────────────────────────────────────

  function versionLabel(v: string): string {
    const lower = v.toLowerCase();
    if (lower.startsWith("stable") || lower === "official") return `Stable ${v.replace(/^stable-/i, "")} (Recommended)`;
    if (lower === "beta") return "Latest Beta";
    if (lower === "latest") return "Latest Build";
    if (lower === "dev") return "Development (Unstable)";
    return v;
  }

  const currentFlashMethods = firmwareStack === "px4" ? PX4_FLASH_METHODS
    : firmwareStack === "betaflight" ? BF_FLASH_METHODS
    : AP_FLASH_METHODS;

  const isLoading = firmwareStack === "ardupilot" ? apLoading
    : firmwareStack === "betaflight" ? bfLoading
    : px4Loading;

  const currentError = firmwareStack === "ardupilot" ? apError
    : firmwareStack === "betaflight" ? bfError
    : px4Error;

  const px4SelectedRelease = px4Releases.find((r) => r.tag === selectedPx4Release);
  const px4Boards = px4SelectedRelease?.boards ?? [];

  const customFileAccept = firmwareStack === "px4" ? ".px4,.bin"
    : firmwareStack === "betaflight" ? ".hex,.bin"
    : ".apj,.bin,.hex";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Zap size={20} className="text-accent-primary" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">Flash Tool</h1>
            <p className="text-xs text-text-tertiary">Flash firmware via USB DFU or serial bootloader</p>
          </div>
        </div>

        {/* Firmware stack selector */}
        <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
          <h2 className="text-xs font-semibold text-text-primary">Firmware Stack</h2>
          <div className="flex gap-2">
            {FIRMWARE_STACKS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setFirmwareStack(id); setUseCustom(false); }}
                disabled={isFlashing}
                className={`flex-1 px-3 py-2 text-xs font-semibold border cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${
                  firmwareStack === id
                    ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                    : "border-border-default text-text-secondary hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {drone && (
            <p className="text-[10px] text-text-tertiary">
              Auto-detected from connected drone: {drone.vehicleInfo.firmwareType}
            </p>
          )}
        </div>

        {/* DFU status banner */}
        {dfuDevices.length > 0 ? (
          <div className="border border-status-success/40 bg-status-success/5 p-4 space-y-2">
            <p className="text-xs text-status-success font-semibold">DFU Device Connected</p>
            <p className="text-[10px] text-text-secondary">
              {dfuDevices.map((d) => d.label).join(", ")} — ready to flash.
            </p>
          </div>
        ) : selectedDroneId ? (
          <div className="border border-status-warning/40 bg-status-warning/5 p-4 space-y-2">
            <p className="text-xs text-status-warning font-semibold">FC Connected via MAVLink</p>
            <p className="text-[10px] text-text-secondary">
              Your FC is connected via MAVLink. For DFU flashing, disconnect and reconnect while holding the BOOT button.
            </p>
            {usbSupported && (
              <button
                onClick={handleDetectDfu}
                disabled={isFlashing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Usb size={12} />
                Scan for DFU
              </button>
            )}
          </div>
        ) : (
          <div className="border border-border-default bg-bg-secondary p-4 space-y-2">
            <p className="text-xs text-text-secondary font-semibold">No Connection</p>
            <p className="text-[10px] text-text-tertiary">
              Connect your FC in DFU mode: hold BOOT while plugging in USB, then click Scan.
            </p>
            {usbSupported && (
              <button
                onClick={handleDetectDfu}
                disabled={isFlashing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-border-default text-text-secondary hover:text-text-primary hover:bg-bg-tertiary disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <Usb size={12} />
                Scan for DFU
              </button>
            )}
          </div>
        )}

        {/* DFU info collapsible */}
        <details className="bg-bg-secondary border border-border-default">
          <summary className="px-4 py-2.5 text-xs text-text-secondary cursor-pointer hover:text-text-primary transition-colors">
            What is DFU flashing?
          </summary>
          <div className="px-4 pb-3 space-y-2 text-[10px] text-text-tertiary">
            <p>
              <strong className="text-text-secondary">DFU (Device Firmware Upgrade)</strong> is a USB protocol that talks directly to the STM32 bootloader. It bypasses the serial bootloader entirely.
            </p>
            <p>
              <strong className="text-text-secondary">Serial bootloader</strong> uses the FC&apos;s UART to flash firmware. This is the most common method and works with most boards.
            </p>
            <p>
              <strong className="text-text-secondary">When to use DFU:</strong> Some H7-based boards (like Matek H743) work better with DFU. It&apos;s also useful when serial flashing fails or when you need to recover a bricked board.
            </p>
            <p>
              To enter DFU mode, hold the BOOT button on your FC while plugging in the USB cable. The board will appear as a DFU device instead of a serial port.
            </p>
          </div>
        </details>

        {/* No-drone hint */}
        {!drone && dfuDevices.length === 0 && (
          <div className="bg-bg-secondary border border-border-default p-3">
            <p className="text-[10px] text-text-tertiary">
              No drone connected. Select your board and firmware manually, or connect a drone for automatic detection.
            </p>
          </div>
        )}

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
          <FirmwareBoardInfo
            firmwareVersionString={drone.vehicleInfo.firmwareVersionString || ""}
            vehicleClass={drone.vehicleInfo.vehicleClass || ""}
            systemId={drone.vehicleInfo.systemId}
          />
        )}

        {/* ── ArduPilot Board + Firmware Selection ──────────── */}
        {firmwareStack === "ardupilot" && !useCustom && (
          <>
            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <HardDrive size={14} />
                  Target Board
                </h2>
                {apLoading && (
                  <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Loading manifest...
                  </span>
                )}
              </div>

              {apError && (
                <div className="text-[10px] text-status-danger flex items-center justify-between">
                  <span>{apError}</span>
                  <button onClick={() => { apManifest.clearCache(); loadApManifest(); }} className="underline cursor-pointer">Retry</button>
                </div>
              )}

              <Select
                value={selectedApBoard}
                onChange={setSelectedApBoard}
                disabled={apLoading || apBoards.length === 0}
                placeholder="Loading boards..."
                searchable
                options={apBoards.map((b) => ({ value: b.name, label: b.name }))}
              />
              <p className="text-[10px] text-text-tertiary">{apBoards.length} boards available from ArduPilot manifest</p>
            </div>

            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <Zap size={14} />
                Firmware Version
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Vehicle Type"
                  value={selectedVehicleType}
                  onChange={setSelectedVehicleType}
                  options={VEHICLE_TYPES}
                />
                <Select
                  label="Version"
                  value={selectedApVersion}
                  onChange={setSelectedApVersion}
                  disabled={apVersions.length === 0}
                  placeholder={apLoading ? "Loading..." : selectedApBoard ? "No versions found" : "Select board first"}
                  searchable
                  options={apVersions.map((v) => ({ value: v, label: versionLabel(v) }))}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Betaflight Board + Firmware Selection ─────────── */}
        {firmwareStack === "betaflight" && !useCustom && (
          <>
            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <HardDrive size={14} />
                  Target Board
                </h2>
                {bfLoading && (
                  <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Loading targets...
                  </span>
                )}
              </div>

              {bfError && (
                <div className="text-[10px] text-status-danger flex items-center justify-between">
                  <span>{bfError}</span>
                  <button onClick={() => { bfManifest.clearCache(); loadBfTargets(); }} className="underline cursor-pointer">Retry</button>
                </div>
              )}

              <Select
                value={selectedBfTarget}
                onChange={setSelectedBfTarget}
                disabled={bfLoading || bfTargets.length === 0}
                placeholder="Loading targets..."
                searchable
                options={bfTargets.map((t) => ({
                  value: t.target,
                  label: t.target,
                  description: `${t.manufacturer} / ${t.mcu}`,
                }))}
              />
              <p className="text-[10px] text-text-tertiary">{bfTargets.length} targets available</p>
            </div>

            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <Zap size={14} />
                Firmware Version
              </h2>
              <Select
                label="Release"
                value={selectedBfRelease}
                onChange={setSelectedBfRelease}
                disabled={bfReleases.length === 0}
                placeholder={selectedBfTarget ? "Loading releases..." : "Select target first"}
                options={bfReleases.map((r) => ({
                  value: r.release,
                  label: r.label || r.release,
                }))}
              />

              {/* Cloud Build toggle */}
              <div className="border-t border-border-default pt-3">
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={bfCustomBuild}
                    onChange={(e) => setBfCustomBuild(e.target.checked)}
                    className="accent-accent-primary"
                  />
                  <Wrench size={12} />
                  Custom Cloud Build
                </label>
                <p className="text-[10px] text-text-tertiary mt-1 ml-6">
                  Build firmware with specific features enabled (radio protocol, telemetry, etc.)
                </p>
              </div>

              {/* Cloud Build options */}
              {bfCustomBuild && bfBuildOptions && (
                <div className="space-y-3 pl-2 border-l-2 border-accent-primary/30">
                  {bfBuildOptions.radioProtocols.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-secondary font-semibold mb-1">Radio Protocol</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bfBuildOptions.radioProtocols.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => toggleBfOption(opt)}
                            className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                              bfSelectedOptions.includes(opt)
                                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                                : "border-border-default text-text-tertiary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bfBuildOptions.telemetryProtocols.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-secondary font-semibold mb-1">Telemetry Protocol</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bfBuildOptions.telemetryProtocols.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => toggleBfOption(opt)}
                            className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                              bfSelectedOptions.includes(opt)
                                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                                : "border-border-default text-text-tertiary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bfBuildOptions.motorProtocols.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-secondary font-semibold mb-1">Motor Protocol</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bfBuildOptions.motorProtocols.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => toggleBfOption(opt)}
                            className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                              bfSelectedOptions.includes(opt)
                                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                                : "border-border-default text-text-tertiary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bfBuildOptions.osdOptions.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-secondary font-semibold mb-1">OSD Options</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bfBuildOptions.osdOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => toggleBfOption(opt)}
                            className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                              bfSelectedOptions.includes(opt)
                                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                                : "border-border-default text-text-tertiary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {bfBuildOptions.otherOptions.length > 0 && (
                    <div>
                      <p className="text-[10px] text-text-secondary font-semibold mb-1">Other Options</p>
                      <div className="flex flex-wrap gap-1.5">
                        {bfBuildOptions.otherOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => toggleBfOption(opt)}
                            className={`px-2 py-0.5 text-[10px] border cursor-pointer ${
                              bfSelectedOptions.includes(opt)
                                ? "border-accent-primary text-accent-primary bg-accent-primary/10"
                                : "border-border-default text-text-tertiary"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {bfSelectedOptions.length > 0 && (
                    <p className="text-[10px] text-text-tertiary">
                      Selected: {bfSelectedOptions.join(", ")}
                    </p>
                  )}

                  <button
                    onClick={handleBfCloudBuild}
                    disabled={bfBuildPolling || !selectedBfTarget || !selectedBfRelease}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold border border-accent-primary text-accent-primary hover:bg-accent-primary/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    {bfBuildPolling ? <Loader2 size={12} className="animate-spin" /> : <Wrench size={12} />}
                    {bfBuildPolling ? "Building..." : "Build Firmware"}
                  </button>

                  {bfBuildStatus && (
                    <div className={`text-[10px] p-2 border ${
                      bfBuildStatus.status === "success" ? "border-status-success/40 text-status-success"
                      : bfBuildStatus.status === "error" ? "border-status-danger/40 text-status-danger"
                      : "border-border-default text-text-tertiary"
                    }`}>
                      <p className="font-semibold">Build: {bfBuildStatus.status}</p>
                      {bfBuildStatus.progress !== undefined && (
                        <p>Progress: {bfBuildStatus.progress}%</p>
                      )}
                      {bfBuildStatus.status === "success" && bfBuildStatus.file && (
                        <p className="font-mono mt-1">{bfBuildStatus.file}</p>
                      )}
                      {bfBuildStatus.status === "error" && (
                        <button
                          onClick={handleBfCloudBuild}
                          disabled={bfBuildPolling}
                          className="mt-1.5 flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border border-status-danger/40 text-status-danger hover:bg-status-danger/10 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          <RefreshCw size={10} />
                          Retry Build
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── PX4 Board + Firmware Selection ────────────────── */}
        {firmwareStack === "px4" && !useCustom && (
          <>
            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                  <Zap size={14} />
                  PX4 Release
                </h2>
                {px4Loading && (
                  <span className="text-[10px] text-text-tertiary flex items-center gap-1">
                    <RefreshCw size={10} className="animate-spin" /> Loading releases...
                  </span>
                )}
              </div>

              {px4Error && (
                <div className="text-[10px] text-status-danger flex items-center justify-between">
                  <span>{px4Error}</span>
                  <button onClick={() => { px4Manifest.clearCache(); loadPx4Releases(); }} className="underline cursor-pointer">Retry</button>
                </div>
              )}

              <Select
                label="Release"
                value={selectedPx4Release}
                onChange={(v) => { setSelectedPx4Release(v); setSelectedPx4Board(""); }}
                disabled={px4Loading || px4Releases.length === 0}
                placeholder="Loading releases..."
                options={px4Releases.map((r) => ({
                  value: r.tag,
                  label: `${r.name || r.tag}${r.prerelease ? " (pre-release)" : ""}`,
                }))}
              />
            </div>

            <div className="bg-bg-secondary border border-border-default p-4 space-y-3">
              <h2 className="text-xs font-semibold text-text-primary flex items-center gap-2">
                <HardDrive size={14} />
                Target Board
              </h2>
              <Select
                value={selectedPx4Board}
                onChange={setSelectedPx4Board}
                disabled={px4Boards.length === 0}
                placeholder={selectedPx4Release ? (px4Boards.length === 0 ? "No boards in this release" : "Select board...") : "Select release first"}
                searchable
                options={px4Boards.map((b) => ({
                  value: b.name,
                  label: b.displayName,
                  description: `${(b.size / 1024 / 1024).toFixed(1)} MB`,
                }))}
              />
              {px4Boards.length > 0 && (
                <p className="text-[10px] text-text-tertiary">{px4Boards.length} boards in {selectedPx4Release}</p>
              )}
            </div>
          </>
        )}

        {/* Firmware source toggle (official vs custom) */}
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
              {firmwareStack === "ardupilot" ? "ArduPilot" : firmwareStack === "betaflight" ? "Betaflight" : "PX4"} Official
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`flex-1 px-3 py-2 text-xs border cursor-pointer ${useCustom ? "border-accent-primary text-accent-primary bg-accent-primary/10" : "border-border-default text-text-secondary"}`}
            >
              Custom File
            </button>
          </div>

          {useCustom && (
            <div>
              <label className="text-[10px] text-text-tertiary uppercase block mb-1">
                Firmware File ({customFileAccept})
              </label>
              <input
                type="file"
                accept={customFileAccept}
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
            {currentFlashMethods.map(({ id, label, icon: Icon, desc }) => {
              const disabled =
                (id === "serial" && !serialSupported) ||
                (id === "px4-serial" && !serialSupported) ||
                (id === "dfu" && !usbSupported);
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

          {(flashMethod === "dfu" || flashMethod === "auto") && usbSupported && (
            <div className="mt-2">
              {dfuDevices.length > 0 ? (
                <p className="text-[10px] text-status-success">
                  {dfuDevices.length} DFU device{dfuDevices.length > 1 ? "s" : ""} ready: {dfuDevices.map((d) => d.label).join(", ")}
                </p>
              ) : (
                <p className="text-[10px] text-text-tertiary">
                  No DFU devices detected. Use the Scan button above to find one.
                </p>
              )}
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
          <FirmwareFlashProgress
            progress={progress}
            isFlashing={isFlashing}
            onAbort={handleAbort}
          />
        )}

        {/* Status message */}
        {flashMessage && !progress && (
          <div className="bg-bg-secondary border border-border-default p-3">
            <p className="text-[10px] text-text-tertiary font-mono">{flashMessage}</p>
          </div>
        )}

        {/* Error display */}
        {currentError && (
          <div className="bg-status-danger/10 border border-status-danger/30 p-3">
            <p className="text-[10px] text-status-danger">{currentError}</p>
          </div>
        )}

        {/* Action buttons */}
        <FirmwareBackupRestore
          protocol={drone?.protocol ?? null}
          selectedDroneId={selectedDroneId}
          isFlashing={isFlashing}
          allChecked={allChecked}
          serialSupported={serialSupported}
          usbSupported={usbSupported}
          onFlash={handleFlash}
          onMessage={setFlashMessage}
          onParamBackupChecked={() => setChecklist((prev) => ({ ...prev, paramBackup: true }))}
        />
      </div>
    </div>
  );
}
