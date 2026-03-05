/**
 * STM32 USB DFU v1.1 + DFuSe extensions via WebUSB API.
 *
 * For flight controllers that expose a native USB DFU interface
 * (e.g. STM32H743 boards without USB-UART bridge). Secondary
 * flash method — most FCs use the serial bootloader instead.
 *
 * Reference: betaflight-configurator/src/js/protocols/webusbdfu.js
 *
 * @module protocol/firmware/stm32-dfu
 */

/// <reference path="../web-usb.d.ts" />

import type {
  FirmwareFlasher,
  FlashProgressCallback,
  ParsedFirmware,
  DfuFlashLayout,
} from "./types";
import { DFU_STATE, DFU_STATE_NAME } from "./types";
import { usbDeviceManager, type UsbDeviceInfo } from "../../usb-device-manager";
import { getFlashLayout, getTransferSize } from "./stm32-dfu-descriptors";

// DFU class requests
const DFU_DNLOAD = 0x01;
const DFU_UPLOAD = 0x02;
const DFU_GETSTATUS = 0x03;
const DFU_CLRSTATUS = 0x04;

// DFuSe commands (sent via DNLOAD with wBlockNum=0)
const DFUSE_CMD_SET_ADDRESS = 0x21;
const DFUSE_CMD_ERASE = 0x41;

/** Default transfer size if functional descriptor is unavailable. */
const DEFAULT_TRANSFER_SIZE = 2048;

/** Timeout for DFU operations (ms). */
const DFU_TIMEOUT = 5000;

/** Timeout for erase operations (ms). */
const ERASE_TIMEOUT = 30000;

// ── STM32DfuFlasher ────────────────────────────────────────

export class STM32DfuFlasher implements FirmwareFlasher {
  readonly method = "dfu" as const;

  private device: USBDevice;
  private interfaceNumber = 0;
  private transferSize = DEFAULT_TRANSFER_SIZE;
  private flashLayout: DfuFlashLayout | null = null;
  private aborted = false;

  constructor(device: USBDevice) {
    this.device = device;
  }

  static isSupported(): boolean {
    return usbDeviceManager.isSupported();
  }

  static async requestDevice(): Promise<USBDevice> {
    return usbDeviceManager.requestDevice();
  }

  static async getKnownDevices(): Promise<UsbDeviceInfo[]> {
    return usbDeviceManager.getKnownDevices();
  }

  // ── Public Interface ───────────────────────────────────

  async flash(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    try {
      onProgress({ phase: "bootloader_init", percent: 8, message: "Opening USB device..." });
      await this.openAndClaim();

      onProgress({ phase: "chip_detect", percent: 10, message: "Reading flash layout..." });
      this.flashLayout = await getFlashLayout(this.device, this.interfaceNumber);
      this.transferSize = await getTransferSize(this.device, DEFAULT_TRANSFER_SIZE);

      if (this.flashLayout) {
        onProgress({
          phase: "chip_detect",
          percent: 12,
          message: `Flash: ${this.flashLayout.name} (${(this.flashLayout.totalSize / 1024)}KB), transfer size: ${this.transferSize}`,
        });
      }

      await this.clearStatus();
      this.checkAbort();

      if (this.flashLayout) {
        if (firmware.totalBytes > this.flashLayout.totalSize) {
          throw new Error(
            `Firmware (${firmware.totalBytes} bytes) exceeds flash size (${this.flashLayout.totalSize} bytes)`
          );
        }
        onProgress({ phase: "erasing", percent: 15, message: "Erasing flash sectors..." });
        await this.erasePages(firmware, onProgress);
      } else {
        console.warn("[DFU] Flash layout unavailable — falling back to mass erase");
        await this.massErase(onProgress);
      }
      onProgress({ phase: "erasing", percent: 25, message: "Erase complete" });
      this.checkAbort();

      await this.writeBlocks(firmware, onProgress);
      this.checkAbort();

      onProgress({ phase: "restarting", percent: 95, message: "Leaving DFU mode..." });
      const startAddress = firmware.blocks[0]?.address ?? 0x08000000;
      await this.leave(startAddress);

      onProgress({ phase: "done", percent: 100, message: "Flash complete!" });
    } finally {
      await this.releaseDevice();
    }
  }

  async verify(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    const totalBytes = firmware.totalBytes;
    let verifiedBytes = 0;

    try {
      await this.openAndClaim();
      if (!this.flashLayout) {
        this.flashLayout = await getFlashLayout(this.device, this.interfaceNumber);
      }
      this.transferSize = await getTransferSize(this.device, DEFAULT_TRANSFER_SIZE);
      await this.clearStatus();

      for (const block of firmware.blocks) {
        await this.clearStatus();
        await this.loadAddress(block.address);

        let offset = 0;
        let blockNum = 2;
        while (offset < block.data.length) {
          this.checkAbort();
          const chunkSize = Math.min(this.transferSize, block.data.length - offset);
          const readData = await this.readBlock(blockNum, chunkSize);

          for (let i = 0; i < chunkSize; i++) {
            if (readData[i] !== block.data[offset + i]) {
              throw new Error(
                `Verification failed at 0x${(block.address + offset + i).toString(16).toUpperCase()}`
              );
            }
          }

          verifiedBytes += chunkSize;
          offset += chunkSize;
          blockNum++;
          const percent = 75 + Math.round((verifiedBytes / totalBytes) * 20);
          onProgress({
            phase: "verifying", percent,
            message: `Verifying... ${verifiedBytes}/${totalBytes} bytes`,
            bytesWritten: verifiedBytes, bytesTotal: totalBytes,
            phasePercent: Math.round((verifiedBytes / totalBytes) * 100),
          });
        }
      }
    } finally {
      await this.releaseDevice();
    }
  }

  abort(): void { this.aborted = true; }
  async dispose(): Promise<void> { await this.releaseDevice(); }

  // ── USB Device Management ──────────────────────────────

  private async openAndClaim(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    if (this.device.configuration === null) await this.device.selectConfiguration(1);

    const iface = this.device.configuration?.interfaces.find((i) =>
      i.alternates.some((a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01)
    );
    if (!iface) throw new Error("No DFU interface found on this USB device");

    this.interfaceNumber = iface.interfaceNumber;
    await this.device.claimInterface(this.interfaceNumber);

    const flashAlt = iface.alternates.find(
      (a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01 &&
        (a.interfaceName?.includes("Flash") || a.interfaceName?.includes("@Internal"))
    ) ?? iface.alternates.find(
      (a) => a.interfaceClass === 0xfe && a.interfaceSubclass === 0x01
    );
    if (flashAlt) {
      await this.device.selectAlternateInterface(this.interfaceNumber, flashAlt.alternateSetting);
    }
  }

  private async releaseDevice(): Promise<void> {
    try {
      if (this.device.opened) {
        await this.device.releaseInterface(this.interfaceNumber).catch(() => {});
        await this.device.close().catch(() => {});
      }
    } catch { /* Ignore close errors */ }
  }

  // ── DFU Protocol Operations ────────────────────────────

  private async getStatus(): Promise<{ status: number; pollTimeout: number; state: number }> {
    const result = await this.device.controlTransferIn(
      { requestType: "class", recipient: "interface", request: DFU_GETSTATUS, value: 0, index: this.interfaceNumber },
      6
    );
    if (!result.data || result.data.byteLength < 6) throw new Error("Invalid DFU_GETSTATUS response");
    const data = result.data;
    return {
      status: data.getUint8(0),
      pollTimeout: data.getUint8(1) | (data.getUint8(2) << 8) | (data.getUint8(3) << 16),
      state: data.getUint8(4),
    };
  }

  private async clearStatus(): Promise<void> {
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
    );
    for (let i = 0; i < 10; i++) {
      const status = await this.getStatus();
      if (status.state === DFU_STATE.dfuIDLE) return;
      if (status.state === DFU_STATE.dfuERROR) {
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
      }
      await this.delay(status.pollTimeout || 100);
    }
    throw new Error("Failed to reach dfuIDLE state");
  }

  private async loadAddress(address: number): Promise<void> {
    const data = new Uint8Array([DFUSE_CMD_SET_ADDRESS, address & 0xff, (address >> 8) & 0xff, (address >> 16) & 0xff, (address >> 24) & 0xff]);
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber }, data
    );
    await this.pollUntilIdle(DFU_TIMEOUT);
  }

  private async erasePage(address: number): Promise<void> {
    const data = new Uint8Array([DFUSE_CMD_ERASE, address & 0xff, (address >> 8) & 0xff, (address >> 16) & 0xff, (address >> 24) & 0xff]);
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber }, data
    );
    await this.pollUntilIdle(ERASE_TIMEOUT);
  }

  private async massErase(onProgress: FlashProgressCallback): Promise<void> {
    onProgress({ phase: "erasing", percent: 15, message: "Mass erasing flash (descriptor unavailable)..." });
    const data = new Uint8Array([DFUSE_CMD_ERASE]);
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber }, data,
    );
    await this.pollUntilIdle(ERASE_TIMEOUT);
  }

  private async writeBlock(blockNum: number, data: Uint8Array): Promise<void> {
    await this.device.controlTransferOut(
      { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: blockNum, index: this.interfaceNumber }, data
    );
    await this.pollUntilIdle(DFU_TIMEOUT);
  }

  private async readBlock(blockNum: number, length: number): Promise<Uint8Array> {
    const result = await this.device.controlTransferIn(
      { requestType: "class", recipient: "interface", request: DFU_UPLOAD, value: blockNum, index: this.interfaceNumber }, length
    );
    if (!result.data) throw new Error("No data in DFU_UPLOAD response");
    return new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
  }

  private async leave(startAddress: number): Promise<void> {
    await this.loadAddress(startAddress);
    try {
      await this.device.controlTransferOut(
        { requestType: "class", recipient: "interface", request: DFU_DNLOAD, value: 0, index: this.interfaceNumber }
      );
      await this.getStatus().catch(() => {});
    } catch { /* Expected — device resets */ }
  }

  private async pollUntilIdle(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await this.getStatus();
      if (status.state === DFU_STATE.dfuDNLOAD_IDLE || status.state === DFU_STATE.dfuIDLE) return;
      if (status.state === DFU_STATE.dfuERROR) {
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        const retryStatus = await this.getStatus();
        if (retryStatus.state === DFU_STATE.dfuIDLE || retryStatus.state === DFU_STATE.dfuDNLOAD_IDLE) return;
        const stateName = DFU_STATE_NAME[status.state] ?? `unknown(${status.state})`;
        throw new Error(`DFU error state: ${stateName}, status: ${status.status}`);
      }
      await this.delay(Math.min(Math.max(status.pollTimeout, 50), 5000));
    }
    // H743 Rev.V workaround
    try {
      const lastStatus = await this.getStatus();
      if (lastStatus.state === DFU_STATE.dfuDNBUSY || lastStatus.state === DFU_STATE.dfuDNLOAD_SYNC) {
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        await this.getStatus();
        await this.device.controlTransferOut(
          { requestType: "class", recipient: "interface", request: DFU_CLRSTATUS, value: 0, index: this.interfaceNumber }
        );
        const recovered = await this.getStatus();
        if (recovered.state === DFU_STATE.dfuIDLE || recovered.state === DFU_STATE.dfuDNLOAD_IDLE) return;
      }
    } catch { /* Recovery failed */ }
    throw new Error("DFU poll timeout");
  }

  // ── Flash Operations ───────────────────────────────────

  private async erasePages(firmware: ParsedFirmware, onProgress: FlashProgressCallback): Promise<void> {
    if (!this.flashLayout) throw new Error("Flash layout not available");
    const sectorsToErase: number[] = [];
    for (const block of firmware.blocks) {
      const blockEnd = block.address + block.data.length;
      for (const sector of this.flashLayout.sectors) {
        for (let i = 0; i < sector.count; i++) {
          const sectorAddr = sector.address + i * sector.size;
          const sectorEnd = sectorAddr + sector.size;
          if (sectorAddr < blockEnd && sectorEnd > block.address) {
            if (!sectorsToErase.includes(sectorAddr)) sectorsToErase.push(sectorAddr);
          }
        }
      }
    }
    for (let i = 0; i < sectorsToErase.length; i++) {
      this.checkAbort();
      await this.erasePage(sectorsToErase[i]);
      const percent = 15 + Math.round(((i + 1) / sectorsToErase.length) * 10);
      onProgress({
        phase: "erasing", percent,
        message: `Erasing sector ${i + 1}/${sectorsToErase.length} at 0x${sectorsToErase[i].toString(16)}`,
        phasePercent: Math.round(((i + 1) / sectorsToErase.length) * 100),
      });
    }
  }

  private async writeBlocks(firmware: ParsedFirmware, onProgress: FlashProgressCallback): Promise<void> {
    const totalBytes = firmware.totalBytes;
    let writtenBytes = 0;
    for (const block of firmware.blocks) {
      await this.loadAddress(block.address);
      let offset = 0;
      let blockNum = 2;
      while (offset < block.data.length) {
        this.checkAbort();
        const chunkSize = Math.min(this.transferSize, block.data.length - offset);
        const chunk = block.data.slice(offset, offset + chunkSize);
        await this.writeBlock(blockNum, chunk);
        writtenBytes += chunkSize;
        offset += chunkSize;
        blockNum++;
        const percent = 25 + Math.round((writtenBytes / totalBytes) * 50);
        onProgress({
          phase: "flashing", percent,
          message: `Writing... ${writtenBytes}/${totalBytes} bytes`,
          bytesWritten: writtenBytes, bytesTotal: totalBytes,
          phasePercent: Math.round((writtenBytes / totalBytes) * 100),
        });
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────

  private checkAbort(): void { if (this.aborted) throw new Error("Flash aborted by user"); }
  private delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
}
