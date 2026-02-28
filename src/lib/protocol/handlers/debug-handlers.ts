/**
 * Debug, camera, gimbal, and obstacle message handlers.
 * Each function decodes a MAVLink payload and dispatches to subscriber callbacks.
 *
 * @module protocol/handlers/debug-handlers
 */

import type {
  DebugCallback, CameraImageCapturedCallback,
  GimbalAttitudeCallback, ObstacleDistanceCallback,
} from '../types'
import {
  decodeNamedValueFloat, decodeNamedValueInt, decodeDebug,
  decodeCameraImageCaptured, decodeGimbalDeviceAttitudeStatus,
  decodeObstacleDistance,
} from '../mavlink-messages'

export function handleNamedValueFloat(payload: DataView, callbacks: DebugCallback[]): void {
  const data = decodeNamedValueFloat(payload)
  for (const cb of callbacks) {
    cb({ timestamp: Date.now(), name: data.name, value: data.value, type: "float" })
  }
}

export function handleNamedValueInt(payload: DataView, callbacks: DebugCallback[]): void {
  const data = decodeNamedValueInt(payload)
  for (const cb of callbacks) {
    cb({ timestamp: Date.now(), name: data.name, value: data.value, type: "int" })
  }
}

export function handleDebugValue(payload: DataView, callbacks: DebugCallback[]): void {
  const data = decodeDebug(payload)
  for (const cb of callbacks) {
    cb({ timestamp: Date.now(), name: `debug[${data.ind}]`, value: data.value, type: "debug" })
  }
}

export function handleCameraImageCaptured(payload: DataView, callbacks: CameraImageCapturedCallback[]): void {
  const data = decodeCameraImageCaptured(payload)
  for (const cb of callbacks) {
    cb({
      timestamp: Date.now(),
      lat: data.lat, lon: data.lon, alt: data.alt,
      imageIndex: data.imageIndex,
      captureResult: data.captureResult,
      fileUrl: "",
    })
  }
}

export function handleGimbalAttitude(payload: DataView, callbacks: GimbalAttitudeCallback[]): void {
  const data = decodeGimbalDeviceAttitudeStatus(payload)
  // Convert quaternion to Euler angles (simplified)
  const [w, x, y, z] = data.q
  const roll = Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y))
  const pitch = Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x))))
  const yaw = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z))
  const RAD_TO_DEG = 180 / Math.PI
  for (const cb of callbacks) {
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

export function handleObstacleDistance(payload: DataView, callbacks: ObstacleDistanceCallback[]): void {
  const data = decodeObstacleDistance(payload)
  for (const cb of callbacks) {
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
