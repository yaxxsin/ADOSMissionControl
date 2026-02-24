/**
 * MAVLink v2 protocol adapter for Altnautica Command GCS.
 *
 * Central class that implements the `DroneProtocol` interface, tying together
 * the parser, encoder, message decoders, command queue, and firmware handler.
 * Connects to a flight controller via any Transport, parses incoming MAVLink
 * frames, dispatches telemetry to subscribers, and exposes a high-level
 * command API (arm, disarm, mode, mission, params, calibration, etc.).
 *
 * @module protocol/mavlink-adapter
 */

import type {
  DroneProtocol, Transport, VehicleInfo, CommandResult, ParameterValue,
  MissionItem, FirmwareHandler, ProtocolCapabilities, UnifiedFlightMode,
  AttitudeCallback, PositionCallback, BatteryCallback, GpsCallback,
  VfrCallback, RcCallback, StatusTextCallback, HeartbeatCallback,
  ParameterCallback, SerialDataCallback,
  SysStatusCallback, RadioCallback, MissionProgressCallback,
  EkfCallback, VibrationCallback, ServoOutputCallback,
  WindCallback, TerrainCallback,
  MagCalProgressCallback, MagCalReportCallback,
} from './types'
import { MAVLinkParser, type MAVLinkFrame } from './mavlink-parser'
import {
  encodeHeartbeat, encodeManualControl,
  encodeSetMode, encodeParamRequestList, encodeParamRequestRead, encodeParamSet,
  encodeMissionCount, encodeMissionItemInt, encodeSerialControl,
  encodeMissionRequestList, encodeMissionRequestInt, encodeMissionAck, encodeMissionClearAll,
} from './mavlink-encoder'
import {
  decodeHeartbeat, decodeAttitude, decodeGlobalPositionInt,
  decodeBatteryStatus, decodeGpsRawInt, decodeVfrHud,
  decodeRcChannels, decodeCommandAck, decodeParamValue,
  decodeStatustext, decodeMissionAck, decodeMissionRequestInt,
  decodeSerialControl, decodeSysStatus, decodeRadioStatus,
  decodeMissionCount, decodeMissionItemInt as decodeMissionItemIntMsg,
  decodeMissionCurrent, decodeMissionItemReached,
  decodeEkfStatusReport, decodeVibration, decodeServoOutputRaw,
  decodeWind, decodeTerrainReport,
  decodeMagCalProgress, decodeMagCalReport,
} from './mavlink-messages'
import { CommandQueue } from './command-queue'
import { createFirmwareHandler } from './firmware-ardupilot'

export class MAVLinkAdapter implements DroneProtocol {
  readonly protocolName = 'mavlink'

  private parser = new MAVLinkParser()
  private commandQueue = new CommandQueue(3000)
  private transport: Transport | null = null
  private firmwareHandler: FirmwareHandler | null = null
  private vehicleInfo: VehicleInfo | null = null

  private targetSysId = 1
  private targetCompId = 1
  private sysId = 255      // GCS system ID
  private compId = 190      // GCS component ID (MAV_COMP_ID_MISSIONPLANNER)

  private _connected = false
  private _disconnected = false
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private dataHandler: ((data: Uint8Array) => void) | null = null
  private closeHandler: (() => void) | null = null

  // Callback subscriber arrays
  private attitudeCallbacks: AttitudeCallback[] = []
  private positionCallbacks: PositionCallback[] = []
  private batteryCallbacks: BatteryCallback[] = []
  private gpsCallbacks: GpsCallback[] = []
  private vfrCallbacks: VfrCallback[] = []
  private rcCallbacks: RcCallback[] = []
  private statusTextCallbacks: StatusTextCallback[] = []
  private heartbeatCallbacks: HeartbeatCallback[] = []
  private parameterCallbacks: ParameterCallback[] = []
  private serialDataCallbacks: SerialDataCallback[] = []
  private sysStatusCallbacks: SysStatusCallback[] = []
  private radioCallbacks: RadioCallback[] = []
  private missionProgressCallbacks: MissionProgressCallback[] = []
  private ekfCallbacks: EkfCallback[] = []
  private vibrationCallbacks: VibrationCallback[] = []
  private servoOutputCallbacks: ServoOutputCallback[] = []
  private windCallbacks: WindCallback[] = []
  private terrainCallbacks: TerrainCallback[] = []
  private magCalProgressCallbacks: MagCalProgressCallback[] = []
  private magCalReportCallbacks: MagCalReportCallback[] = []

  // Parameter download state
  private parameterDownload: {
    params: Map<number, ParameterValue>
    total: number
    resolve: (params: ParameterValue[]) => void
    reject: (err: Error) => void
    hardTimer: ReturnType<typeof setTimeout>
    inactivityTimer: ReturnType<typeof setTimeout> | null
    retryCount: number
    resetInactivityTimer: () => void
  } | null = null

  // Mission upload state
  private missionUpload: {
    items: MissionItem[]
    resolve: (result: CommandResult) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  // Mission download state
  private missionDownload: {
    items: Map<number, MissionItem>
    total: number
    resolve: (items: MissionItem[]) => void
    reject: (err: Error) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  get isConnected(): boolean { return this._connected }

  // ── Connection ─────────────────────────────────────────

  async connect(transport: Transport): Promise<VehicleInfo> {
    this.transport = transport
    this._disconnected = false

    // Subscribe to transport data → feed to parser
    this.dataHandler = (data: Uint8Array) => this.parser.feed(data)
    this.closeHandler = () => this.handleDisconnect()
    transport.on('data', this.dataHandler)
    transport.on('close', this.closeHandler as (data: void) => void)

    // Subscribe to parsed frames (permanent handler)
    this.parser.onFrame((frame) => this.handleFrame(frame))

    // Wait for first HEARTBEAT with a 10-second timeout
    const vehicleInfo = await new Promise<VehicleInfo>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('No heartbeat received within 10 seconds')), 10000)

      // Temporary heartbeat listener — resolves once and unsubs
      const unsub = this.parser.onFrame((frame) => {
        if (frame.msgId === 0) { // HEARTBEAT
          const hb = decodeHeartbeat(frame.payload)
          if (hb.type === 6) return // Ignore GCS heartbeats

          clearTimeout(timeout)
          unsub()

          this.targetSysId = frame.systemId
          this.targetCompId = frame.componentId
          this.firmwareHandler = createFirmwareHandler(hb.autopilot, hb.type)

          const info: VehicleInfo = {
            firmwareType: this.firmwareHandler.firmwareType,
            vehicleClass: this.firmwareHandler.vehicleClass,
            firmwareVersionString: this.firmwareHandler.getFirmwareVersion(),
            systemId: frame.systemId,
            componentId: frame.componentId,
            autopilotType: hb.autopilot,
            vehicleType: hb.type,
          }
          this.vehicleInfo = info
          resolve(info)
        }
      })
    })

    this._connected = true

    // Start GCS heartbeat at 1 Hz
    this.heartbeatInterval = setInterval(() => {
      if (this.transport?.isConnected) {
        this.transport.send(encodeHeartbeat(this.sysId, this.compId))
      }
    }, 1000)
    // Send first heartbeat immediately
    this.transport.send(encodeHeartbeat(this.sysId, this.compId))

    return vehicleInfo
  }

  async disconnect(): Promise<void> {
    this.handleDisconnect()
    if (this.transport?.isConnected) {
      await this.transport.disconnect()
    }
  }

  private handleDisconnect(): void {
    if (this._disconnected) return
    this._disconnected = true
    this._connected = false
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
    this.commandQueue.clear()
    this.parser.reset()
    if (this.transport && this.dataHandler) {
      this.transport.off('data', this.dataHandler)
      this.transport.off('close', this.closeHandler as (data: void) => void)
    }
    this.transport = null
  }

  // ── Frame Routing ──────────────────────────────────────

  private handleFrame(frame: MAVLinkFrame): void {
    switch (frame.msgId) {
      case 0:   this.handleHeartbeat(frame); break
      case 1:   this.handleSysStatus(frame); break
      case 30:  this.handleAttitude(frame); break
      case 33:  this.handleGlobalPosition(frame); break
      case 42:  this.handleMissionCurrent(frame); break
      case 44:  this.handleMissionCountResponse(frame); break
      case 46:  this.handleMissionItemReached(frame); break
      case 73:  this.handleMissionItemIntResponse(frame); break
      case 147: this.handleBattery(frame); break
      case 24:  this.handleGpsRaw(frame); break
      case 74:  this.handleVfrHud(frame); break
      case 65:  this.handleRcChannels(frame); break
      case 77:  this.handleCommandAck(frame); break
      case 22:  this.handleParamValue(frame); break
      case 109: this.handleRadioStatus(frame); break
      case 253: this.handleStatusText(frame); break
      case 47:  this.handleMissionAck(frame); break
      case 51:  this.handleMissionRequest(frame); break
      case 126: this.handleSerialControl(frame); break
      case 191: this.handleMagCalProgress(frame); break
      case 192: this.handleMagCalReport(frame); break
      case 36:  this.handleServoOutput(frame); break
      case 136: this.handleTerrainReport(frame); break
      case 168: this.handleWind(frame); break
      case 241: this.handleVibration(frame); break
      case 335: this.handleEkfStatus(frame); break
    }
  }

  // ── Message Handlers ───────────────────────────────────

  private handleHeartbeat(frame: MAVLinkFrame): void {
    const hb = decodeHeartbeat(frame.payload)
    if (hb.type === 6) return // Ignore GCS heartbeats

    const armed = (hb.baseMode & 0x80) !== 0 // MAV_MODE_FLAG_SAFETY_ARMED
    const mode = this.firmwareHandler?.decodeFlightMode(hb.customMode) ?? 'UNKNOWN'

    for (const cb of this.heartbeatCallbacks) {
      cb({
        armed,
        mode,
        systemStatus: hb.systemStatus,
        vehicleInfo: this.vehicleInfo!,
      })
    }
  }

  private handleAttitude(frame: MAVLinkFrame): void {
    const data = decodeAttitude(frame.payload)
    const RAD_TO_DEG = 180 / Math.PI
    for (const cb of this.attitudeCallbacks) {
      cb({
        timestamp: Date.now(),
        roll: data.roll * RAD_TO_DEG,
        pitch: data.pitch * RAD_TO_DEG,
        yaw: data.yaw * RAD_TO_DEG,
        rollSpeed: data.rollspeed,
        pitchSpeed: data.pitchspeed,
        yawSpeed: data.yawspeed,
      })
    }
  }

  private handleGlobalPosition(frame: MAVLinkFrame): void {
    const data = decodeGlobalPositionInt(frame.payload)
    for (const cb of this.positionCallbacks) {
      cb({
        timestamp: Date.now(),
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000,           // mm → m
        relativeAlt: data.relativeAlt / 1000,
        heading: data.hdg / 100,         // cdeg → deg
        groundSpeed: Math.sqrt(data.vx * data.vx + data.vy * data.vy) / 100, // cm/s → m/s
        airSpeed: 0, // Not in this message — comes from VFR_HUD
        climbRate: -data.vz / 100,       // cm/s → m/s (NED, so negate)
      })
    }
  }

  private handleBattery(frame: MAVLinkFrame): void {
    const data = decodeBatteryStatus(frame.payload)
    // Sum valid cell voltages (0xFFFF = cell not used)
    const totalVoltage = data.voltages
      .filter(v => v !== 0xFFFF)
      .reduce((sum, v) => sum + v, 0) / 1000 // mV → V

    for (const cb of this.batteryCallbacks) {
      cb({
        timestamp: Date.now(),
        voltage: totalVoltage,
        current: data.currentBattery / 100,      // cA → A
        remaining: data.batteryRemaining,          // already %
        consumed: data.currentConsumed,            // mAh
      })
    }
  }

  private handleGpsRaw(frame: MAVLinkFrame): void {
    const data = decodeGpsRawInt(frame.payload)
    for (const cb of this.gpsCallbacks) {
      cb({
        timestamp: Date.now(),
        fixType: data.fixType,
        satellites: data.satellitesVisible,
        hdop: data.eph / 100,        // cm → m
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000,        // mm → m
      })
    }
  }

  private handleVfrHud(frame: MAVLinkFrame): void {
    const data = decodeVfrHud(frame.payload)
    for (const cb of this.vfrCallbacks) {
      cb({
        timestamp: Date.now(),
        airspeed: data.airspeed,
        groundspeed: data.groundspeed,
        heading: data.heading,
        throttle: data.throttle,
        alt: data.alt,
        climb: data.climb,
      })
    }
  }

  private handleRcChannels(frame: MAVLinkFrame): void {
    const data = decodeRcChannels(frame.payload)
    for (const cb of this.rcCallbacks) {
      cb({
        timestamp: Date.now(),
        channels: data.channels.slice(0, data.chancount),
        rssi: data.rssi,
      })
    }
  }

  private handleCommandAck(frame: MAVLinkFrame): void {
    const ack = decodeCommandAck(frame.payload)
    console.debug(`[MAVLink] COMMAND_ACK: cmd=${ack.command} result=${ack.result}`)
    this.commandQueue.handleAck(ack.command, ack.result)
  }

  private handleParamValue(frame: MAVLinkFrame): void {
    const pv = decodeParamValue(frame.payload)
    const param: ParameterValue = {
      name: pv.paramId,
      value: pv.paramValue,
      type: pv.paramType,
      index: pv.paramIndex,
      count: pv.paramCount,
    }

    // Notify subscribers
    for (const cb of this.parameterCallbacks) cb(param)

    // If downloading all params, accumulate
    if (this.parameterDownload) {
      this.parameterDownload.total = pv.paramCount
      this.parameterDownload.params.set(pv.paramIndex, param)

      // Check if complete
      if (this.parameterDownload.params.size >= pv.paramCount) {
        this.finishParamDownload()
        return
      }

      // Reset inactivity timer on each new param
      this.parameterDownload.resetInactivityTimer()
    }
  }

  private handleStatusText(frame: MAVLinkFrame): void {
    const st = decodeStatustext(frame.payload)
    for (const cb of this.statusTextCallbacks) cb(st)
  }

  private handleMissionAck(frame: MAVLinkFrame): void {
    const ack = decodeMissionAck(frame.payload)
    if (this.missionUpload) {
      clearTimeout(this.missionUpload.timer)
      this.missionUpload.resolve({
        success: ack.type === 0, // MAV_MISSION_ACCEPTED
        resultCode: ack.type,
        message: ack.type === 0 ? 'Mission accepted' : `Mission rejected: type ${ack.type}`,
      })
      this.missionUpload = null
    }
  }

  private handleMissionRequest(frame: MAVLinkFrame): void {
    const req = decodeMissionRequestInt(frame.payload)
    if (this.missionUpload && req.seq < this.missionUpload.items.length) {
      const item = this.missionUpload.items[req.seq]
      const encoded = encodeMissionItemInt(
        this.targetSysId, this.targetCompId,
        item.seq, item.frame, item.command, item.current, item.autocontinue,
        item.param1, item.param2, item.param3, item.param4,
        item.x, item.y, item.z,
        this.sysId, this.compId,
      )
      this.transport?.send(encoded)
    }
  }

  private handleSerialControl(frame: MAVLinkFrame): void {
    const sc = decodeSerialControl(frame.payload)
    for (const cb of this.serialDataCallbacks) {
      cb({ device: sc.device, data: sc.data })
    }
  }

  private handleSysStatus(frame: MAVLinkFrame): void {
    const data = decodeSysStatus(frame.payload)
    for (const cb of this.sysStatusCallbacks) {
      cb({
        timestamp: Date.now(),
        cpuLoad: data.load,
        sensorsPresent: data.onboardControlSensorsPresent,
        sensorsEnabled: data.onboardControlSensorsEnabled,
        sensorsHealthy: data.onboardControlSensorsHealth,
        voltageMv: data.voltageBattery,
        currentCa: data.currentBattery,
        batteryRemaining: data.batteryRemaining,
        dropRateComm: data.dropRateComm,
        errorsComm: data.errorsComm,
      })
    }
  }

  private handleRadioStatus(frame: MAVLinkFrame): void {
    const data = decodeRadioStatus(frame.payload)
    for (const cb of this.radioCallbacks) {
      cb({
        timestamp: Date.now(),
        rssi: data.rssi,
        remrssi: data.remrssi,
        txbuf: data.txbuf,
        noise: data.noise,
        remnoise: data.remnoise,
        rxerrors: data.rxerrors,
        fixed: data.fixed,
      })
    }
  }

  private handleMissionCurrent(frame: MAVLinkFrame): void {
    const data = decodeMissionCurrent(frame.payload)
    for (const cb of this.missionProgressCallbacks) {
      cb({ currentSeq: data.seq })
    }
  }

  private handleMissionItemReached(frame: MAVLinkFrame): void {
    const data = decodeMissionItemReached(frame.payload)
    for (const cb of this.missionProgressCallbacks) {
      cb({ currentSeq: data.seq, reachedSeq: data.seq })
    }
  }

  private handleMissionCountResponse(frame: MAVLinkFrame): void {
    if (!this.missionDownload) return
    const data = decodeMissionCount(frame.payload)
    this.missionDownload.total = data.count
    if (data.count === 0) {
      clearTimeout(this.missionDownload.timer)
      this.missionDownload.resolve([])
      this.missionDownload = null
      return
    }
    // Request first item
    this.transport?.send(encodeMissionRequestInt(
      this.targetSysId, this.targetCompId, 0,
      this.sysId, this.compId,
    ))
  }

  private handleMissionItemIntResponse(frame: MAVLinkFrame): void {
    if (!this.missionDownload) return
    const data = decodeMissionItemIntMsg(frame.payload)
    const item: MissionItem = {
      seq: data.seq,
      frame: data.frame,
      command: data.command,
      current: data.current,
      autocontinue: data.autocontinue,
      param1: data.param1,
      param2: data.param2,
      param3: data.param3,
      param4: data.param4,
      x: data.x,
      y: data.y,
      z: data.z,
    }
    this.missionDownload.items.set(data.seq, item)

    if (this.missionDownload.items.size >= this.missionDownload.total) {
      // All items received
      clearTimeout(this.missionDownload.timer)
      const items = Array.from(this.missionDownload.items.values()).sort((a, b) => a.seq - b.seq)
      // Send ACK
      this.transport?.send(encodeMissionAck(
        this.targetSysId, this.targetCompId, 0,
        this.sysId, this.compId,
      ))
      this.missionDownload.resolve(items)
      this.missionDownload = null
    } else {
      // Request next item
      const nextSeq = data.seq + 1
      this.transport?.send(encodeMissionRequestInt(
        this.targetSysId, this.targetCompId, nextSeq,
        this.sysId, this.compId,
      ))
    }
  }

  private handleEkfStatus(frame: MAVLinkFrame): void {
    const data = decodeEkfStatusReport(frame.payload)
    for (const cb of this.ekfCallbacks) {
      cb({
        timestamp: Date.now(),
        velocityVariance: data.velocityVariance,
        posHorizVariance: data.posHorizVariance,
        posVertVariance: data.posVertVariance,
        compassVariance: data.compassVariance,
        terrainAltVariance: data.terrainAltVariance,
        flags: data.flags,
      })
    }
  }

  private handleVibration(frame: MAVLinkFrame): void {
    const data = decodeVibration(frame.payload)
    for (const cb of this.vibrationCallbacks) {
      cb({
        timestamp: Date.now(),
        vibrationX: data.vibrationX,
        vibrationY: data.vibrationY,
        vibrationZ: data.vibrationZ,
        clipping0: data.clipping0,
        clipping1: data.clipping1,
        clipping2: data.clipping2,
      })
    }
  }

  private handleServoOutput(frame: MAVLinkFrame): void {
    const data = decodeServoOutputRaw(frame.payload)
    for (const cb of this.servoOutputCallbacks) {
      cb({
        timestamp: Date.now(),
        port: data.port,
        servos: [data.servo1, data.servo2, data.servo3, data.servo4,
                 data.servo5, data.servo6, data.servo7, data.servo8],
      })
    }
  }

  private handleWind(frame: MAVLinkFrame): void {
    const data = decodeWind(frame.payload)
    for (const cb of this.windCallbacks) {
      cb({
        timestamp: Date.now(),
        direction: data.direction,
        speed: data.speed,
        speedZ: data.speedZ,
      })
    }
  }

  private handleTerrainReport(frame: MAVLinkFrame): void {
    const data = decodeTerrainReport(frame.payload)
    for (const cb of this.terrainCallbacks) {
      cb({
        timestamp: Date.now(),
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        terrainHeight: data.terrainHeight,
        currentHeight: data.currentHeight,
        spacing: data.spacing,
        pending: data.pending,
        loaded: data.loaded,
      })
    }
  }

  private handleMagCalProgress(frame: MAVLinkFrame): void {
    const data = decodeMagCalProgress(frame.payload)
    for (const cb of this.magCalProgressCallbacks) {
      cb({ compassId: data.compassId, completionPct: data.completionPct, calStatus: data.calStatus })
    }
  }

  private handleMagCalReport(frame: MAVLinkFrame): void {
    const data = decodeMagCalReport(frame.payload)
    for (const cb of this.magCalReportCallbacks) {
      cb({ compassId: data.compassId, calStatus: data.calStatus, autosaved: data.autosaved })
    }
  }

  // ── Commands ───────────────────────────────────────────

  async arm(): Promise<CommandResult> {
    return this.sendCommandLong(400, [1, 0, 0, 0, 0, 0, 0]) // MAV_CMD_COMPONENT_ARM_DISARM
  }

  async disarm(): Promise<CommandResult> {
    return this.sendCommandLong(400, [0, 0, 0, 0, 0, 0, 0])
  }

  async setFlightMode(mode: UnifiedFlightMode): Promise<CommandResult> {
    if (!this.firmwareHandler) {
      return { success: false, resultCode: -1, message: 'No firmware handler' }
    }
    const { baseMode, customMode } = this.firmwareHandler.encodeFlightMode(mode)
    const frame = encodeSetMode(this.targetSysId, baseMode, customMode, this.sysId, this.compId)
    this.transport?.send(frame)
    // SET_MODE doesn't get a COMMAND_ACK — confirm via next HEARTBEAT
    return { success: true, resultCode: 0, message: 'Mode change sent' }
  }

  async returnToLaunch(): Promise<CommandResult> {
    return this.sendCommandLong(20, [0, 0, 0, 0, 0, 0, 0]) // MAV_CMD_NAV_RETURN_TO_LAUNCH
  }

  async land(): Promise<CommandResult> {
    return this.sendCommandLong(21, [0, 0, 0, 0, 0, 0, 0]) // MAV_CMD_NAV_LAND
  }

  async takeoff(altitude: number): Promise<CommandResult> {
    return this.sendCommandLong(22, [0, 0, 0, 0, 0, 0, altitude]) // MAV_CMD_NAV_TAKEOFF
  }

  sendManualControl(roll: number, pitch: number, throttle: number, yaw: number, buttons: number): void {
    if (!this.transport?.isConnected) return
    // Convert -1..1 to -1000..1000 for axes, 0..1 to 0..1000 for throttle
    const x = Math.round(pitch * 1000)
    const y = Math.round(roll * 1000)
    const z = Math.round(throttle * 1000)
    const r = Math.round(yaw * 1000)
    this.transport.send(encodeManualControl(this.targetSysId, x, y, z, r, buttons, this.sysId, this.compId))
  }

  // ── Parameters ─────────────────────────────────────────

  private finishParamDownload(): void {
    if (!this.parameterDownload) return
    const dl = this.parameterDownload
    clearTimeout(dl.hardTimer)
    if (dl.inactivityTimer) clearTimeout(dl.inactivityTimer)
    const params = Array.from(dl.params.values()).sort((a, b) => a.index - b.index)
    dl.resolve(params)
    this.parameterDownload = null
  }

  private retryMissingParams(): void {
    if (!this.parameterDownload || !this.transport?.isConnected) return
    const dl = this.parameterDownload

    if (dl.total <= 0) {
      // Don't know total yet — just restart inactivity timer
      dl.resetInactivityTimer()
      return
    }

    // Find missing indices
    const missing: number[] = []
    for (let i = 0; i < dl.total; i++) {
      if (!dl.params.has(i)) missing.push(i)
    }

    if (missing.length === 0) {
      this.finishParamDownload()
      return
    }

    dl.retryCount++
    if (dl.retryCount > 3) {
      // Max retries reached — resolve with what we have
      this.finishParamDownload()
      return
    }

    // Request up to 50 missing params per retry round
    const batch = missing.slice(0, 50)
    for (const idx of batch) {
      this.transport!.send(
        encodeParamRequestRead(
          this.targetSysId, this.targetCompId,
          '', idx,
          this.sysId, this.compId,
        )
      )
    }

    // Reset inactivity timer to wait for responses
    dl.resetInactivityTimer()
  }

  async getAllParameters(): Promise<ParameterValue[]> {
    if (!this.transport?.isConnected) throw new Error('Not connected')

    return new Promise<ParameterValue[]>((resolve) => {
      // Hard ceiling: 120 seconds — resolve with whatever we have
      const hardTimer = setTimeout(() => {
        if (this.parameterDownload) {
          this.finishParamDownload()
        }
      }, 120000)

      const createInactivityTimer = (): ReturnType<typeof setTimeout> => {
        return setTimeout(() => {
          this.retryMissingParams()
        }, 5000)
      }

      const resetInactivityTimer = () => {
        if (this.parameterDownload?.inactivityTimer) {
          clearTimeout(this.parameterDownload.inactivityTimer)
        }
        if (this.parameterDownload) {
          this.parameterDownload.inactivityTimer = createInactivityTimer()
        }
      }

      this.parameterDownload = {
        params: new Map(),
        total: 0,
        resolve,
        reject: () => resolve([]), // Never reject — always resolve
        hardTimer,
        inactivityTimer: createInactivityTimer(),
        retryCount: 0,
        resetInactivityTimer,
      }

      this.transport!.send(encodeParamRequestList(this.targetSysId, this.targetCompId, this.sysId, this.compId))
    })
  }

  async getParameter(_name: string): Promise<ParameterValue> {
    // TODO: Implement PARAM_REQUEST_READ for single parameter fetch
    throw new Error('getParameter not yet implemented — use getAllParameters')
  }

  async setParameter(name: string, value: number, type = 9): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, resultCode: -1, message: `Param set timed out: ${name}` })
      }, 3000)

      // Listen for PARAM_VALUE echo as confirmation
      const unsub = this.onParameter((param) => {
        if (param.name === name) {
          clearTimeout(timer)
          unsub()
          resolve({
            success: Math.abs(param.value - value) < 0.001,
            resultCode: 0,
            message: `Parameter ${name} = ${param.value}`,
          })
        }
      })

      this.transport!.send(encodeParamSet(this.targetSysId, this.targetCompId, name, value, type, this.sysId, this.compId))
    })
  }

  // ── Mission ────────────────────────────────────────────

  async uploadMission(items: MissionItem[]): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    return new Promise<CommandResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.missionUpload = null
        resolve({ success: false, resultCode: -1, message: 'Mission upload timed out' })
      }, 15000)

      this.missionUpload = { items, resolve, reject, timer }

      // Send MISSION_COUNT to initiate upload handshake
      this.transport!.send(encodeMissionCount(this.targetSysId, this.targetCompId, items.length, this.sysId, this.compId))
    })
  }

  async downloadMission(): Promise<MissionItem[]> {
    if (!this.transport?.isConnected) throw new Error('Not connected')

    return new Promise<MissionItem[]>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.missionDownload) {
          // Resolve with whatever we have
          const items = Array.from(this.missionDownload.items.values()).sort((a, b) => a.seq - b.seq)
          this.missionDownload = null
          resolve(items)
        }
      }, 15000)

      this.missionDownload = {
        items: new Map(),
        total: 0,
        resolve,
        reject,
        timer,
      }

      this.transport!.send(encodeMissionRequestList(
        this.targetSysId, this.targetCompId,
        this.sysId, this.compId,
      ))
    })
  }

  async setCurrentMissionItem(seq: number): Promise<CommandResult> {
    return this.sendCommandLong(224, [seq, 0, 0, 0, 0, 0, 0]) // MAV_CMD_DO_SET_MISSION_CURRENT
  }

  // ── Calibration ────────────────────────────────────────

  async startCalibration(type: 'accel' | 'gyro' | 'compass' | 'level' | 'airspeed'): Promise<CommandResult> {
    if (type === 'compass') {
      // ArduPilot uses MAV_CMD_DO_START_MAG_CAL (42424), not PREFLIGHT_CALIBRATION
      // param1=0 (all compasses), param2=0 (no auto-retry), param3=1 (autosave)
      return this.sendCommandLong(42424, [0, 0, 1, 0, 0, 0, 0], 30000)
    }

    // MAV_CMD_PREFLIGHT_CALIBRATION = 241
    const params: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
    switch (type) {
      case 'gyro':     params[0] = 1; break                // param1=1: gyro cal
      case 'accel':    params[4] = 1; break                // param5=1: accel cal
      case 'level':    params[4] = 2; break                // param5=2: level cal
      case 'airspeed': params[2] = 1; break                // param3=1: baro + airspeed cal
    }
    return this.sendCommandLong(241, params, 30000)        // 30s timeout for calibration
  }

  // ── Motor Test ─────────────────────────────────────────

  async motorTest(motor: number, throttle: number, duration: number): Promise<CommandResult> {
    return this.sendCommandLong(209, [motor, 0, throttle, duration, 0, 0, 0]) // MAV_CMD_DO_MOTOR_TEST
  }

  // ── Reboot ─────────────────────────────────────────────

  async rebootToBootloader(): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    // Fire-and-forget: FC reboots before it can ACK
    this.commandQueue.sendCommandNoAck(
      246, [3, 0, 0, 0, 0, 0, 0],
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
    return { success: true, resultCode: 0, message: 'Bootloader reboot command sent' }
  }

  async reboot(): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    // Fire-and-forget: FC reboots before it can ACK
    this.commandQueue.sendCommandNoAck(
      246, [1, 0, 0, 0, 0, 0, 0],
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
    return { success: true, resultCode: 0, message: 'Reboot command sent' }
  }

  async resetParametersToDefault(): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    // Fire-and-forget: ArduPilot may not ACK MAV_CMD_PREFLIGHT_STORAGE reliably
    // param1=2 = reset user-configurable params to firmware defaults
    // param2=-1 = don't touch mission storage
    this.commandQueue.sendCommandNoAck(
      245, [2, -1, 0, 0, 0, 0, 0],
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
    return { success: true, resultCode: 0, message: 'Reset command sent' }
  }

  async killSwitch(): Promise<CommandResult> {
    return this.sendCommandLong(185, [1, 0, 0, 0, 0, 0, 0]) // MAV_CMD_DO_FLIGHTTERMINATION
  }

  async guidedGoto(lat: number, lon: number, alt: number): Promise<CommandResult> {
    return this.sendCommandLong(192, [-1, 1, 0, 0, lat, lon, alt]) // MAV_CMD_DO_REPOSITION
  }

  async pauseMission(): Promise<CommandResult> {
    return this.setFlightMode('LOITER')
  }

  async resumeMission(): Promise<CommandResult> {
    return this.setFlightMode('AUTO')
  }

  async clearMission(): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, resultCode: -1, message: 'Mission clear timed out' })
        this.missionUpload = null
      }, 5000)

      this.missionUpload = {
        items: [],
        resolve,
        reject: () => resolve({ success: false, resultCode: -1, message: 'Mission clear failed' }),
        timer,
      }

      this.transport!.send(encodeMissionClearAll(
        this.targetSysId, this.targetCompId,
        this.sysId, this.compId,
      ))
    })
  }

  async commitParamsToFlash(): Promise<CommandResult> {
    return this.sendCommandLong(245, [1, 0, 0, 0, 0, 0, 0]) // MAV_CMD_PREFLIGHT_STORAGE param1=1
  }

  async setHome(useCurrent: boolean, lat = 0, lon = 0, alt = 0): Promise<CommandResult> {
    return this.sendCommandLong(179, [useCurrent ? 0 : 1, 0, 0, 0, lat, lon, alt])
  }

  async changeSpeed(speedType: number, speed: number): Promise<CommandResult> {
    return this.sendCommandLong(178, [speedType, speed, -1, 0, 0, 0, 0])
  }

  async setYaw(angle: number, speed: number, direction: number, relative: boolean): Promise<CommandResult> {
    return this.sendCommandLong(115, [angle, speed, direction, relative ? 1 : 0, 0, 0, 0])
  }

  async setGeoFenceEnabled(enabled: boolean): Promise<CommandResult> {
    return this.sendCommandLong(207, [enabled ? 1 : 0, 0, 0, 0, 0, 0, 0])
  }

  async setServo(servoNumber: number, pwm: number): Promise<CommandResult> {
    return this.sendCommandLong(183, [servoNumber, pwm, 0, 0, 0, 0, 0])
  }

  async cameraTrigger(): Promise<CommandResult> {
    return this.sendCommandLong(203, [0, 0, 0, 0, 1, 0, 0])
  }

  async setGimbalAngle(pitch: number, roll: number, yaw: number): Promise<CommandResult> {
    return this.sendCommandLong(205, [pitch * 100, roll * 100, yaw * 100, 0, 0, 0, 0])
  }

  async doPreArmCheck(): Promise<CommandResult> {
    return this.sendCommandLong(401, [0, 0, 0, 0, 0, 0, 0])
  }

  // ── Serial Passthrough ───────────────────────────────

  sendSerialData(text: string): void {
    if (!this.transport?.isConnected) return
    const encoder = new TextEncoder()
    const bytes = encoder.encode(text + '\n')
    // device=10 (SERIAL_CONTROL_DEV_SHELL), flags=6 (RESPOND|EXCLUSIVE), timeout=500ms, baudrate=0
    this.transport.send(encodeSerialControl(10, 6, 500, 0, bytes, this.sysId, this.compId))
  }

  // ── Telemetry Subscriptions ────────────────────────────

  onAttitude(cb: AttitudeCallback): () => void {
    this.attitudeCallbacks.push(cb)
    return () => { this.attitudeCallbacks = this.attitudeCallbacks.filter(c => c !== cb) }
  }
  onPosition(cb: PositionCallback): () => void {
    this.positionCallbacks.push(cb)
    return () => { this.positionCallbacks = this.positionCallbacks.filter(c => c !== cb) }
  }
  onBattery(cb: BatteryCallback): () => void {
    this.batteryCallbacks.push(cb)
    return () => { this.batteryCallbacks = this.batteryCallbacks.filter(c => c !== cb) }
  }
  onGps(cb: GpsCallback): () => void {
    this.gpsCallbacks.push(cb)
    return () => { this.gpsCallbacks = this.gpsCallbacks.filter(c => c !== cb) }
  }
  onVfr(cb: VfrCallback): () => void {
    this.vfrCallbacks.push(cb)
    return () => { this.vfrCallbacks = this.vfrCallbacks.filter(c => c !== cb) }
  }
  onRc(cb: RcCallback): () => void {
    this.rcCallbacks.push(cb)
    return () => { this.rcCallbacks = this.rcCallbacks.filter(c => c !== cb) }
  }
  onStatusText(cb: StatusTextCallback): () => void {
    this.statusTextCallbacks.push(cb)
    return () => { this.statusTextCallbacks = this.statusTextCallbacks.filter(c => c !== cb) }
  }
  onHeartbeat(cb: HeartbeatCallback): () => void {
    this.heartbeatCallbacks.push(cb)
    return () => { this.heartbeatCallbacks = this.heartbeatCallbacks.filter(c => c !== cb) }
  }
  onParameter(cb: ParameterCallback): () => void {
    this.parameterCallbacks.push(cb)
    return () => { this.parameterCallbacks = this.parameterCallbacks.filter(c => c !== cb) }
  }
  onSerialData(cb: SerialDataCallback): () => void {
    this.serialDataCallbacks.push(cb)
    return () => { this.serialDataCallbacks = this.serialDataCallbacks.filter(c => c !== cb) }
  }
  onSysStatus(cb: SysStatusCallback): () => void {
    this.sysStatusCallbacks.push(cb)
    return () => { this.sysStatusCallbacks = this.sysStatusCallbacks.filter(c => c !== cb) }
  }
  onRadio(cb: RadioCallback): () => void {
    this.radioCallbacks.push(cb)
    return () => { this.radioCallbacks = this.radioCallbacks.filter(c => c !== cb) }
  }
  onMissionProgress(cb: MissionProgressCallback): () => void {
    this.missionProgressCallbacks.push(cb)
    return () => { this.missionProgressCallbacks = this.missionProgressCallbacks.filter(c => c !== cb) }
  }
  onEkf(cb: EkfCallback): () => void {
    this.ekfCallbacks.push(cb)
    return () => { this.ekfCallbacks = this.ekfCallbacks.filter(c => c !== cb) }
  }
  onVibration(cb: VibrationCallback): () => void {
    this.vibrationCallbacks.push(cb)
    return () => { this.vibrationCallbacks = this.vibrationCallbacks.filter(c => c !== cb) }
  }
  onServoOutput(cb: ServoOutputCallback): () => void {
    this.servoOutputCallbacks.push(cb)
    return () => { this.servoOutputCallbacks = this.servoOutputCallbacks.filter(c => c !== cb) }
  }
  onWind(cb: WindCallback): () => void {
    this.windCallbacks.push(cb)
    return () => { this.windCallbacks = this.windCallbacks.filter(c => c !== cb) }
  }
  onTerrain(cb: TerrainCallback): () => void {
    this.terrainCallbacks.push(cb)
    return () => { this.terrainCallbacks = this.terrainCallbacks.filter(c => c !== cb) }
  }
  onMagCalProgress(cb: MagCalProgressCallback): () => void {
    this.magCalProgressCallbacks.push(cb)
    return () => { this.magCalProgressCallbacks = this.magCalProgressCallbacks.filter(c => c !== cb) }
  }
  onMagCalReport(cb: MagCalReportCallback): () => void {
    this.magCalReportCallbacks.push(cb)
    return () => { this.magCalReportCallbacks = this.magCalReportCallbacks.filter(c => c !== cb) }
  }

  // ── Info ────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo | null { return this.vehicleInfo }

  getCapabilities(): ProtocolCapabilities {
    return this.firmwareHandler?.getCapabilities() ?? {
      supportsArming: false, supportsFlightModes: false, supportsMissionUpload: false,
      supportsMissionDownload: false, supportsManualControl: false, supportsParameters: false,
      supportsCalibration: false, supportsSerialPassthrough: false, supportsMotorTest: false,
      supportsGeoFence: false, supportsRally: false, supportsLogDownload: false,
    }
  }

  getFirmwareHandler(): FirmwareHandler | null { return this.firmwareHandler }

  // ── Helpers ────────────────────────────────────────────

  private sendCommandLong(command: number, params: [number, number, number, number, number, number, number], timeoutMs?: number): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return Promise.resolve({ success: false, resultCode: -1, message: 'Not connected' })
    }
    return this.commandQueue.sendCommand(
      command, params,
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
      timeoutMs,
    )
  }
}
