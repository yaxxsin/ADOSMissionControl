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
  AccelCalPosCallback,
  HomePositionCallback, AutopilotVersionCallback,
  PowerStatusCallback, DistanceSensorCallback, FenceStatusCallback,
  NavControllerCallback, ScaledImuCallback, ScaledPressureCallback,
  EstimatorStatusCallback, CameraTriggerCallback, LinkStateCallback,
  LocalPositionCallback, DebugCallback, GimbalAttitudeCallback,
  ObstacleDistanceCallback, CameraImageCapturedCallback,
  ExtendedSysStateCallback, FencePointCallback, SystemTimeCallback,
  RawImuCallback, RcChannelsRawCallback, RcChannelsOverrideCallback,
  MissionItemCallback, AltitudeCallback, WindCovCallback,
  AisVesselCallback, GimbalManagerInfoCallback, GimbalManagerStatusCallback,
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
  decodeHeartbeat, decodeCommandAck, decodeParamValue,
  decodeMissionAck, decodeMissionRequestInt,
  decodeMissionCount, decodeMissionItemInt as decodeMissionItemIntMsg,
  decodeLogEntry, decodeLogData,
} from './mavlink-messages'
import {
  handleAttitude, handleGlobalPosition, handleBattery,
  handleGpsRaw, handleVfrHud, handleRcChannels,
  handleSysStatus, handleRadioStatus, handlePowerStatus,
  handleScaledImu, handleScaledPressure, handleEstimatorStatus, handleLocalPosition,
  handleRawImu, handleRcChannelsRaw, handleRcChannelsOverride, handleAltitude,
} from './handlers/telemetry-handlers'
import {
  handleEkfStatus, handleVibration, handleServoOutput,
  handleWind, handleTerrainReport, handleHomePosition,
  handleDistanceSensor, handleFenceStatus, handleNavControllerOutput,
  handleFencePoint, handleMissionCurrent, handleMissionItemReached,
  handleWindCov, handleMissionItemLegacy,
} from './handlers/nav-safety-handlers'
import {
  handleMagCalProgress, handleMagCalReport, handleIncomingCommandLong,
} from './handlers/calibration-handlers'
import {
  handleExtendedSysState, handleSystemTime,
  handleStatusText, handleSerialControl,
  handleAutopilotVersion as handleAutopilotVersionMsg,
} from './handlers/info-handlers'
import {
  handleNamedValueFloat, handleNamedValueInt, handleDebugValue,
  handleCameraTrigger, handleCameraImageCaptured, handleGimbalAttitude, handleObstacleDistance,
  handleAisVessel, handleGimbalManagerInfo, handleGimbalManagerStatus,
} from './handlers/debug-handlers'
import { CommandQueue } from './command-queue'
import { createFirmwareHandler } from './firmware/ardupilot'
import { useDiagnosticsStore } from '@/stores/diagnostics-store'

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
  private scaledPressureCallbacks: ScaledPressureCallback[] = []
  private estimatorStatusCallbacks: EstimatorStatusCallback[] = []
  private cameraTriggerCallbacks: CameraTriggerCallback[] = []
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
  private rawImuCallbacks: RawImuCallback[] = []
  private rcChannelsRawCallbacks: RcChannelsRawCallback[] = []
  private rcChannelsOverrideCallbacks: RcChannelsOverrideCallback[] = []
  private missionItemCallbacks: MissionItemCallback[] = []
  private altitudeCallbacks: AltitudeCallback[] = []
  private windCovCallbacks: WindCovCallback[] = []
  private aisVesselCallbacks: AisVesselCallback[] = []
  private gimbalManagerInfoCallbacks: GimbalManagerInfoCallback[] = []
  private gimbalManagerStatusCallbacks: GimbalManagerStatusCallback[] = []

  // Parameter cache (5min TTL) — avoids re-fetching when switching panels.
  // Safe because setParameter() invalidates via paramCache.delete(name).
  private paramCache = new Map<string, { value: number; timestamp: number }>()
  private static readonly PARAM_CACHE_TTL_MS = 300_000

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

  // Rally upload state (uses mission protocol with MISSION_TYPE_RALLY=2)
  private rallyUpload: {
    items: Array<{ lat: number; lon: number; alt: number }>
    resolve: (result: CommandResult) => void
    timer: ReturnType<typeof setTimeout>
  } | null = null

  // Rally download state
  private rallyDownload: {
    items: Map<number, { lat: number; lon: number; alt: number }>
    total: number
    resolve: (items: Array<{ lat: number; lon: number; alt: number }>) => void
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

    // PX4 auto-detects link type and adjusts telemetry rates — skip stream requests
    if (this.firmwareHandler?.firmwareType === 'px4') return

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

  // Diagnostic message name lookup (subset of known IDs)
  private static readonly MSG_NAMES: Record<number, string> = {
    0: 'HEARTBEAT', 1: 'SYS_STATUS', 2: 'SYSTEM_TIME', 22: 'PARAM_VALUE',
    24: 'GPS_RAW_INT', 26: 'SCALED_IMU', 27: 'RAW_IMU', 29: 'SCALED_PRESSURE',
    30: 'ATTITUDE', 32: 'LOCAL_POSITION_NED', 33: 'GLOBAL_POSITION_INT',
    35: 'RC_CHANNELS_RAW', 36: 'SERVO_OUTPUT_RAW', 39: 'MISSION_ITEM',
    42: 'MISSION_CURRENT', 44: 'MISSION_COUNT', 46: 'MISSION_ITEM_REACHED',
    47: 'MISSION_ACK', 51: 'MISSION_REQUEST', 62: 'NAV_CONTROLLER_OUTPUT',
    65: 'RC_CHANNELS', 70: 'RC_CHANNELS_OVERRIDE', 73: 'MISSION_ITEM_INT',
    74: 'VFR_HUD', 76: 'COMMAND_LONG', 77: 'COMMAND_ACK', 109: 'RADIO_STATUS',
    118: 'LOG_ENTRY', 120: 'LOG_DATA', 125: 'POWER_STATUS', 126: 'SERIAL_CONTROL',
    132: 'DISTANCE_SENSOR', 136: 'TERRAIN_REPORT', 141: 'ALTITUDE',
    147: 'BATTERY_STATUS', 148: 'AUTOPILOT_VERSION', 160: 'FENCE_POINT',
    162: 'FENCE_STATUS', 168: 'WIND', 191: 'MAG_CAL_PROGRESS',
    192: 'MAG_CAL_REPORT', 230: 'ESTIMATOR_STATUS', 231: 'WIND_COV',
    241: 'VIBRATION', 242: 'HOME_POSITION', 245: 'EXTENDED_SYS_STATE',
    246: 'AIS_VESSEL', 251: 'NAMED_VALUE_FLOAT', 252: 'NAMED_VALUE_INT',
    253: 'STATUSTEXT', 254: 'DEBUG', 263: 'CAMERA_IMAGE_CAPTURED',
    284: 'GIMBAL_DEVICE_ATTITUDE_STATUS', 285: 'GIMBAL_MANAGER_INFORMATION',
    286: 'GIMBAL_MANAGER_STATUS', 330: 'OBSTACLE_DISTANCE',
    112: 'CAMERA_TRIGGER', 335: 'EKF_STATUS_REPORT',
  }

  private handleFrame(frame: MAVLinkFrame): void {
    const startTime = performance.now()
    const p = frame.payload

    // Log to diagnostics store (performance tracking)
    const diag = useDiagnosticsStore.getState()
    diag.recordParseEvent()

    // Build hex string for frame inspector (only keep for last few frames — perf-safe)
    const msgName = MAVLinkAdapter.MSG_NAMES[frame.msgId] ?? `MSG_${frame.msgId}`
    const payloadBytes = new Uint8Array(p.buffer, p.byteOffset, p.byteLength)
    const rawHex = Array.from(payloadBytes.slice(0, 32))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ')
      + (payloadBytes.length > 32 ? ' ...' : '')

    diag.logMessage(frame.msgId, msgName, 'in', p.byteLength, rawHex)

    switch (frame.msgId) {
      // Core / stateful handlers (remain in adapter)
      case 0:   this.handleHeartbeat(frame); break
      case 22:  this.handleParamValue(frame); break
      case 77:  this.handleCommandAck(frame); break
      case 44:  this.handleMissionCountResponse(frame); break
      case 47:  this.handleMissionAck(frame); break
      case 51:  this.handleMissionRequest(frame); break
      case 73:  this.handleMissionItemIntResponse(frame); break
      case 118: this.handleLogEntry(frame); break
      case 120: this.handleLogData(frame); break
      case 148: this.handleAutopilotVersion(frame); break

      // Telemetry handlers
      case 1:   handleSysStatus(p, this.sysStatusCallbacks); break
      case 24:  handleGpsRaw(p, this.gpsCallbacks); break
      case 26:  handleScaledImu(p, this.scaledImuCallbacks); break
      case 27:  handleRawImu(p, this.rawImuCallbacks); break
      case 29:  handleScaledPressure(p, this.scaledPressureCallbacks); break
      case 30:  handleAttitude(p, this.attitudeCallbacks); break
      case 32:  handleLocalPosition(p, this.localPositionCallbacks); break
      case 33:  handleGlobalPosition(p, this.positionCallbacks); break
      case 35:  handleRcChannelsRaw(p, this.rcChannelsRawCallbacks); break
      case 65:  handleRcChannels(p, this.rcCallbacks); break
      case 70:  handleRcChannelsOverride(p, this.rcChannelsOverrideCallbacks); break
      case 74:  handleVfrHud(p, this.vfrCallbacks); break
      case 109: handleRadioStatus(p, this.radioCallbacks); break
      case 125: handlePowerStatus(p, this.powerStatusCallbacks); break
      case 141: handleAltitude(p, this.altitudeCallbacks); break
      case 147: handleBattery(p, this.batteryCallbacks); break

      // Nav-safety handlers
      case 36:  handleServoOutput(p, this.servoOutputCallbacks); break
      case 39:  handleMissionItemLegacy(p, this.missionItemCallbacks); break
      case 42:  handleMissionCurrent(p, this.missionProgressCallbacks); break
      case 46:  handleMissionItemReached(p, this.missionProgressCallbacks); break
      case 62:  handleNavControllerOutput(p, this.navControllerCallbacks); break
      case 132: handleDistanceSensor(p, this.distanceSensorCallbacks); break
      case 136: handleTerrainReport(p, this.terrainCallbacks); break
      case 160: handleFencePoint(p, this.fencePointCallbacks); break
      case 162: handleFenceStatus(p, this.fenceStatusCallbacks); break
      case 168: handleWind(p, this.windCallbacks); break
      case 231: handleWindCov(p, this.windCovCallbacks); break
      case 241: handleVibration(p, this.vibrationCallbacks); break
      case 242: handleHomePosition(p, this.homePositionCallbacks); break
      case 335: handleEkfStatus(p, this.ekfCallbacks); break

      // Estimator
      case 230: handleEstimatorStatus(p, this.estimatorStatusCallbacks); break

      // Calibration handlers
      case 76:  handleIncomingCommandLong(p, this.accelCalPosCallbacks); break
      case 191: handleMagCalProgress(p, this.magCalProgressCallbacks); break
      case 192: handleMagCalReport(p, this.magCalReportCallbacks); break

      // Info handlers
      case 2:   handleSystemTime(p, this.systemTimeCallbacks); break
      case 126: handleSerialControl(p, this.serialDataCallbacks); break
      case 245: handleExtendedSysState(p, this.extendedSysStateCallbacks); break
      case 253: handleStatusText(p, this.statusTextCallbacks); break

      // Debug / peripheral handlers
      case 112: handleCameraTrigger(p, this.cameraTriggerCallbacks); break
      case 251: handleNamedValueFloat(p, this.debugCallbacks); break
      case 252: handleNamedValueInt(p, this.debugCallbacks); break
      case 254: handleDebugValue(p, this.debugCallbacks); break
      case 246: handleAisVessel(p, this.aisVesselCallbacks); break
      case 263: handleCameraImageCaptured(p, this.cameraImageCallbacks); break
      case 284: handleGimbalAttitude(p, this.gimbalAttitudeCallbacks); break
      case 285: handleGimbalManagerInfo(p, this.gimbalManagerInfoCallbacks); break
      case 286: handleGimbalManagerStatus(p, this.gimbalManagerStatusCallbacks); break
      case 330: handleObstacleDistance(p, this.obstacleDistanceCallbacks); break
    }

    // Record frame processing time for performance metrics
    const elapsed = performance.now() - startTime
    diag.recordFrameProcessingTime(elapsed)
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

  private handleCommandAck(frame: MAVLinkFrame): void {
    const ack = decodeCommandAck(frame.payload)
    console.debug(`[MAVLink] COMMAND_ACK: cmd=${ack.command} result=${ack.result}`)
    this.commandQueue.handleAck(ack.command, ack.result)
  }

  private handleParamValue(frame: MAVLinkFrame): void {
    const pv = decodeParamValue(frame.payload)
    const canonicalName = this.firmwareHandler?.reverseMapParameterName(pv.paramId) ?? pv.paramId
    const param: ParameterValue = {
      name: canonicalName,
      value: pv.paramValue,
      type: pv.paramType,
      index: pv.paramIndex,
      count: pv.paramCount,
    }

    // Notify subscribers
    for (const cb of this.parameterCallbacks) cb(param)

    // Seed paramCache from every PARAM_VALUE — getAllParameters() warms cache for all panels
    this.paramCache.set(canonicalName, { value: pv.paramValue, timestamp: Date.now() })

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

  private handleMissionAck(frame: MAVLinkFrame): void {
    const ack = decodeMissionAck(frame.payload)

    // Route rally ACKs to rally state machine
    if (ack.missionType === 2 && this.rallyUpload) {
      clearTimeout(this.rallyUpload.timer)
      this.rallyUpload.resolve({
        success: ack.type === 0,
        resultCode: ack.type,
        message: ack.type === 0 ? 'Rally points accepted' : `Rally points rejected: type ${ack.type}`,
      })
      this.rallyUpload = null
      return
    }

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

    // Route rally requests to rally state machine
    if (req.missionType === 2 && this.rallyUpload && req.seq < this.rallyUpload.items.length) {
      const pt = this.rallyUpload.items[req.seq]
      // Rally points use MAV_CMD_NAV_RALLY_POINT (5100), frame=GLOBAL_RELATIVE_ALT_INT (6)
      const encoded = encodeMissionItemInt(
        this.targetSysId, this.targetCompId,
        req.seq, 6, 5100, 0, 0,
        0, 0, 0, 0,
        Math.round(pt.lat * 1e7), Math.round(pt.lon * 1e7), pt.alt,
        this.sysId, this.compId,
        2, // MISSION_TYPE_RALLY
      )
      this.transport?.send(encoded)
      return
    }

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

  private handleMissionCountResponse(frame: MAVLinkFrame): void {
    const data = decodeMissionCount(frame.payload)

    // Route rally count responses to rally state machine
    if (data.missionType === 2 && this.rallyDownload) {
      this.rallyDownload.total = data.count
      if (data.count === 0) {
        clearTimeout(this.rallyDownload.timer)
        this.rallyDownload.resolve([])
        this.rallyDownload = null
        return
      }
      this.transport?.send(encodeMissionRequestInt(
        this.targetSysId, this.targetCompId, 0,
        this.sysId, this.compId, 2,
      ))
      return
    }

    if (!this.missionDownload) return
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
    const data = decodeMissionItemIntMsg(frame.payload)

    // Route rally item responses to rally state machine
    if (data.missionType === 2 && this.rallyDownload) {
      this.rallyDownload.items.set(data.seq, {
        lat: data.x / 1e7,
        lon: data.y / 1e7,
        alt: data.z,
      })

      if (this.rallyDownload.items.size >= this.rallyDownload.total) {
        clearTimeout(this.rallyDownload.timer)
        const items = Array.from(this.rallyDownload.items.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, pt]) => pt)
        this.transport?.send(encodeMissionAck(
          this.targetSysId, this.targetCompId, 0,
          this.sysId, this.compId, 2,
        ))
        this.rallyDownload.resolve(items)
        this.rallyDownload = null
      } else {
        const nextSeq = data.seq + 1
        this.transport?.send(encodeMissionRequestInt(
          this.targetSysId, this.targetCompId, nextSeq,
          this.sysId, this.compId, 2,
        ))
      }
      return
    }

    if (!this.missionDownload) return
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

  private handleAutopilotVersion(frame: MAVLinkFrame): void {
    const data = handleAutopilotVersionMsg(frame.payload, this.autopilotVersionCallbacks)

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

  getCachedParameterNames(): string[] {
    return Array.from(this.paramCache.keys())
  }

  async getParameter(name: string): Promise<ParameterValue> {
    if (!this.transport?.isConnected) {
      return Promise.reject(new Error('Not connected'))
    }

    const firmwareName = this.firmwareHandler?.mapParameterName(name) ?? name

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
        if (param.name === firmwareName) {
          clearTimeout(timer)
          unsub()
          // Populate cache on successful read
          this.paramCache.set(name, { value: param.value, timestamp: Date.now() })
          resolve({ ...param, name })
        }
      })

      // PARAM_REQUEST_READ: paramIndex=-1 means use name instead of index
      this.transport!.send(encodeParamRequestRead(
        this.targetSysId, this.targetCompId,
        firmwareName, -1,
        this.sysId, this.compId,
      ))
    })
  }

  async setParameter(name: string, value: number, type = 9): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

    const firmwareName = this.firmwareHandler?.mapParameterName(name) ?? name

    // Invalidate cache for this param
    this.paramCache.delete(name)

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        resolve({ success: false, resultCode: -1, message: `Param set timed out: ${name}` })
      }, 3000)

      // Listen for PARAM_VALUE echo as confirmation
      const unsub = this.onParameter((param) => {
        if (param.name === firmwareName) {
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

      // PX4 integer param types need byte-wise encoding: write int as Int32, read same bytes as Float32
      // This is because PX4 uses a memcpy pattern for integer params over MAVLink
      let encodedValue = value
      if (this.firmwareHandler?.firmwareType === 'px4' && type !== 9) {
        // paramType 6=INT32, 4=INT16, 2=INT8
        const tmp = new DataView(new ArrayBuffer(4))
        tmp.setInt32(0, Math.round(value), true)
        encodedValue = tmp.getFloat32(0, true)
      }

      this.transport!.send(encodeParamSet(this.targetSysId, this.targetCompId, firmwareName, encodedValue, type, this.sysId, this.compId))
    })
  }

  // ── Mission ────────────────────────────────────────────

  // Note: PX4 doesn't support MISSION_WRITE_PARTIAL_LIST -- always send full mission.
  // Current implementation already sends full mission list via MISSION_COUNT handshake,
  // so no PX4-specific change needed.

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
      if (this.firmwareHandler?.firmwareType === 'px4') {
        // PX4 uses PREFLIGHT_CALIBRATION (241) with param2=1 for mag cal
        // Progress reported via STATUSTEXT [cal] messages
        return this.sendCommandLong(241, [0, 1, 0, 0, 0, 0, 0], 120000)
      }
      // ArduPilot uses MAV_CMD_DO_START_MAG_CAL (42424), not PREFLIGHT_CALIBRATION
      // param1=0 (all compasses), param2=1 (retry on failure), param3=0 (no autosave — requires DO_ACCEPT_MAG_CAL), param4=2 (2s delay)
      return this.sendCommandLong(42424, [0, 1, 0, 2, 0, 0, 0], 30000)
    }

    // RC calibration is a multi-step parameter-based workflow, not a single command
    if (type === 'rc') {
      return { success: true, resultCode: 0, message: 'RC calibration ready — follow on-screen instructions' }
    }

    // CompassMot uses MAV_CMD_PREFLIGHT_CALIBRATION (241) with param6=1
    // ArduPilot: GCS_Common.cpp handles param6==1 as compass motor interference calibration
    if (type === 'compassmot') {
      return this.sendCommandLong(241, [0, 0, 0, 0, 0, 1, 0], 120000) // param6=1 for compassmot
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

  async startGnssMagCal(): Promise<CommandResult> {
    // MAV_CMD_FIXED_MAG_CAL_YAW (42006) — PX4 only
    // Uses GPS heading to calibrate compass yaw offset
    // param1=0 (yaw angle, 0=auto from GPS), param2=0 (compass mask, 0=all)
    return this.sendCommandLong(42006, [0, 0, 0, 0, 0, 0, 0])
  }

  async sendCommand(commandId: number, params: number[]): Promise<CommandResult> {
    const p: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0]
    for (let i = 0; i < Math.min(7, params.length); i++) {
      p[i] = params[i]
    }
    return this.sendCommandLong(commandId, p)
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
    // PX4 uses EKF origin for home position — only current position supported
    if (!useCurrent && this.firmwareHandler?.firmwareType === 'px4') {
      return { success: false, resultCode: 4, message: 'PX4 uses EKF origin for home position — only "use current" is supported' }
    }

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

  async setGimbalMode(mode: number): Promise<CommandResult> {
    // MAV_CMD_DO_MOUNT_CONFIGURE (204): param1=mount_mode
    // 0=Retract, 1=Neutral, 2=MAVLink targeting, 3=RC targeting, 4=GPS point, 5=SysID, 6=Home
    return this.sendCommandLong(204, [mode, 0, 0, 0, 0, 0, 0])
  }

  async doPreArmCheck(): Promise<CommandResult> {
    return this.sendCommandLong(401, [0, 0, 0, 0, 0, 0, 0])
  }

  // ── DO_FENCE_ENABLE (217) ──────────────────────────────
  async enableFence(enable: boolean): Promise<CommandResult> {
    return this.sendCommandLong(217, [enable ? 1 : 0, 0, 0, 0, 0, 0, 0])
  }

  // ── DO_LAND_START (189) ────────────────────────────────
  async doLandStart(): Promise<CommandResult> {
    return this.sendCommandLong(189, [0, 0, 0, 0, 0, 0, 0])
  }

  // ── DO_CONTROL_VIDEO (200) ─────────────────────────────
  async controlVideo(params: { cameraId: number; transmission: number; channel: number; recording: number }): Promise<CommandResult> {
    return this.sendCommandLong(200, [params.cameraId, params.transmission, params.channel, params.recording, 0, 0, 0])
  }

  // ── DO_SET_RELAY (186) ─────────────────────────────────
  async setRelay(relayNum: number, on: boolean): Promise<CommandResult> {
    return this.sendCommandLong(186, [relayNum, on ? 1 : 0, 0, 0, 0, 0, 0])
  }

  // ── START_RX_PAIR (243) ────────────────────────────────
  async startRxPair(spektrum: number): Promise<CommandResult> {
    return this.sendCommandLong(243, [spektrum, 0, 0, 0, 0, 0, 0])
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
  onScaledPressure(cb: ScaledPressureCallback): () => void {
    this.scaledPressureCallbacks.push(cb)
    return () => { this.scaledPressureCallbacks = this.scaledPressureCallbacks.filter(c => c !== cb) }
  }
  onEstimatorStatus(cb: EstimatorStatusCallback): () => void {
    this.estimatorStatusCallbacks.push(cb)
    return () => { this.estimatorStatusCallbacks = this.estimatorStatusCallbacks.filter(c => c !== cb) }
  }
  onCameraTrigger(cb: CameraTriggerCallback): () => void {
    this.cameraTriggerCallbacks.push(cb)
    return () => { this.cameraTriggerCallbacks = this.cameraTriggerCallbacks.filter(c => c !== cb) }
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
  onRawImu(cb: RawImuCallback): () => void {
    this.rawImuCallbacks.push(cb)
    return () => { this.rawImuCallbacks = this.rawImuCallbacks.filter(c => c !== cb) }
  }
  onRcChannelsRaw(cb: RcChannelsRawCallback): () => void {
    this.rcChannelsRawCallbacks.push(cb)
    return () => { this.rcChannelsRawCallbacks = this.rcChannelsRawCallbacks.filter(c => c !== cb) }
  }
  onRcChannelsOverride(cb: RcChannelsOverrideCallback): () => void {
    this.rcChannelsOverrideCallbacks.push(cb)
    return () => { this.rcChannelsOverrideCallbacks = this.rcChannelsOverrideCallbacks.filter(c => c !== cb) }
  }
  onMissionItem(cb: MissionItemCallback): () => void {
    this.missionItemCallbacks.push(cb)
    return () => { this.missionItemCallbacks = this.missionItemCallbacks.filter(c => c !== cb) }
  }
  onAltitude(cb: AltitudeCallback): () => void {
    this.altitudeCallbacks.push(cb)
    return () => { this.altitudeCallbacks = this.altitudeCallbacks.filter(c => c !== cb) }
  }
  onWindCov(cb: WindCovCallback): () => void {
    this.windCovCallbacks.push(cb)
    return () => { this.windCovCallbacks = this.windCovCallbacks.filter(c => c !== cb) }
  }
  onAisVessel(cb: AisVesselCallback): () => void {
    this.aisVesselCallbacks.push(cb)
    return () => { this.aisVesselCallbacks = this.aisVesselCallbacks.filter(c => c !== cb) }
  }
  onGimbalManagerInfo(cb: GimbalManagerInfoCallback): () => void {
    this.gimbalManagerInfoCallbacks.push(cb)
    return () => { this.gimbalManagerInfoCallbacks = this.gimbalManagerInfoCallbacks.filter(c => c !== cb) }
  }
  onGimbalManagerStatus(cb: GimbalManagerStatusCallback): () => void {
    this.gimbalManagerStatusCallbacks.push(cb)
    return () => { this.gimbalManagerStatusCallbacks = this.gimbalManagerStatusCallbacks.filter(c => c !== cb) }
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

    // Read FENCE_TOTAL param to know how many points to fetch
    let fenceTotal: number
    try {
      const result = await this.getParameter('FENCE_TOTAL')
      fenceTotal = result.value
    } catch {
      return [] // param doesn't exist or read failed
    }

    if (fenceTotal <= 0) return []

    // Collect incoming FENCE_POINT responses
    const points: Array<{ idx: number; lat: number; lon: number }> = []
    const received = new Set<number>()

    return new Promise<Array<{ idx: number; lat: number; lon: number }>>((resolve) => {
      const timeout = setTimeout(() => {
        unsub()
        // Return whatever we collected
        points.sort((a, b) => a.idx - b.idx)
        resolve(points)
      }, 10000) // 10s overall timeout

      const unsub = this.onFencePoint((data) => {
        if (!received.has(data.idx)) {
          received.add(data.idx)
          points.push({ idx: data.idx, lat: data.lat, lon: data.lon })
        }
        if (received.size >= fenceTotal) {
          clearTimeout(timeout)
          unsub()
          points.sort((a, b) => a.idx - b.idx)
          resolve(points)
        }
      })

      // Request each fence point
      for (let i = 0; i < fenceTotal; i++) {
        this.transport!.send(encodeFenceFetchPoint(
          this.targetSysId, this.targetCompId,
          i, this.sysId, this.compId,
        ))
      }
    })
  }

  // ── Rally Point Operations ──────────────────────────

  async uploadRallyPoints(points: Array<{ lat: number; lon: number; alt: number }>): Promise<CommandResult> {
    if (!this.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }
    if (points.length === 0) return { success: true, resultCode: 0, message: 'No rally points to upload' }

    return new Promise<CommandResult>((resolve) => {
      const timer = setTimeout(() => {
        this.rallyUpload = null
        resolve({ success: false, resultCode: -1, message: 'Rally point upload timed out' })
      }, 15000)

      this.rallyUpload = { items: points, resolve, timer }

      // Send MISSION_COUNT with MISSION_TYPE_RALLY (2) to initiate upload
      this.transport!.send(encodeMissionCount(
        this.targetSysId, this.targetCompId, points.length,
        this.sysId, this.compId, 2,
      ))
    })
  }

  async downloadRallyPoints(): Promise<Array<{ lat: number; lon: number; alt: number }>> {
    if (!this.transport?.isConnected) return []

    return new Promise<Array<{ lat: number; lon: number; alt: number }>>((resolve) => {
      const timer = setTimeout(() => {
        if (this.rallyDownload) {
          const items = Array.from(this.rallyDownload.items.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, pt]) => pt)
          this.rallyDownload = null
          resolve(items)
        } else {
          resolve([])
        }
      }, 15000)

      this.rallyDownload = {
        items: new Map(),
        total: 0,
        resolve,
        timer,
      }

      // Send MISSION_REQUEST_LIST with MISSION_TYPE_RALLY (2)
      this.transport!.send(encodeMissionRequestList(
        this.targetSysId, this.targetCompId,
        this.sysId, this.compId, 2,
      ))
    })
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
    // CompassMot: PREFLIGHT_CALIBRATION(241) param6=1
    return this.sendCommandLong(241, [0, 0, 0, 0, 0, 1, 0], 120000)
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

  /** Expose command queue for diagnostics display */
  getCommandQueueSnapshot(): { pendingCount: number; entries: { command: number; retryCount: number; timestamp: number }[] } {
    return {
      pendingCount: this.commandQueue.pendingCount,
      entries: this.commandQueue.getSnapshot(),
    }
  }

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
