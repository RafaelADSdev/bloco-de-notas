import { useCallback, useEffect, useRef, useState } from 'react'
import { bitmap, encode } from './sketch-raster'

const fps = 12
const maxFrames = 360
const frameSize = 720

function videoType() {
  if (typeof MediaRecorder !== 'function' || typeof HTMLCanvasElement.prototype.captureStream !== 'function') return ''
  return ['video/webm;codecs=vp8', 'video/webm', 'video/mp4'].find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

async function encodeVideo(frames, width, height, mimeType) {
  const surface = bitmap(width, height)
  const ctx = surface.getContext('2d')
  const stream = surface.captureStream(fps)
  try {
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 1_700_000 })
    const parts = []
    const finished = new Promise((resolve) => {
      recorder.ondataavailable = ({ data }) => { if (data.size) parts.push(data) }
      recorder.onerror = () => resolve(null)
      recorder.onstop = () => resolve(new Blob(parts, { type: recorder.mimeType }))
    })
    recorder.start()
    try {
      for (const frame of [...frames, ...Array(6).fill(frames.at(-1))]) {
        const source = await createImageBitmap(frame)
        ctx.drawImage(source, 0, 0, width, height)
        source.close()
        await new Promise((resolve) => setTimeout(resolve, 1000 / fps))
      }
    } finally {
      if (recorder.state !== 'inactive') recorder.stop()
    }
    const video = await finished
    if (!video?.size) throw new Error('A gravação não gerou um vídeo.')
    return video
  } finally {
    stream.getTracks().forEach((track) => track.stop())
    surface.width = 0
  }
}

export function useSketchRecording() {
  const [mimeType] = useState(videoType)
  const [recording, setRecording] = useState(false)
  const latest = useRef(null)
  const session = useRef(null)

  useEffect(() => () => {
    if (session.current) session.current.canvas.width = 0
  }, [])

  const recordFrame = useCallback((source, frame, force = false) => {
    latest.current = { source, frame }
    const current = session.current
    if (!current) return
    if (current.frames.length === maxFrames) {
      current.frames = current.frames.filter((_, index) => index % 2 === 0)
      current.stride *= 2
    }
    if (!force && current.next++ % current.stride !== 0) return
    const { canvas, frames } = current
    const x = Math.min(canvas.width / frame.width, canvas.height / frame.height)
    const width = Math.round(frame.width * x), height = Math.round(frame.height * x)
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fffefa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(source, frame.x, frame.y, frame.width, frame.height, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height)
    frames.push(encode(canvas, 'image/webp', .72).catch(() => null))
  }, [])

  function start() {
    if (!mimeType || !latest.current) return false
    const { source, frame } = latest.current
    const scale = Math.min(1, frameSize / Math.max(frame.width, frame.height))
    const even = (value) => Math.max(2, Math.round(value / 2) * 2)
    session.current = { canvas: bitmap(even(frame.width * scale), even(frame.height * scale)), frames: [], next: 0, stride: 1 }
    recordFrame(source, frame)
    setRecording(true)
    return true
  }

  async function stop() {
    const current = session.current
    if (!current) return null
    if (current.next > 1 && current.stride > 1) recordFrame(latest.current.source, latest.current.frame, true)
    session.current = null
    setRecording(false)
    try {
      const frames = (await Promise.all(current.frames)).filter(Boolean)
      if (frames.length < 2) return null
      return await encodeVideo(frames, current.canvas.width, current.canvas.height, mimeType)
    } finally {
      current.canvas.width = 0
    }
  }

  return { supported: Boolean(mimeType), recording, recordFrame, start, stop }
}
