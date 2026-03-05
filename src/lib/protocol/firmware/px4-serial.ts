/**
 * PX4 bootloader protocol over UART via Web Serial API.
 *
 * Implements the PX4 bootloader protocol (px_uploader) for flashing
 * .px4 firmware files to PX4-based flight controllers.
 *
 * Reference: PX4/Firmware/Tools/px_uploader.py
 *
 * @module protocol/firmware/px4-serial
 */

/// <reference path="../web-serial.d.ts" />

import type {
  FirmwareFlasher,
  FlashMethod,
  FlashProgressCallback,
  ParsedFirmware,
} from "./types";
import { crc32, PX4_BL, flattenFirmware } from "./px4-serial-helpers";

export class PX4SerialFlasher implements FirmwareFlasher {
  readonly method: FlashMethod = "px4-serial";

  private port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private aborted = false;
  private readBuffer: number[] = [];

  constructor(port: SerialPort) {
    this.port = port;
  }

  static async requestPort(): Promise<SerialPort> {
    if (typeof navigator === "undefined" || !("serial" in navigator)) {
      throw new Error("Web Serial API not supported — use Chrome or Edge");
    }
    return navigator.serial.requestPort();
  }

  // ── Public Interface ───────────────────────────────────

  async flash(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    try {
      onProgress({ phase: "bootloader_init", percent: 5, message: "Opening serial port..." });
      await this.openPort();

      onProgress({ phase: "bootloader_init", percent: 8, message: "Synchronizing with PX4 bootloader..." });
      await this.sync();
      this.checkAbort();

      onProgress({ phase: "chip_detect", percent: 10, message: "Reading board ID..." });
      const boardId = await this.getBoardId();
      if (firmware.boardId !== undefined && boardId !== firmware.boardId) {
        throw new Error(`Board ID mismatch: firmware expects ${firmware.boardId}, connected board reports ${boardId}`);
      }
      onProgress({ phase: "chip_detect", percent: 12, message: `Board ID: ${boardId}` });
      this.checkAbort();

      onProgress({ phase: "erasing", percent: 15, message: "Erasing flash (this may take a while)..." });
      await this.chipErase();
      onProgress({ phase: "erasing", percent: 25, message: "Erase complete" });
      this.checkAbort();

      const allData = flattenFirmware(firmware);
      await this.programFirmware(allData, onProgress);
      this.checkAbort();

      onProgress({ phase: "verifying", percent: 85, message: "Verifying CRC32..." });
      await this.verifyCrc(allData);
      onProgress({ phase: "verifying", percent: 90, message: "CRC32 verified" });

      onProgress({ phase: "restarting", percent: 95, message: "Rebooting flight controller..." });
      await this.reboot();

      onProgress({ phase: "done", percent: 100, message: "Flash complete!" });
    } finally {
      await this.closePort();
    }
  }

  async verify(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });
    try {
      if (!this.reader || !this.writer) { await this.openPort(); await this.sync(); }
      onProgress({ phase: "verifying", percent: 80, message: "Computing CRC32..." });
      const allData = flattenFirmware(firmware);
      await this.verifyCrc(allData);
      onProgress({ phase: "verifying", percent: 95, message: "CRC32 verified" });
    } finally {
      await this.closePort();
    }
  }

  abort(): void { this.aborted = true; }
  async dispose(): Promise<void> { await this.closePort(); }

  // ── Port Management ────────────────────────────────────

  private async openPort(): Promise<void> {
    await this.port.open({ baudRate: 115200, parity: "none", stopBits: 1, dataBits: 8 });
    this.readBuffer = [];
    if (this.port.readable) this.reader = this.port.readable.getReader();
    if (this.port.writable) this.writer = this.port.writable.getWriter();
  }

  private async closePort(): Promise<void> {
    try {
      if (this.reader) { await this.reader.cancel().catch(() => {}); this.reader.releaseLock(); this.reader = null; }
      if (this.writer) { await this.writer.close().catch(() => {}); this.writer.releaseLock(); this.writer = null; }
      await this.port.close().catch(() => {});
    } catch { /* Ignore close errors */ }
  }

  // ── PX4 Bootloader Protocol ────────────────────────────

  private async sync(): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        this.readBuffer = [];
        await this.sendBytes(new Uint8Array([PX4_BL.GET_SYNC, PX4_BL.EOC]));
        await this.expectInsyncOk(1000);
        return;
      } catch { await this.delay(100); }
    }
    throw new Error("Failed to synchronize with PX4 bootloader. Ensure the board is in bootloader mode.");
  }

  private async getBoardId(): Promise<number> {
    await this.sendBytes(new Uint8Array([PX4_BL.GET_DEVICE, PX4_BL.EOC]));
    const idBytes = await this.waitForBytes(4);
    await this.expectInsyncOk();
    return (idBytes[0]) | (idBytes[1] << 8) | (idBytes[2] << 16) | (idBytes[3] << 24);
  }

  private async chipErase(): Promise<void> {
    await this.sendBytes(new Uint8Array([PX4_BL.CHIP_ERASE, PX4_BL.EOC]));
    await this.expectInsyncOk(PX4_BL.ERASE_TIMEOUT);
  }

  private async programFirmware(data: Uint8Array, onProgress: FlashProgressCallback): Promise<void> {
    const totalBytes = data.length;
    let writtenBytes = 0;
    for (let offset = 0; offset < totalBytes; offset += PX4_BL.PROG_MULTI_MAX) {
      this.checkAbort();
      const chunkSize = Math.min(PX4_BL.PROG_MULTI_MAX, totalBytes - offset);
      const chunk = data.slice(offset, offset + chunkSize);
      const packet = new Uint8Array(2 + chunkSize + 1);
      packet[0] = PX4_BL.PROG_MULTI;
      packet[1] = chunkSize;
      packet.set(chunk, 2);
      packet[packet.length - 1] = PX4_BL.EOC;
      await this.sendBytes(packet);
      await this.expectInsyncOk();
      writtenBytes += chunkSize;
      const percent = 25 + Math.round((writtenBytes / totalBytes) * 55);
      onProgress({
        phase: "flashing", percent,
        message: `Writing... ${writtenBytes}/${totalBytes} bytes`,
        bytesWritten: writtenBytes, bytesTotal: totalBytes,
        phasePercent: Math.round((writtenBytes / totalBytes) * 100),
      });
    }
  }

  private async verifyCrc(data: Uint8Array): Promise<void> {
    await this.sendBytes(new Uint8Array([PX4_BL.GET_CRC, PX4_BL.EOC]));
    const crcBytes = await this.waitForBytes(4);
    await this.expectInsyncOk();
    const remoteCrc = (crcBytes[0]) | (crcBytes[1] << 8) | (crcBytes[2] << 16) | (crcBytes[3] << 24);
    const localCrc = crc32(data);
    if ((remoteCrc >>> 0) !== (localCrc >>> 0)) {
      throw new Error(`CRC32 mismatch: local 0x${localCrc.toString(16).padStart(8, "0")}, remote 0x${(remoteCrc >>> 0).toString(16).padStart(8, "0")}`);
    }
  }

  private async reboot(): Promise<void> {
    try { await this.sendBytes(new Uint8Array([PX4_BL.REBOOT, PX4_BL.EOC])); } catch { /* Device resets */ }
  }

  // ── Low-level Helpers ──────────────────────────────────

  private async sendBytes(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial port not open");
    await this.writer.write(data);
  }

  private async waitForBytes(count: number, timeoutMs: number = PX4_BL.DEFAULT_TIMEOUT): Promise<number[]> {
    if (!this.reader) throw new Error("Serial port not open");
    const deadline = Date.now() + timeoutMs;
    while (this.readBuffer.length < count) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Serial read timeout: expected ${count} bytes, got ${this.readBuffer.length}`);
      const result = await Promise.race([
        this.reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), remaining)),
      ]);
      if (result.value) { for (const byte of result.value) this.readBuffer.push(byte); }
      if (result.done && !result.value) throw new Error("Serial read timeout");
    }
    return this.readBuffer.splice(0, count);
  }

  private async expectInsyncOk(timeoutMs: number = PX4_BL.DEFAULT_TIMEOUT): Promise<void> {
    const response = await this.waitForBytes(2, timeoutMs);
    if (response[0] !== PX4_BL.INSYNC) throw new Error(`PX4 bootloader: expected INSYNC (0x12), got 0x${response[0].toString(16)}`);
    if (response[1] === PX4_BL.FAILED) throw new Error("PX4 bootloader: operation FAILED");
    if (response[1] === PX4_BL.INVALID) throw new Error("PX4 bootloader: INVALID command");
    if (response[1] !== PX4_BL.OK) throw new Error(`PX4 bootloader: expected OK (0x10), got 0x${response[1].toString(16)}`);
  }

  private checkAbort(): void {
    if (this.aborted) throw new Error("Flash aborted by user");
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
