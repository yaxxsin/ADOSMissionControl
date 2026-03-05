/**
 * STM32 ROM bootloader protocol over UART via Web Serial API.
 *
 * Implements the ST AN3155 / AN2606 serial bootloader protocol.
 * Works with any STM32 FC connected via USB-UART bridge (the most
 * common flight controller connection method).
 *
 * Uses raw SerialPort directly (not WebSerialTransport) because
 * the bootloader requires different settings: 115200 baud, even
 * parity, 1 stop bit.
 *
 * Reference: betaflight-configurator/src/js/protocols/webstm32.js
 *
 * @module protocol/firmware/stm32-serial
 */

/// <reference path="../web-serial.d.ts" />

import type {
  FirmwareFlasher,
  FlashProgressCallback,
  ParsedFirmware,
  ChipInfo,
} from "./types";
import { CHIP_TABLE } from "./stm32-chip-table";

// ── Constants ──────────────────────────────────────────────

const ACK = 0x79;
const NACK = 0x1f;

// STM32 bootloader commands
const CMD_GET = 0x00;
const CMD_GET_ID = 0x02;
const CMD_READ_MEMORY = 0x11;
const CMD_GO = 0x21;
const CMD_WRITE_MEMORY = 0x31;
const CMD_ERASE = 0x43;
const CMD_EXTENDED_ERASE = 0x44;

/** Max bytes per WRITE_MEMORY command (STM32 bootloader limit). */
const WRITE_BLOCK_SIZE = 256;

/** Max bytes per READ_MEMORY command. */
const READ_BLOCK_SIZE = 256;

/** Default timeout for individual operations (ms). */
const DEFAULT_TIMEOUT = 3000;

/** Extended timeout for erase operations (ms). */
const ERASE_TIMEOUT = 30000;

// ── STM32SerialFlasher ─────────────────────────────────────

export class STM32SerialFlasher implements FirmwareFlasher {
  readonly method = "serial" as const;

  private port: SerialPort;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private aborted = false;
  private chipInfo: ChipInfo | null = null;
  private supportsExtendedErase = false;
  private readBuffer: number[] = [];

  constructor(port: SerialPort) {
    this.port = port;
  }

  /**
   * Open browser serial port picker.
   * Returns a raw SerialPort for bootloader use — separate from the MAVLink connection.
   */
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
      // Open port with bootloader settings
      onProgress({ phase: "bootloader_init", percent: 8, message: "Opening serial port..." });
      await this.openPort();

      // Init bootloader handshake
      onProgress({ phase: "bootloader_init", percent: 9, message: "Synchronizing with bootloader..." });
      await this.initBootloader();

      // Get bootloader info (supported commands)
      onProgress({ phase: "chip_detect", percent: 10, message: "Reading bootloader info..." });
      await this.getBootloaderInfo();

      // Identify chip
      const chipInfo = await this.getChipId();
      this.chipInfo = chipInfo;
      onProgress({ phase: "chip_detect", percent: 12, message: `Detected: ${chipInfo.name} (${(chipInfo.flashSize / 1024)}KB)` });

      this.checkAbort();

      // Erase
      onProgress({ phase: "erasing", percent: 15, message: "Erasing flash..." });
      await this.eraseFlash(firmware.blocks);
      onProgress({ phase: "erasing", percent: 25, message: "Erase complete" });

      this.checkAbort();

      // Write
      await this.writeFlash(firmware.blocks, onProgress);

      this.checkAbort();

      // Jump to app
      onProgress({ phase: "restarting", percent: 95, message: "Launching firmware..." });
      const startAddress = firmware.blocks[0]?.address ?? 0x08000000;
      await this.jumpToApp(startAddress);

      onProgress({ phase: "done", percent: 100, message: "Flash complete!" });
    } finally {
      await this.closePort();
    }
  }

  async verify(firmware: ParsedFirmware, onProgress: FlashProgressCallback, signal?: AbortSignal): Promise<void> {
    this.aborted = false;
    if (signal) signal.addEventListener("abort", () => this.abort(), { once: true });

    const totalBytes = firmware.totalBytes;
    let verifiedBytes = 0;

    try {
      // Port should already be open from flash(), but open if needed
      if (!this.reader || !this.writer) {
        await this.openPort();
        await this.initBootloader();
        await this.getBootloaderInfo();
        await this.getChipId();
      }

      for (const block of firmware.blocks) {
        let offset = 0;
        while (offset < block.data.length) {
          this.checkAbort();

          const chunkSize = Math.min(READ_BLOCK_SIZE, block.data.length - offset);
          const readData = await this.readFlash(block.address + offset, chunkSize);

          // Compare
          for (let i = 0; i < chunkSize; i++) {
            if (readData[i] !== block.data[offset + i]) {
              throw new Error(
                `Verification failed at address 0x${(block.address + offset + i).toString(16).toUpperCase()}: ` +
                `expected 0x${block.data[offset + i].toString(16).padStart(2, "0")}, ` +
                `got 0x${readData[i].toString(16).padStart(2, "0")}`
              );
            }
          }

          verifiedBytes += chunkSize;
          offset += chunkSize;
          const percent = 75 + Math.round((verifiedBytes / totalBytes) * 20);
          onProgress({
            phase: "verifying",
            percent,
            message: `Verifying... ${verifiedBytes}/${totalBytes} bytes`,
            bytesWritten: verifiedBytes,
            bytesTotal: totalBytes,
            phasePercent: Math.round((verifiedBytes / totalBytes) * 100),
          });
        }
      }
    } finally {
      await this.closePort();
    }
  }

  abort(): void {
    this.aborted = true;
  }

  async dispose(): Promise<void> {
    await this.closePort();
  }

  // ── Port Management ────────────────────────────────────

  private async openPort(): Promise<void> {
    await this.port.open({
      baudRate: 115200,
      parity: "even",
      stopBits: 1,
      dataBits: 8,
    });
    this.readBuffer = [];
    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }
  }

  private async closePort(): Promise<void> {
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer.releaseLock();
        this.writer = null;
      }
      await this.port.close().catch(() => {});
    } catch {
      // Ignore close errors
    }
  }

  // ── Bootloader Protocol ────────────────────────────────

  /** Send 0x7F synchronization byte and wait for ACK. */
  private async initBootloader(): Promise<void> {
    const SYNC = 0x7f;
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.sendBytes(new Uint8Array([SYNC]));
      try {
        const response = await this.waitForBytes(1, 1000);
        if (response[0] === ACK || response[0] === SYNC) {
          return; // Synchronized
        }
      } catch {
        // Timeout — retry
      }
    }
    throw new Error("Failed to synchronize with STM32 bootloader. Ensure board is in bootloader mode.");
  }

  /** GET command — reads supported commands and bootloader version. */
  private async getBootloaderInfo(): Promise<void> {
    await this.sendCommand(CMD_GET);
    const numBytes = (await this.waitForBytes(1))[0];
    const data = await this.waitForBytes(numBytes + 1); // version + commands
    await this.waitForAck();

    // Check if extended erase is supported
    this.supportsExtendedErase = data.includes(CMD_EXTENDED_ERASE);
  }

  /** GET_ID command — reads chip signature and looks up in chip table. */
  private async getChipId(): Promise<ChipInfo> {
    await this.sendCommand(CMD_GET_ID);
    const numBytes = (await this.waitForBytes(1))[0];
    const idBytes = await this.waitForBytes(numBytes + 1);
    await this.waitForAck();

    const signature = (idBytes[0] << 8) | idBytes[1];

    const info = CHIP_TABLE[signature];
    if (!info) {
      throw new Error(
        `Unknown STM32 chip signature: 0x${signature.toString(16).padStart(4, "0")}. ` +
        `This chip may not be supported.`
      );
    }

    return { signature, ...info };
  }

  /** Erase flash pages covered by firmware blocks. */
  private async eraseFlash(blocks: ParsedFirmware["blocks"]): Promise<void> {
    if (!this.chipInfo) throw new Error("Chip not identified");

    if (this.supportsExtendedErase || this.chipInfo.useExtendedErase) {
      // Extended Erase (0x44) — erase specific pages
      await this.sendCommand(CMD_EXTENDED_ERASE);

      // Calculate pages to erase
      const pages = new Set<number>();
      for (const block of blocks) {
        const startPage = Math.floor((block.address - this.chipInfo.flashBase) / this.chipInfo.pageSize);
        const endPage = Math.floor((block.address + block.data.length - 1 - this.chipInfo.flashBase) / this.chipInfo.pageSize);
        for (let p = startPage; p <= endPage; p++) {
          pages.add(p);
        }
      }

      const pageList = Array.from(pages).sort((a, b) => a - b);
      const numPages = pageList.length;

      // Format: [numPages-1 (2 bytes BE)] + [page numbers (2 bytes BE each)] + checksum
      const data = new Uint8Array(2 + numPages * 2);
      data[0] = ((numPages - 1) >> 8) & 0xff;
      data[1] = (numPages - 1) & 0xff;
      for (let i = 0; i < numPages; i++) {
        data[2 + i * 2] = (pageList[i] >> 8) & 0xff;
        data[2 + i * 2 + 1] = pageList[i] & 0xff;
      }

      // XOR checksum over the entire data block
      let checksum = 0;
      for (const b of data) checksum ^= b;
      const payload = new Uint8Array(data.length + 1);
      payload.set(data);
      payload[data.length] = checksum;

      await this.sendBytes(payload);
      await this.waitForAck(ERASE_TIMEOUT);
    } else {
      // Basic Erase (0x43) — erase specific pages
      await this.sendCommand(CMD_ERASE);

      const pages = new Set<number>();
      for (const block of blocks) {
        const startPage = Math.floor((block.address - this.chipInfo.flashBase) / this.chipInfo.pageSize);
        const endPage = Math.floor((block.address + block.data.length - 1 - this.chipInfo.flashBase) / this.chipInfo.pageSize);
        for (let p = startPage; p <= endPage; p++) {
          pages.add(p);
        }
      }

      const pageList = Array.from(pages).sort((a, b) => a - b);
      const numPages = pageList.length;

      // Format: [numPages-1] + [page numbers (1 byte each)] + checksum
      const data = new Uint8Array(1 + numPages);
      data[0] = numPages - 1;
      for (let i = 0; i < numPages; i++) {
        data[1 + i] = pageList[i] & 0xff;
      }

      let checksum = 0;
      for (const b of data) checksum ^= b;
      const payload = new Uint8Array(data.length + 1);
      payload.set(data);
      payload[data.length] = checksum;

      await this.sendBytes(payload);
      await this.waitForAck(ERASE_TIMEOUT);
    }
  }

  /** Write firmware blocks to flash. */
  private async writeFlash(blocks: ParsedFirmware["blocks"], onProgress: FlashProgressCallback): Promise<void> {
    const totalBytes = blocks.reduce((sum, b) => sum + b.data.length, 0);
    let writtenBytes = 0;

    for (const block of blocks) {
      let offset = 0;
      while (offset < block.data.length) {
        this.checkAbort();

        const chunkSize = Math.min(WRITE_BLOCK_SIZE, block.data.length - offset);
        const address = block.address + offset;
        const chunk = block.data.slice(offset, offset + chunkSize);

        await this.writeMemory(address, chunk);

        writtenBytes += chunkSize;
        offset += chunkSize;
        const percent = 25 + Math.round((writtenBytes / totalBytes) * 50);
        onProgress({
          phase: "flashing",
          percent,
          message: `Writing... ${writtenBytes}/${totalBytes} bytes`,
          bytesWritten: writtenBytes,
          bytesTotal: totalBytes,
          phasePercent: Math.round((writtenBytes / totalBytes) * 100),
        });
      }
    }
  }

  /** WRITE_MEMORY command — write up to 256 bytes at an address. */
  private async writeMemory(address: number, data: Uint8Array): Promise<void> {
    await this.sendCommand(CMD_WRITE_MEMORY);
    await this.sendAddress(address);

    // Pad data to be N+1 format: [byteCount, data..., checksum]
    const padded = new Uint8Array(data.length + (data.length % 2 === 0 ? 0 : 1));
    padded.set(data);

    const payload = new Uint8Array(1 + padded.length + 1);
    payload[0] = padded.length - 1; // N = number of bytes - 1

    payload.set(padded, 1);

    // XOR checksum over N + data bytes
    let checksum = payload[0];
    for (let i = 0; i < padded.length; i++) {
      checksum ^= padded[i];
    }
    payload[payload.length - 1] = checksum;

    await this.sendBytes(payload);
    await this.waitForAck();
  }

  /** READ_MEMORY command — read up to 256 bytes from an address. */
  private async readFlash(address: number, length: number): Promise<Uint8Array> {
    await this.sendCommand(CMD_READ_MEMORY);
    await this.sendAddress(address);

    // Send byte count: [N-1, checksum]
    const n = length - 1;
    await this.sendBytes(new Uint8Array([n, ~n & 0xff]));
    await this.waitForAck();

    return new Uint8Array(await this.waitForBytes(length));
  }

  /** GO command — jump to address and start executing. */
  private async jumpToApp(address: number): Promise<void> {
    try {
      await this.sendCommand(CMD_GO);
      await this.sendAddress(address);
      // Device may reset immediately — don't wait for further response
    } catch {
      // Expected — device resets after GO command
    }
  }

  // ── Low-level Helpers ──────────────────────────────────

  /** Send raw bytes to the serial port. */
  private async sendBytes(data: Uint8Array): Promise<void> {
    if (!this.writer) throw new Error("Serial port not open");
    await this.writer.write(data);
  }

  /** Read exact number of bytes from serial with timeout. */
  private async waitForBytes(count: number, timeoutMs = DEFAULT_TIMEOUT): Promise<number[]> {
    if (!this.reader) throw new Error("Serial port not open");

    const deadline = Date.now() + timeoutMs;

    while (this.readBuffer.length < count) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error(`Serial read timeout: expected ${count} bytes, got ${this.readBuffer.length}`);
      }

      const result = await Promise.race([
        this.reader.read(),
        new Promise<{ value: undefined; done: true }>((resolve) =>
          setTimeout(() => resolve({ value: undefined, done: true }), remaining)
        ),
      ]);

      if (result.value) {
        for (const byte of result.value) {
          this.readBuffer.push(byte);
        }
      }
      if (result.done && !result.value) {
        throw new Error("Serial read timeout");
      }
    }

    return this.readBuffer.splice(0, count);
  }

  /** Wait for a single ACK byte. */
  private async waitForAck(timeoutMs = DEFAULT_TIMEOUT): Promise<void> {
    const response = await this.waitForBytes(1, timeoutMs);
    if (response[0] === NACK) {
      throw new Error("NACK received from bootloader");
    }
    if (response[0] !== ACK) {
      throw new Error(`Unexpected response from bootloader: 0x${response[0].toString(16)}`);
    }
  }

  /** Send a bootloader command: [cmd, ~cmd] + wait for ACK. */
  private async sendCommand(cmd: number): Promise<void> {
    await this.sendBytes(new Uint8Array([cmd, ~cmd & 0xff]));
    await this.waitForAck();
  }

  /** Send a 4-byte big-endian address + XOR checksum, wait for ACK. */
  private async sendAddress(address: number): Promise<void> {
    const bytes = new Uint8Array([
      (address >> 24) & 0xff,
      (address >> 16) & 0xff,
      (address >> 8) & 0xff,
      address & 0xff,
    ]);
    const checksum = bytes[0] ^ bytes[1] ^ bytes[2] ^ bytes[3];
    await this.sendBytes(new Uint8Array([...bytes, checksum]));
    await this.waitForAck();
  }

  /** Check if abort was requested. */
  private checkAbort(): void {
    if (this.aborted) {
      throw new Error("Flash aborted by user");
    }
  }
}
