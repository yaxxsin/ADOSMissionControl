/**
 * MAVLink adapter — mission, rally, and fence protocol methods.
 *
 * Upload/download missions, rally points, fence points, and clear.
 *
 * @module protocol/mavlink-adapter-missions
 */

import type { Transport, CommandResult, MissionItem, FirmwareHandler, FencePointCallback, ParameterCallback } from './types'
import {
  encodeMissionCount, encodeMissionRequestList, encodeMissionClearAll,
  encodeFencePoint, encodeFenceFetchPoint,
  encodeMissionRequestInt,
} from './mavlink-encoder'

export interface MissionUploadState {
  items: MissionItem[]
  resolve: (result: CommandResult) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface MissionDownloadState {
  items: Map<number, MissionItem>
  total: number
  resolve: (items: MissionItem[]) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export interface RallyUploadState {
  items: Array<{ lat: number; lon: number; alt: number }>
  resolve: (result: CommandResult) => void
  timer: ReturnType<typeof setTimeout>
}

export interface RallyDownloadState {
  items: Map<number, { lat: number; lon: number; alt: number }>
  total: number
  resolve: (items: Array<{ lat: number; lon: number; alt: number }>) => void
  timer: ReturnType<typeof setTimeout>
}

export interface MissionContext {
  transport: Transport | null
  firmwareHandler: FirmwareHandler | null
  targetSysId: number
  targetCompId: number
  sysId: number
  compId: number
  missionUpload: MissionUploadState | null
  missionDownload: MissionDownloadState | null
  rallyUpload: RallyUploadState | null
  rallyDownload: RallyDownloadState | null
  sendCommandLong: (command: number, params: [number, number, number, number, number, number, number], timeoutMs?: number) => Promise<CommandResult>
  onParameter: (cb: ParameterCallback) => () => void
  onFencePoint: (cb: FencePointCallback) => () => void
  getParameter: (name: string) => Promise<{ value: number }>
}

export async function uploadMission(ctx: MissionContext, items: MissionItem[]): Promise<CommandResult> {
  if (!ctx.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

  return new Promise<CommandResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      ctx.missionUpload = null
      resolve({ success: false, resultCode: -1, message: 'Mission upload timed out' })
    }, 15000)

    ctx.missionUpload = { items, resolve, reject, timer }
    ctx.transport!.send(encodeMissionCount(ctx.targetSysId, ctx.targetCompId, items.length, ctx.sysId, ctx.compId))
  })
}

export async function downloadMission(ctx: MissionContext): Promise<MissionItem[]> {
  if (!ctx.transport?.isConnected) throw new Error('Not connected')

  return new Promise<MissionItem[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (ctx.missionDownload) {
        const items = Array.from(ctx.missionDownload.items.values()).sort((a, b) => a.seq - b.seq)
        ctx.missionDownload = null
        resolve(items)
      }
    }, 15000)

    ctx.missionDownload = { items: new Map(), total: 0, resolve, reject, timer }
    ctx.transport!.send(encodeMissionRequestList(ctx.targetSysId, ctx.targetCompId, ctx.sysId, ctx.compId))
  })
}

export async function setCurrentMissionItem(ctx: MissionContext, seq: number): Promise<CommandResult> {
  return ctx.sendCommandLong(224, [seq, 0, 0, 0, 0, 0, 0])
}

export async function clearMission(ctx: MissionContext): Promise<CommandResult> {
  if (!ctx.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }

  return new Promise<CommandResult>((resolve) => {
    const timer = setTimeout(() => {
      resolve({ success: false, resultCode: -1, message: 'Mission clear timed out' })
      ctx.missionUpload = null
    }, 5000)

    ctx.missionUpload = {
      items: [],
      resolve,
      reject: () => resolve({ success: false, resultCode: -1, message: 'Mission clear failed' }),
      timer,
    }

    ctx.transport!.send(encodeMissionClearAll(ctx.targetSysId, ctx.targetCompId, ctx.sysId, ctx.compId))
  })
}

export async function uploadFence(ctx: MissionContext, points: Array<{ lat: number; lon: number }>): Promise<CommandResult> {
  if (!ctx.transport?.isConnected) {
    return { success: false, resultCode: -1, message: 'Not connected' }
  }
  for (let i = 0; i < points.length; i++) {
    ctx.transport.send(encodeFencePoint(
      ctx.targetSysId, ctx.targetCompId,
      i, points.length, points[i].lat, points[i].lon,
      ctx.sysId, ctx.compId,
    ))
  }
  return { success: true, resultCode: 0, message: `Uploaded ${points.length} fence points` }
}

export async function downloadFence(ctx: MissionContext): Promise<Array<{ idx: number; lat: number; lon: number }>> {
  if (!ctx.transport?.isConnected) return []

  let fenceTotal: number
  try {
    const result = await ctx.getParameter('FENCE_TOTAL')
    fenceTotal = result.value
  } catch {
    return []
  }

  if (fenceTotal <= 0) return []

  const points: Array<{ idx: number; lat: number; lon: number }> = []
  const received = new Set<number>()

  return new Promise<Array<{ idx: number; lat: number; lon: number }>>((resolve) => {
    const timeout = setTimeout(() => {
      unsub()
      points.sort((a, b) => a.idx - b.idx)
      resolve(points)
    }, 10000)

    const unsub = ctx.onFencePoint((data) => {
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

    for (let i = 0; i < fenceTotal; i++) {
      ctx.transport!.send(encodeFenceFetchPoint(
        ctx.targetSysId, ctx.targetCompId,
        i, ctx.sysId, ctx.compId,
      ))
    }
  })
}

export async function uploadRallyPoints(ctx: MissionContext, points: Array<{ lat: number; lon: number; alt: number }>): Promise<CommandResult> {
  if (!ctx.transport?.isConnected) return { success: false, resultCode: -1, message: 'Not connected' }
  if (points.length === 0) return { success: true, resultCode: 0, message: 'No rally points to upload' }

  return new Promise<CommandResult>((resolve) => {
    const timer = setTimeout(() => {
      ctx.rallyUpload = null
      resolve({ success: false, resultCode: -1, message: 'Rally point upload timed out' })
    }, 15000)

    ctx.rallyUpload = { items: points, resolve, timer }
    ctx.transport!.send(encodeMissionCount(
      ctx.targetSysId, ctx.targetCompId, points.length,
      ctx.sysId, ctx.compId, 2,
    ))
  })
}

export async function downloadRallyPoints(ctx: MissionContext): Promise<Array<{ lat: number; lon: number; alt: number }>> {
  if (!ctx.transport?.isConnected) return []

  return new Promise<Array<{ lat: number; lon: number; alt: number }>>((resolve) => {
    const timer = setTimeout(() => {
      if (ctx.rallyDownload) {
        const items = Array.from(ctx.rallyDownload.items.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([, pt]) => pt)
        ctx.rallyDownload = null
        resolve(items)
      } else {
        resolve([])
      }
    }, 15000)

    ctx.rallyDownload = { items: new Map(), total: 0, resolve, timer }
    ctx.transport!.send(encodeMissionRequestList(
      ctx.targetSysId, ctx.targetCompId,
      ctx.sysId, ctx.compId, 2,
    ))
  })
}
