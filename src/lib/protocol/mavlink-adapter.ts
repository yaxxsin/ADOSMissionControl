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
  LogEntry, LogDownloadProgressCallback,
  AttitudeCallback, PositionCallback, BatteryCallback, GpsCallback,
  VfrCallback, RcCallback, StatusTextCallback, HeartbeatCallback,
  ParameterCallback, SerialDataCallback,
  SysStatusCallback, RadioCallback, MissionProgressCallback,
  EkfCallback, VibrationCallback, ServoOutputCallback,
  WindCallback, TerrainCallback,
  MagCalProgressCallback, MagCalReportCallback,
  AccelCalPosCallback, AccelCalPosition,
  HomePositionCallback, AutopilotVersionCallback,
  PowerStatusCallback, DistanceSensorCallback, FenceStatusCallback,
  NavControllerCallback, ScaledImuCallback, LinkStateCallback,
  LocalPositionCallback, DebugCallback, GimbalAttitudeCallback,
  ObstacleDistanceCallback, CameraImageCapturedCallback,
  ExtendedSysStateCallback, FencePointCallback, SystemTimeCallback,
} from './types'
import { MAVLinkParser, type MAVLinkFrame } from './mavlink-parser'
import {
  encodeHeartbeat, encodeManualControl,
  encodeSetMode, encodeParamRequestList, encodeParamRequestRead, encodeParamSet,
  encodeMissionCount, encodeMissionItemInt, encodeSerialControl,
  encodeMissionRequestList, encodeMissionRequestInt, encodeMissionAck, encodeMissionClearAll,
  encodeRequestDataStream, encodeCommandInt,
  encodeLogRequestList, encodeLogRequestData, encodeLogErase, encodeLogRequestEnd,
  encodeSetPositionTargetGlobalInt, encodeSetAttitudeTarget,
  encodeFencePoint, encodeFenceFetchPoint, encodeRcChannelsOverride,
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
  decodeCommandLong,
  decodeHomePosition, decodeAutopilotVersion,
  decodePowerStatus, decodeDistanceSensor, decodeFenceStatus,
  decodeNavControllerOutput, decodeScaledImu,
  decodeLogEntry, decodeLogData,
  decodeSystemTime, decodeLocalPositionNed,
  decodeExtendedSysState, decodeNamedValueFloat, decodeNamedValueInt,
  decodeDebug, decodeCameraImageCaptured,
  decodeGimbalDeviceAttitudeStatus, decodeObstacleDistance,
  decodeFencePoint,
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
  private streamRequestInterval: ReturnType<typeof setInterval> | null = null
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
  private accelCalPosCallbacks: AccelCalPosCallback[] = []
  private homePositionCallbacks: HomePositionCallback[] = []
  private autopilotVersionCallbacks: AutopilotVersionCallback[] = []
  private powerStatusCallbacks: PowerStatusCallback[] = []
  private distanceSensorCallbacks: DistanceSensorCallback[] = []
  private fenceStatusCallbacks: FenceStatusCallback[] = []
  private navControllerCallbacks: NavControllerCallback[] = []
  private scaledImuCallbacks: ScaledImuCallback[] = []
  private linkLostCallbacks: LinkStateCallback[] = []
  private linkRestoredCallbacks: LinkStateCallback[] = []
  private localPositionCallbacks: LocalPositionCallback[] = []
  private debugCallbacks: DebugCallback[] = []
  private gimbalAttitudeCallbacks: GimbalAttitudeCallback[] = []
  private obstacleDistanceCallbacks: ObstacleDistanceCallback[] = []
  private cameraImageCallbacks: CameraImageCapturedCallback[] = []
  private extendedSysStateCallbacks: ExtendedSysStateCallback[] = []
  private fencePointCallbacks: FencePointCallback[] = []
  private systemTimeCallbacks: SystemTimeCallback[] = []

  // Parameter cache (30s TTL) — avoids re-fetching when switching panels
  private paramCache = new Map<string, { value: number; timestamp: number }>()
  private static readonly PARAM_CACHE_TTL_MS = 30_000

  // Heartbeat timeout / link-loss detection (T1-1)
  private lastVehicleHeartbeat = 0
  private linkLostCheckInterval: ReturnType<typeof setInterval> | null = null
  private linkIsLost = false
  private static readonly HEARTBEAT_TIMEOUT_MS = 5000

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

  // Log list state
  private logListDownload: {
    entries: Map<number, LogEntry>
    lastLogId: number
    resolve: (entries: LogEntry[]) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  // Log data download state
  private logDataDownload: {
    logId: number
    totalSize: number
    data: Uint8Array
    receivedBytes: number
    lastReceivedOfs: number
    onProgress?: LogDownloadProgressCallback
    resolve: (data: Uint8Array) => void
    reject: (err: Error) => void
    inactivityTimer: ReturnType<typeof setTimeout> | null
    hardTimer: ReturnType<typeof setTimeout>
    retryCount: number
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

    // Request telemetry data streams from the FC
    this.requestDataStreams()

    // Re-request streams every 10s in case FC missed the initial request
    this.streamRequestInterval = setInterval(() => {
      this.requestDataStreams()
    }, 10000)

    // Initialize heartbeat tracking and start link-loss detection (T1-1)
    this.lastVehicleHeartbeat = Date.now()
    this.linkIsLost = false
    this.linkLostCheckInterval = setInterval(() => {
      this.checkLinkState()
    }, 1000)

    // Request HOME_POSITION and AUTOPILOT_VERSION once on connect (T1-2, T1-3)
    // MAV_CMD_REQUEST_MESSAGE (512): param1 = message ID
    this.sendCommandLong(512, [242, 0, 0, 0, 0, 0, 0]).catch(() => {}) // HOME_POSITION
    this.sendCommandLong(512, [148, 0, 0, 0, 0, 0, 0]).catch(() => {}) // AUTOPILOT_VERSION

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
    if (this.streamRequestInterval) {
      clearInterval(this.streamRequestInterval)
      this.streamRequestInterval = null
    }
    if (this.linkLostCheckInterval) {
      clearInterval(this.linkLostCheckInterval)
      this.linkLostCheckInterval = null
    }
    this.commandQueue.clear()
    this.paramCache.clear()
    this.parser.reset()
    // Clean up log state machines
    if (this.logListDownload) {
      clearTimeout(this.logListDownload.timer)
      this.logListDownload.resolve(Array.from(this.logListDownload.entries.values()))
      this.logListDownload = null
    }
    if (this.logDataDownload) {
      if (this.logDataDownload.inactivityTimer) clearTimeout(this.logDataDownload.inactivityTimer)
      clearTimeout(this.logDataDownload.hardTimer)
      this.logDataDownload.reject(new Error('Disconnected during log download'))
      this.logDataDownload = null
    }
    if (this.transport && this.dataHandler) {
      this.transport.off('data', this.dataHandler)
      this.transport.off('close', this.closeHandler as (data: void) => void)
    }
    this.transport = null
  }

  // ── Data Stream Requests ─────────────────────────────────

  /**
   * Request telemetry data streams from the flight controller.
   *
   * ArduPilot only streams telemetry (ATTITUDE, GPS, VFR_HUD, BATTERY, etc.)
   * when either SRn_* parameters are set or the GCS explicitly requests streams
   * via REQUEST_DATA_STREAM (msg 66). HEARTBEAT is always sent regardless.
   *
   * Every production GCS (QGC, Mission Planner) sends these immediately after
   * connecting. Fire-and-forget — no ACK expected.
   */
  private requestDataStreams(): void {
    if (!this.transport?.isConnected) return

    const streams: [number, number][] = [
      [10, 10],  // EXTRA1 (ATTITUDE) at 10 Hz
      [6,  5],   // POSITION (GLOBAL_POSITION_INT) at 5 Hz
      [11, 4],   // EXTRA2 (VFR_HUD) at 4 Hz
      [2,  2],   // EXTENDED_STATUS (SYS_STATUS, GPS_RAW_INT) at 2 Hz
      [12, 2],   // EXTRA3 (BATTERY_STATUS, EKF_STATUS, VIBRATION) at 2 Hz
      [3,  2],   // RC_CHANNELS at 2 Hz
      [1,  2],   // RAW_SENSORS (SERVO_OUTPUT_RAW, SCALED_PRESSURE) at 2 Hz
    ]

    for (const [streamId, rate] of streams) {
      this.transport.send(encodeRequestDataStream(
        this.targetSysId, this.targetCompId,
        streamId, rate, 1, // 1 = start
        this.sysId, this.compId,
      ))
    }
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
      case 76:  this.handleIncomingCommandLong(frame); break
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
      case 242: this.handleHomePosition(frame); break
      case 148: this.handleAutopilotVersion(frame); break
      case 125: this.handlePowerStatus(frame); break
      case 132: this.handleDistanceSensor(frame); break
      case 162: this.handleFenceStatus(frame); break
      case 62:  this.handleNavControllerOutput(frame); break
      case 26:  this.handleScaledImu(frame); break
      case 118: this.handleLogEntry(frame); break
      case 120: this.handleLogData(frame); break
      case 2:   this.handleSystemTime(frame); break
      case 32:  this.handleLocalPosition(frame); break
      case 245: this.handleExtendedSysState(frame); break
      case 251: this.handleNamedValueFloat(frame); break
      case 252: this.handleNamedValueInt(frame); break
      case 254: this.handleDebugValue(frame); break
      case 263: this.handleCameraImageCaptured(frame); break
      case 284: this.handleGimbalAttitude(frame); break
      case 330: this.handleObstacleDistance(frame); break
      case 160: this.handleFencePoint(frame); break
    }
  }

  // ── Message Handlers ───────────────────────────────────

  private handleHeartbeat(frame: MAVLinkFrame): void {
    const hb = decodeHeartbeat(frame.payload)
    if (hb.type === 6) return // Ignore GCS heartbeats

    // Track vehicle heartbeat for link-loss detection (T1-1)
    this.lastVehicleHeartbeat = Date.now()

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

  /** Check if vehicle heartbeats have stopped (link-loss detection, T1-1). */
  private checkLinkState(): void {
    const elapsed = Date.now() - this.lastVehicleHeartbeat
    if (elapsed > MAVLinkAdapter.HEARTBEAT_TIMEOUT_MS && !this.linkIsLost) {
      this.linkIsLost = true
      for (const cb of this.linkLostCallbacks) cb()
    } else if (elapsed <= MAVLinkAdapter.HEARTBEAT_TIMEOUT_MS && this.linkIsLost) {
      this.linkIsLost = false
      for (const cb of this.linkRestoredCallbacks) cb()
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
      cb({
        compassId: data.compassId,
        completionPct: data.completionPct,
        calStatus: data.calStatus,
        completionMask: Array.from(data.completionMask),
        directionX: data.directionX,
        directionY: data.directionY,
        directionZ: data.directionZ,
      })
    }
  }

  private handleMagCalReport(frame: MAVLinkFrame): void {
    const data = decodeMagCalReport(frame.payload)
    for (const cb of this.magCalReportCallbacks) {
      cb({
        compassId: data.compassId,
        calStatus: data.calStatus,
        autosaved: data.autosaved,
        ofsX: data.ofsX,
        ofsY: data.ofsY,
        ofsZ: data.ofsZ,
        fitness: data.fitness,
        diagX: data.diagX,
        diagY: data.diagY,
        diagZ: data.diagZ,
        offdiagX: data.offdiagX,
        offdiagY: data.offdiagY,
        offdiagZ: data.offdiagZ,
        orientationConfidence: data.orientationConfidence,
        oldOrientation: data.oldOrientation,
        newOrientation: data.newOrientation,
        scaleFactor: data.scaleFactor,
      })
    }
  }

  private handleHomePosition(frame: MAVLinkFrame): void {
    const data = decodeHomePosition(frame.payload)
    for (const cb of this.homePositionCallbacks) {
      cb({
        timestamp: Date.now(),
        lat: data.lat / 1e7,
        lon: data.lon / 1e7,
        alt: data.alt / 1000, // mm → m
      })
    }
  }

  private handleAutopilotVersion(frame: MAVLinkFrame): void {
    const data = decodeAutopilotVersion(frame.payload)

    // Update firmware version string from flight software version
    if (this.vehicleInfo) {
      const major = (data.flightSwVersion >> 24) & 0xff
      const minor = (data.flightSwVersion >> 16) & 0xff
      const patch = (data.flightSwVersion >> 8) & 0xff
      this.vehicleInfo = {
        ...this.vehicleInfo,
        firmwareVersionString: `${major}.${minor}.${patch}`,
      }
    }

    for (const cb of this.autopilotVersionCallbacks) {
      cb({
        capabilities: data.capabilities,
        flightSwVersion: data.flightSwVersion,
        middlewareSwVersion: data.middlewareSwVersion,
        osSwVersion: data.osSwVersion,
        boardVersion: data.boardVersion,
        uid: data.uid,
      })
    }
  }

  private handlePowerStatus(frame: MAVLinkFrame): void {
    const data = decodePowerStatus(frame.payload)
    for (const cb of this.powerStatusCallbacks) {
      cb({
        timestamp: Date.now(),
        vcc: data.vcc,     // mV
        vservo: data.vservo, // mV
        flags: data.flags,
      })
    }
  }

  private handleDistanceSensor(frame: MAVLinkFrame): void {
    const data = decodeDistanceSensor(frame.payload)
    for (const cb of this.distanceSensorCallbacks) {
      cb({
        timestamp: Date.now(),
        currentDistance: data.currentDistance, // cm
        minDistance: data.minDistance,
        maxDistance: data.maxDistance,
        orientation: data.orientation,
        id: data.id,
        covariance: data.covariance,
      })
    }
  }

  private handleFenceStatus(frame: MAVLinkFrame): void {
    const data = decodeFenceStatus(frame.payload)
    for (const cb of this.fenceStatusCallbacks) {
      cb({
        timestamp: Date.now(),
        breachStatus: data.breachStatus,
        breachCount: data.breachCount,
        breachType: data.breachType,
      })
    }
  }

  private handleNavControllerOutput(frame: MAVLinkFrame): void {
    const data = decodeNavControllerOutput(frame.payload)
    for (const cb of this.navControllerCallbacks) {
      cb({
        timestamp: Date.now(),
        navBearing: data.navBearing,
        targetBearing: data.targetBearing,
        wpDist: data.wpDist,
        altError: data.altError,
        xtrackError: data.xtrackError,
      })
    }
  }

  private handleScaledImu(frame: MAVLinkFrame): void {
    const data = decodeScaledImu(frame.payload)
    for (const cb of this.scaledImuCallbacks) {
      cb({
        timestamp: Date.now(),
        xacc: data.xacc,
        yacc: data.yacc,
        zacc: data.zacc,
        xgyro: data.xgyro,
        ygyro: data.ygyro,
        zgyro: data.zgyro,
        xmag: data.xmag,
        ymag: data.ymag,
        zmag: data.zmag,
      })
    }
  }

  private handleSystemTime(frame: MAVLinkFrame): void {
    const data = decodeSystemTime(frame.payload)
    for (const cb of this.systemTimeCallbacks) {
      cb({ timestamp: Date.now(), timeUnixUsec: data.timeUnixUsec, timeBootMs: data.timeBootMs })
    }
  }

  private handleLocalPosition(frame: MAVLinkFrame): void {
    const data = decodeLocalPositionNed(frame.payload)
    for (const cb of this.localPositionCallbacks) {
      cb({
        timestamp: Date.now(),
        x: data.x, y: data.y, z: data.z,
        vx: data.vx, vy: data.vy, vz: data.vz,
      })
    }
  }

  private handleExtendedSysState(frame: MAVLinkFrame): void {
    const data = decodeExtendedSysState(frame.payload)
    for (const cb of this.extendedSysStateCallbacks) {
      cb({ timestamp: Date.now(), vtolState: data.vtolState, landedState: data.landedState })
    }
  }

  private handleNamedValueFloat(frame: MAVLinkFrame): void {
    const data = decodeNamedValueFloat(frame.payload)
    for (const cb of this.debugCallbacks) {
      cb({ timestamp: Date.now(), name: data.name, value: data.value, type: "float" })
    }
  }

  private handleNamedValueInt(frame: MAVLinkFrame): void {
    const data = decodeNamedValueInt(frame.payload)
    for (const cb of this.debugCallbacks) {
      cb({ timestamp: Date.now(), name: data.name, value: data.value, type: "int" })
    }
  }

  private handleDebugValue(frame: MAVLinkFrame): void {
    const data = decodeDebug(frame.payload)
    for (const cb of this.debugCallbacks) {
      cb({ timestamp: Date.now(), name: `debug[${data.ind}]`, value: data.value, type: "debug" })
    }
  }

  private handleCameraImageCaptured(frame: MAVLinkFrame): void {
    const data = decodeCameraImageCaptured(frame.payload)
    for (const cb of this.cameraImageCallbacks) {
      cb({
        timestamp: Date.now(),
        lat: data.lat, lon: data.lon, alt: data.alt,
        imageIndex: data.imageIndex,
        captureResult: data.captureResult,
        fileUrl: "",
      })
    }
  }

  private handleGimbalAttitude(frame: MAVLinkFrame): void {
    const data = decodeGimbalDeviceAttitudeStatus(frame.payload)
    // Convert quaternion to Euler angles (simplified)
    const [w, x, y, z] = data.q
    const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
    const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))))
    const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
    const RAD_TO_DEG = 180 / Math.PI
    for (const cb of this.gimbalAttitudeCallbacks) {
      cb({
        timestamp: Date.now(),
        roll: roll * RAD_TO_DEG,
        pitch: pitch * RAD_TO_DEG,
        yaw: yaw * RAD_TO_DEG,
        angularVelocityX: data.angularVelocityX,
        angularVelocityY: data.angularVelocityY,
        angularVelocityZ: data.angularVelocityZ,
      })
    }
  }

  private handleObstacleDistance(frame: MAVLinkFrame): void {
    const data = decodeObstacleDistance(frame.payload)
    for (const cb of this.obstacleDistanceCallbacks) {
      cb({
        timestamp: Date.now(),
        distances: data.distances,
        minDistance: data.minDistance,
        maxDistance: data.maxDistance,
        increment: data.increment,
        incrementF: 0,
        angleOffset: 0,
        frame: 0,
      })
    }
  }

  private handleFencePoint(frame: MAVLinkFrame): void {
    const data = decodeFencePoint(frame.payload)
    for (const cb of this.fencePointCallbacks) {
      cb({
        timestamp: Date.now(),
        idx: data.idx, count: data.count,
        lat: data.lat, lon: data.lon,
      })
    }
  }

  private handleIncomingCommandLong(frame: MAVLinkFrame): void {
    const data = decodeCommandLong(frame.payload)
    // MAV_CMD_ACCELCAL_VEHICLE_POS = 42429 — FC requests GCS to confirm vehicle position
    if (data.command === 42429) {
      const position = Math.round(data.param1) as AccelCalPosition
      if (position >= 1 && position <= 6) {
        for (const cb of this.accelCalPosCallbacks) {
          cb({ position })
        }
      }
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
    // MAV_CMD_DO_SET_MODE (176) via COMMAND_LONG — gets a COMMAND_ACK unlike SET_MODE (msg 11)
    return this.sendCommandLong(176, [baseMode, customMode, 0, 0, 0, 0, 0])
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

  async getParameter(name: string): Promise<ParameterValue> {
    if (!this.transport?.isConnected) {
      return Promise.reject(new Error('Not connected'))
    }

    // Check cache first (30s TTL)
    const cached = this.paramCache.get(name)
    if (cached && (Date.now() - cached.timestamp) < MAVLinkAdapter.PARAM_CACHE_TTL_MS) {
      return { name, value: cached.value, type: 9, index: -1, count: -1 }
    }

    return new Promise<ParameterValue>((resolve, reject) => {
      const timer = setTimeout(() => {
        unsub()
        reject(new Error(`getParameter timed out: ${name}`))
      }, 5000)

      const unsub = this.onParameter((param) => {
        if (param.name === name) {
          clearTimeout(timer)
          unsub()
          // Populate cache on successful read
          this.paramCache.set(name, { value: param.value, timestamp: Date.now() })
          resolve(param)
        }
      })

      // PARAM_REQUEST_READ: paramIndex=-1 means use name instead of index
      this.transport!.send(encodeParamRequestRead(
        this.targetSysId, this.targetCompId,
        name, -1,
        this.sysId, this.compId,
      ))
    })
  }

  async setParameter(name: string, value: number, type = 9): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    // Invalidate cache for this param
    this.paramCache.delete(name)

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, resultCode: -1, message: `Param set timed out: ${name}` })
      }, 3000)

      // Listen for PARAM_VALUE echo as confirmation
      const unsub = this.onParameter((param) => {
        if (param.name === name) {
          clearTimeout(timer)
          unsub()
          // Update cache with confirmed value
          this.paramCache.set(name, { value: param.value, timestamp: Date.now() })
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

  async startCalibration(type: 'accel' | 'gyro' | 'compass' | 'level' | 'airspeed' | 'baro' | 'rc' | 'esc' | 'compassmot'): Promise<CommandResult> {
    if (type === 'compass') {
      // ArduPilot uses MAV_CMD_DO_START_MAG_CAL (42424), not PREFLIGHT_CALIBRATION
      // param1=0 (all compasses), param2=1 (retry on failure), param3=0 (no autosave — requires DO_ACCEPT_MAG_CAL), param4=2 (2s delay)
      return this.sendCommandLong(42424, [0, 1, 0, 2, 0, 0, 0], 30000)
    }

    // RC calibration is a multi-step parameter-based workflow, not a single command
    if (type === 'rc') {
      return { success: false, resultCode: -1, message: 'RC calibration requires the Receiver panel (channel bars + manual stick movement)' }
    }

    // CompassMot uses DO_START_MAG_CAL with compassmot flag, not PREFLIGHT_CALIBRATION
    if (type === 'compassmot') {
      return this.sendCommandLong(42424, [0, 0, 0, 0, 0, 0, 1], 120000) // param7=1 for compassmot mode
    }

    // MAV_CMD_PREFLIGHT_CALIBRATION = 241
    const params: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
    switch (type) {
      case 'gyro':     params[0] = 1; break                // param1=1: gyro cal
      case 'accel':    params[4] = 1; break                // param5=1: accel cal
      case 'level':    params[4] = 2; break                // param5=2: level cal
      case 'airspeed': params[2] = 1; break                // param3=1: airspeed cal
      case 'baro':     params[2] = 1; break                // param3=1: baro + airspeed cal
      case 'esc':      params[4] = 4; break                // param5=4: ESC cal
    }
    return this.sendCommandLong(241, params, 30000)        // 30s timeout for calibration
  }

  confirmAccelCalPos(position: number): void {
    if (!this.transport?.isConnected) return
    // Fire-and-forget: send COMMAND_LONG(42429) back to FC with position in param1
    this.commandQueue.sendCommandNoAck(
      42429, [position, 0, 0, 0, 0, 0, 0],
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
  }

  async acceptCompassCal(compassMask = 0): Promise<CommandResult> {
    return this.sendCommandLong(42425, [compassMask, 0, 0, 0, 0, 0, 0]) // DO_ACCEPT_MAG_CAL
  }

  async cancelCompassCal(compassMask = 0): Promise<CommandResult> {
    return this.sendCommandLong(42426, [compassMask, 0, 0, 0, 0, 0, 0]) // DO_CANCEL_MAG_CAL
  }

  async cancelCalibration(): Promise<CommandResult> {
    // Send PREFLIGHT_CALIBRATION with all zeros to cancel any active calibration
    return this.sendCommandLong(241, [0, 0, 0, 0, 0, 0, 0])
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
    // Use COMMAND_INT for lat/lon precision (int32*1e7 vs float32 ~1m loss)
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    const frame = encodeCommandInt(
      this.targetSysId, this.targetCompId,
      6, // MAV_FRAME_GLOBAL_RELATIVE_ALT_INT
      192, // MAV_CMD_DO_REPOSITION
      0, 0,
      -1, 1, 0, 0,
      Math.round(lat * 1e7),
      Math.round(lon * 1e7),
      alt,
      this.sysId, this.compId,
    )
    this.transport.send(frame)
    // COMMAND_INT doesn't get ACK in older firmwares, return optimistic
    return { success: true, resultCode: 0, message: 'Goto sent' }
  }

  async pauseMission(): Promise<CommandResult> {
    // MAV_CMD_DO_PAUSE_CONTINUE (193): param1=0 → pause
    return this.sendCommandLong(193, [0, 0, 0, 0, 0, 0, 0])
  }

  async resumeMission(): Promise<CommandResult> {
    // MAV_CMD_DO_PAUSE_CONTINUE (193): param1=1 → continue
    return this.sendCommandLong(193, [1, 0, 0, 0, 0, 0, 0])
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
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    // Fire-and-forget: ArduPilot saves params to EEPROM on PARAM_SET already.
    // MAV_CMD_PREFLIGHT_STORAGE is belt-and-suspenders. ArduPilot may not ACK it reliably.
    this.commandQueue.sendCommandNoAck(
      245, [1, 0, 0, 0, 0, 0, 0],
      (data) => this.transport!.send(data),
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    )
    return { success: true, resultCode: 0, message: 'Flash commit command sent' }
  }

  async setHome(useCurrent: boolean, lat = 0, lon = 0, alt = 0): Promise<CommandResult> {
    // MAV_CMD_DO_SET_HOME (179): param1=1 → use current position, param1=0 → use specified
    return this.sendCommandLong(179, [useCurrent ? 1 : 0, 0, 0, 0, lat, lon, alt])
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

  // ── Log Download ───────────────────────────────────────

  async getLogList(): Promise<LogEntry[]> {
    if (!this.transport?.isConnected) return []

    return new Promise<LogEntry[]>((resolve) => {
      const timer = setTimeout(() => {
        // 15s timeout — resolve with whatever we received
        if (this.logListDownload) {
          const entries = Array.from(this.logListDownload.entries.values())
            .sort((a, b) => a.id - b.id)
          this.logListDownload = null
          resolve(entries)
        } else {
          resolve([])
        }
      }, 15000)

      this.logListDownload = {
        entries: new Map(),
        lastLogId: 0,
        resolve,
        timer,
      }

      this.transport!.send(encodeLogRequestList(
        this.targetSysId, this.targetCompId,
        0, 0xffff,
        this.sysId, this.compId,
      ))
    })
  }

  async downloadLog(logId: number, onProgress?: LogDownloadProgressCallback): Promise<Uint8Array> {
    if (!this.transport?.isConnected) throw new Error('Not connected')

    return new Promise<Uint8Array>((resolve, reject) => {
      // 5 min hard timeout
      const hardTimer = setTimeout(() => {
        this.finishLogDataDownload(true)
      }, 5 * 60 * 1000)

      const createInactivityTimer = () => setTimeout(() => {
        // 3s inactivity — retry from last offset
        if (!this.logDataDownload || !this.transport?.isConnected) return
        this.logDataDownload.retryCount++
        if (this.logDataDownload.retryCount > 5) {
          this.finishLogDataDownload(true)
          return
        }
        // Re-request from last received offset
        this.transport.send(encodeLogRequestData(
          this.targetSysId, this.targetCompId,
          this.logDataDownload.logId,
          this.logDataDownload.receivedBytes,
          0xffffffff,
          this.sysId, this.compId,
        ))
        this.logDataDownload.inactivityTimer = createInactivityTimer()
      }, 3000)

      // We don't know totalSize upfront — allocate generously, will trim
      this.logDataDownload = {
        logId,
        totalSize: 0, // updated when first data arrives or from log entry
        data: new Uint8Array(0),
        receivedBytes: 0,
        lastReceivedOfs: -1,
        onProgress,
        resolve,
        reject,
        inactivityTimer: createInactivityTimer(),
        hardTimer,
        retryCount: 0,
      }

      this.transport!.send(encodeLogRequestData(
        this.targetSysId, this.targetCompId,
        logId, 0, 0xffffffff,
        this.sysId, this.compId,
      ))
    })
  }

  async eraseAllLogs(): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    this.transport.send(encodeLogErase(
      this.targetSysId, this.targetCompId,
      this.sysId, this.compId,
    ))
    return { success: true, resultCode: 0, message: 'Erase command sent' }
  }

  cancelLogDownload(): void {
    if (this.logDataDownload) {
      if (this.logDataDownload.inactivityTimer) clearTimeout(this.logDataDownload.inactivityTimer)
      clearTimeout(this.logDataDownload.hardTimer)
      this.logDataDownload.resolve(new Uint8Array(0))
      this.logDataDownload = null
    }
    if (this.transport?.isConnected) {
      this.transport.send(encodeLogRequestEnd(
        this.targetSysId, this.targetCompId,
        this.sysId, this.compId,
      ))
    }
  }

  private handleLogEntry(frame: MAVLinkFrame): void {
    if (!this.logListDownload) return
    const data = decodeLogEntry(frame.payload)
    const entry: LogEntry = {
      id: data.id,
      numLogs: data.numLogs,
      lastLogId: data.lastLogNum,
      size: data.size,
      timeUtc: data.timeUtc,
    }
    this.logListDownload.entries.set(data.id, entry)
    this.logListDownload.lastLogId = data.lastLogNum

    // Complete when we've received the last log entry
    if (data.id >= data.lastLogNum || data.numLogs === 0) {
      clearTimeout(this.logListDownload.timer)
      const entries = Array.from(this.logListDownload.entries.values())
        .sort((a, b) => a.id - b.id)
      this.logListDownload.resolve(entries)
      this.logListDownload = null
    }
  }

  private handleLogData(frame: MAVLinkFrame): void {
    if (!this.logDataDownload) return
    const data = decodeLogData(frame.payload)
    if (data.id !== this.logDataDownload.logId) return

    // Grow data buffer if needed
    const endOfs = data.ofs + data.count
    if (endOfs > this.logDataDownload.data.length) {
      const newBuf = new Uint8Array(Math.max(endOfs, this.logDataDownload.data.length * 2))
      newBuf.set(this.logDataDownload.data)
      this.logDataDownload.data = newBuf
    }

    // Copy chunk data
    this.logDataDownload.data.set(data.data, data.ofs)
    if (endOfs > this.logDataDownload.receivedBytes) {
      this.logDataDownload.receivedBytes = endOfs
    }
    this.logDataDownload.lastReceivedOfs = data.ofs

    // Fire progress callback
    if (this.logDataDownload.onProgress && this.logDataDownload.totalSize > 0) {
      this.logDataDownload.onProgress(
        this.logDataDownload.receivedBytes,
        this.logDataDownload.totalSize,
      )
    }

    // Reset inactivity timer
    if (this.logDataDownload.inactivityTimer) clearTimeout(this.logDataDownload.inactivityTimer)
    this.logDataDownload.inactivityTimer = setTimeout(() => {
      // Inactivity — retry or finish
      if (!this.logDataDownload || !this.transport?.isConnected) return
      this.logDataDownload.retryCount++
      if (this.logDataDownload.retryCount > 5) {
        this.finishLogDataDownload(true)
        return
      }
      this.transport.send(encodeLogRequestData(
        this.targetSysId, this.targetCompId,
        this.logDataDownload.logId,
        this.logDataDownload.receivedBytes,
        0xffffffff,
        this.sysId, this.compId,
      ))
    }, 3000)

    // Complete when count < 90 (last chunk)
    if (data.count < 90) {
      this.finishLogDataDownload(false)
    }
  }

  private finishLogDataDownload(partial: boolean): void {
    if (!this.logDataDownload) return
    const dl = this.logDataDownload
    if (dl.inactivityTimer) clearTimeout(dl.inactivityTimer)
    clearTimeout(dl.hardTimer)
    // Trim to actual received size
    const trimmed = dl.data.slice(0, dl.receivedBytes)
    dl.resolve(trimmed)
    this.logDataDownload = null
    // Send LOG_REQUEST_END to resume normal logging
    if (this.transport?.isConnected) {
      this.transport.send(encodeLogRequestEnd(
        this.targetSysId, this.targetCompId,
        this.sysId, this.compId,
      ))
    }
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
  onAccelCalPos(cb: AccelCalPosCallback): () => void {
    this.accelCalPosCallbacks.push(cb)
    return () => { this.accelCalPosCallbacks = this.accelCalPosCallbacks.filter(c => c !== cb) }
  }
  onHomePosition(cb: HomePositionCallback): () => void {
    this.homePositionCallbacks.push(cb)
    return () => { this.homePositionCallbacks = this.homePositionCallbacks.filter(c => c !== cb) }
  }
  onAutopilotVersion(cb: AutopilotVersionCallback): () => void {
    this.autopilotVersionCallbacks.push(cb)
    return () => { this.autopilotVersionCallbacks = this.autopilotVersionCallbacks.filter(c => c !== cb) }
  }
  onPowerStatus(cb: PowerStatusCallback): () => void {
    this.powerStatusCallbacks.push(cb)
    return () => { this.powerStatusCallbacks = this.powerStatusCallbacks.filter(c => c !== cb) }
  }
  onDistanceSensor(cb: DistanceSensorCallback): () => void {
    this.distanceSensorCallbacks.push(cb)
    return () => { this.distanceSensorCallbacks = this.distanceSensorCallbacks.filter(c => c !== cb) }
  }
  onFenceStatus(cb: FenceStatusCallback): () => void {
    this.fenceStatusCallbacks.push(cb)
    return () => { this.fenceStatusCallbacks = this.fenceStatusCallbacks.filter(c => c !== cb) }
  }
  onNavController(cb: NavControllerCallback): () => void {
    this.navControllerCallbacks.push(cb)
    return () => { this.navControllerCallbacks = this.navControllerCallbacks.filter(c => c !== cb) }
  }
  onScaledImu(cb: ScaledImuCallback): () => void {
    this.scaledImuCallbacks.push(cb)
    return () => { this.scaledImuCallbacks = this.scaledImuCallbacks.filter(c => c !== cb) }
  }
  onLinkLost(cb: LinkStateCallback): () => void {
    this.linkLostCallbacks.push(cb)
    return () => { this.linkLostCallbacks = this.linkLostCallbacks.filter(c => c !== cb) }
  }
  onLinkRestored(cb: LinkStateCallback): () => void {
    this.linkRestoredCallbacks.push(cb)
    return () => { this.linkRestoredCallbacks = this.linkRestoredCallbacks.filter(c => c !== cb) }
  }
  onLocalPosition(cb: LocalPositionCallback): () => void {
    this.localPositionCallbacks.push(cb)
    return () => { this.localPositionCallbacks = this.localPositionCallbacks.filter(c => c !== cb) }
  }
  onDebug(cb: DebugCallback): () => void {
    this.debugCallbacks.push(cb)
    return () => { this.debugCallbacks = this.debugCallbacks.filter(c => c !== cb) }
  }
  onGimbalAttitude(cb: GimbalAttitudeCallback): () => void {
    this.gimbalAttitudeCallbacks.push(cb)
    return () => { this.gimbalAttitudeCallbacks = this.gimbalAttitudeCallbacks.filter(c => c !== cb) }
  }
  onObstacleDistance(cb: ObstacleDistanceCallback): () => void {
    this.obstacleDistanceCallbacks.push(cb)
    return () => { this.obstacleDistanceCallbacks = this.obstacleDistanceCallbacks.filter(c => c !== cb) }
  }
  onCameraImageCaptured(cb: CameraImageCapturedCallback): () => void {
    this.cameraImageCallbacks.push(cb)
    return () => { this.cameraImageCallbacks = this.cameraImageCallbacks.filter(c => c !== cb) }
  }
  onExtendedSysState(cb: ExtendedSysStateCallback): () => void {
    this.extendedSysStateCallbacks.push(cb)
    return () => { this.extendedSysStateCallbacks = this.extendedSysStateCallbacks.filter(c => c !== cb) }
  }
  onFencePoint(cb: FencePointCallback): () => void {
    this.fencePointCallbacks.push(cb)
    return () => { this.fencePointCallbacks = this.fencePointCallbacks.filter(c => c !== cb) }
  }
  onSystemTime(cb: SystemTimeCallback): () => void {
    this.systemTimeCallbacks.push(cb)
    return () => { this.systemTimeCallbacks = this.systemTimeCallbacks.filter(c => c !== cb) }
  }

  // ── Message Rate Control (T1-4) ────────────────────────

  async requestMessage(msgId: number): Promise<CommandResult> {
    // MAV_CMD_REQUEST_MESSAGE (512): param1 = message ID
    return this.sendCommandLong(512, [msgId, 0, 0, 0, 0, 0, 0])
  }

  async setMessageInterval(msgId: number, intervalUs: number): Promise<CommandResult> {
    // MAV_CMD_SET_MESSAGE_INTERVAL (511): param1 = message ID, param2 = interval in µs (-1 to disable)
    return this.sendCommandLong(511, [msgId, intervalUs, 0, 0, 0, 0, 0])
  }

  // ── Fence Operations ──────────────────────────────────

  async uploadFence(points: Array<{ lat: number; lon: number }>): Promise<CommandResult> {
    if (!this.transport?.isConnected) {
      return { success: false, resultCode: -1, message: 'Not connected' }
    }
    for (let i = 0; i < points.length; i++) {
      this.transport.send(encodeFencePoint(
        this.targetSysId, this.targetCompId,
        i, points.length, points[i].lat, points[i].lon,
        this.sysId, this.compId,
      ))
    }
    return { success: true, resultCode: 0, message: `Uploaded ${points.length} fence points` }
  }

  async downloadFence(): Promise<Array<{ idx: number; lat: number; lon: number }>> {
    if (!this.transport?.isConnected) return []
    const points: Array<{ idx: number; lat: number; lon: number }> = []
    // Request fence points — in real use, read FENCE_TOTAL param first
    return points
  }

  // ── Guided Flight ────────────────────────────────────

  sendPositionTarget(lat: number, lon: number, alt: number): void {
    if (!this.transport?.isConnected) return
    this.transport.send(encodeSetPositionTargetGlobalInt(
      this.targetSysId, this.targetCompId,
      Math.round(lat * 1e7), Math.round(lon * 1e7), alt,
      0, 0, 0,
      0x0FF8, // typeMask: position only
      6,      // MAV_FRAME_GLOBAL_INT
      this.sysId, this.compId,
    ))
  }

  sendAttitudeTarget(roll: number, pitch: number, yaw: number, thrust: number): void {
    if (!this.transport?.isConnected) return
    this.transport.send(encodeSetAttitudeTarget(
      this.targetSysId, this.targetCompId,
      roll, pitch, yaw, thrust,
      0x07, // typeMask: attitude only
      this.sysId, this.compId,
    ))
  }

  // ── Advanced Calibration ─────────────────────────────

  async startEscCalibration(): Promise<CommandResult> {
    return this.sendCommandLong(241, [0, 0, 0, 0, 4, 0, 0]) // PREFLIGHT_CALIBRATION param5=4
  }

  async startCompassMotCal(): Promise<CommandResult> {
    return this.sendCommandLong(42424, [0, 0, 0, 0, 0, 0, 0]) // DO_START_MAG_CAL
  }

  // ── Info ────────────────────────────────────────────────

  getVehicleInfo(): VehicleInfo | null { return this.vehicleInfo }

  getCapabilities(): ProtocolCapabilities {
    return this.firmwareHandler?.getCapabilities() ?? {
      supportsArming: false, supportsFlightModes: false, supportsMissionUpload: false,
      supportsMissionDownload: false, supportsManualControl: false, supportsParameters: false,
      supportsCalibration: false, supportsSerialPassthrough: false, supportsMotorTest: false,
      supportsGeoFence: false, supportsRally: false, supportsLogDownload: false,
      supportsOsd: false, supportsPidTuning: false, supportsPorts: false,
      supportsFailsafe: false, supportsPowerConfig: false, supportsReceiver: false,
      supportsFirmwareFlash: false, supportsCliShell: false, supportsMavlinkInspector: false,
      supportsGimbal: false, supportsCamera: false, supportsLed: false,
      supportsBattery2: false, supportsRangefinder: false, supportsOpticalFlow: false,
      supportsObstacleAvoidance: false, supportsDebugValues: false,
      manualControlHz: 0, parameterCount: 0,
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
