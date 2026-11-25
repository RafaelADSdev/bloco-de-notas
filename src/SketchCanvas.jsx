import { useLayoutEffect, useRef, useState } from 'react'
import { CircleHelp, Minus, Plus, RotateCw, Scan } from 'lucide-react'
import { IconButton } from './ui'
import { bounds, brushes, clamp, drawingFrame, inside, rectangle, shapes, symmetryMatrices, transformPoints } from './sketch-model'
import { captureRegion } from './sketch-raster'
import { SketchGuides } from './SketchGuides'
import { useSketchView } from './useSketchView'

function constrained(point, first, guide, frame) {
  if (guide === 'ruler') return { ...point, y: first.y }
  if (guide !== 'perspective') return point
  const dx = first.x - frame.x - frame.width / 2, dy = first.y - frame.y - frame.height / 2
  const length = dx * dx + dy * dy
  if (length < 1) return { ...point, y: first.y }
  const ratio = ((point.x - first.x) * dx + (point.y - first.y) * dy) / length
  return { ...point, x: first.x + ratio * dx, y: first.y + ratio * dy }
}

function pinch(touches, view) {
  const [a, b] = [...touches.values()]
  const x = b.clientX - a.clientX, y = b.clientY - a.clientY
  return {
    distance: Math.max(1, Math.hypot(x, y)), angle: Math.atan2(y, x),
    center: view.coordinate(a.clientX + x / 2, a.clientY + y / 2),
  }
}

export function SketchCanvas({ drawing, active, tool, settings, renderer, imageVersion, selection, setSelection, addOperation, pickColor, insertText, space, showHelp, status }) {
  const { width, height } = drawing
  const frame = drawingFrame(drawing)
  const view = useSketchView(frame.width, frame.height)
  const canvas = useRef(null)
  const gesture = useRef(null)
  const fingers = useRef(new Map())
  const pending = useRef(0)
  const draw = useRef(null)
  const [overlay, setOverlay] = useState(null)
  const [panning, setPanning] = useState(false)
  const editable = active.visible && !active.locked

  draw.current = () => {
    const current = gesture.current
    const draft = current?.operation ? current : null
    renderer.paint(canvas.current.getContext('2d', { willReadFrequently: true }), drawing, draft)
    setOverlay(current?.outline ?? null)
  }

  function refresh() {
    if (pending.current) return
    pending.current = requestAnimationFrame(() => {
      pending.current = 0
      draw.current()
    })
  }

  useLayoutEffect(() => {
    renderer.prepare(drawing.layers)
    renderer.prune(drawing.layers)
    draw.current()
  }, [drawing, imageVersion, renderer])

  useLayoutEffect(() => () => cancelAnimationFrame(pending.current), [])
  useLayoutEffect(() => view.reset(), [drawing.frame])

  function capture(event, state) {
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = { id: event.pointerId, ...state }
  }

  function absolutePoint(event) {
    const p = view.point(event)
    return { x: p.x + frame.x, y: p.y + frame.y }
  }

  function pointAt(event) {
    const p = absolutePoint(event)
    return { x: clamp(p.x, frame.x, frame.x + frame.width), y: clamp(p.y, frame.y, frame.y + frame.height) }
  }

  function pressure(event) {
    if (event.pointerType !== 'pen' || !settings.pressure) return undefined
    return .22 + clamp(event.pressure || .5, .02, 1) * .78
  }

  function start(event) {
    if (event.button !== 0 && event.button !== 1) return
    if (event.pointerType !== 'touch' && gesture.current?.id === event.pointerId) {
      gesture.current = null
      setPanning(false)
      refresh()
    }
    if (event.pointerType === 'touch') {
      if (fingers.current.size >= 2) return
      fingers.current.set(event.pointerId, event)
      event.currentTarget.setPointerCapture(event.pointerId)
      if (fingers.current.size === 2 && (!gesture.current || gesture.current.touch)) {
        capture(event, { type: 'pinch', start: pinch(fingers.current, view), view: view.latest.current })
        setPanning(true)
        refresh()
        return
      }
    }
    if (gesture.current || fingers.current.size > 1) return

    const touch = event.pointerType === 'touch'
    if (tool === 'hand' || space || event.button === 1 || (touch && settings.penOnly)) {
      event.preventDefault()
      capture(event, { type: 'pan', x: event.clientX, y: event.clientY, view: view.latest.current, touch })
      setPanning(true)
      return
    }

    const point = absolutePoint(event)
    if (point.x < frame.x || point.x >= frame.x + frame.width || point.y < frame.y || point.y >= frame.y + frame.height) return
    event.preventDefault()
    if (tool === 'sample') {
      draw.current()
      const color = canvas.current.getContext('2d').getImageData(Math.floor(point.x), Math.floor(point.y), 1, 1).data
      if (color[3]) pickColor('#' + [...color.slice(0, 3)].map((channel) => channel.toString(16).padStart(2, '0')).join(''))
      return
    }
    if (tool === 'text') return insertText(point)
    if (!editable) return
    const clip = selection ?? (drawing.frame ? rectangle(frame, { x: frame.x + frame.width, y: frame.y + frame.height }) : null)
    if (tool === 'fill') {
      addOperation(active.id, { kind: 'fill', point, color: settings.color, opacity: settings.opacity / 100, tolerance: settings.tolerance, clip })
      return
    }
    if (tool === 'select' || tool === 'lasso') {
      if (selection && inside(selection, point)) {
        const operation = { kind: 'region', points: selection, transform: {} }
        const captured = captureRegion(renderer.renderLayer(active), selection)
        capture(event, { type: 'transform', layer: active.id, point, operation, captured, outline: selection, touch })
      } else {
        capture(event, { type: tool, points: [point], outline: [], touch })
      }
      refresh()
      return
    }
    const operation = {
      kind: tool, color: settings.color, size: settings.size, opacity: settings.opacity / 100,
      points: [{ ...point, pressure: brushes[tool] ? pressure(event) : undefined }],
      matrices: symmetryMatrices(settings.symmetry, frame),
      filled: tool !== 'line' && settings.filled, clip,
    }
    capture(event, { type: 'stroke', layer: active.id, operation, touch })
    refresh()
  }

  function move(event, final = false) {
    if (fingers.current.has(event.pointerId)) fingers.current.set(event.pointerId, event)
    const current = gesture.current
    if (!current) return
    if (current.type === 'pinch') {
      if (fingers.current.size < 2) return
      const next = pinch(fingers.current, view), { start } = current
      view.adjust(current.view, current.view.zoom * next.distance / start.distance, current.view.angle + next.angle - start.angle, start.center, next.center)
      return
    }
    if (event.pointerId !== current.id) return
    if (!final && event.pointerType !== 'touch' && !event.buttons) return end(event, true)
    if (current.type === 'pan') {
      view.update({ ...current.view, x: current.view.x + event.clientX - current.x, y: current.view.y + event.clientY - current.y })
      return
    }

    const point = pointAt(event)
    if (current.type === 'transform') {
      const p = absolutePoint(event)
      current.operation.transform = { x: p.x - current.point.x, y: p.y - current.point.y }
      current.outline = transformPoints(current.operation.points, current.operation.transform)
    } else if (current.type === 'select') {
      current.outline = rectangle(current.points[0], point)
    } else if (current.type === 'lasso') {
      current.points.push(point)
      current.outline = current.points
    } else {
      const { operation } = current
      if (shapes.has(operation.kind) || settings.guide === 'ruler' || settings.guide === 'perspective') {
        const first = operation.points[0]
        const end = shapes.has(operation.kind) && operation.kind !== 'line' ? point : constrained(point, first, settings.guide, frame)
        operation.points = [{ ...first, pressure: undefined }, end]
      } else if (final) {
        const last = operation.points.at(-1)
        if (Math.hypot(point.x - last.x, point.y - last.y) > .25) operation.points.push({ ...point, pressure: last.pressure })
      } else {
        const events = event.nativeEvent?.getCoalescedEvents?.()
        for (const sample of events?.length ? events : [event]) {
          const next = pointAt(sample)
          const last = operation.points.at(-1)
          const ratio = 1 - settings.smoothing / 120
          operation.points.push({
            x: last.x + (next.x - last.x) * ratio,
            y: last.y + (next.y - last.y) * ratio,
            pressure: pressure(sample),
          })
        }
      }
    }
    refresh()
  }

  function end(event, cancelled = false) {
    fingers.current.delete(event.pointerId)
    const current = gesture.current
    if (!current || (event.pointerId !== current.id && current.type !== 'pinch')) return
    if (!cancelled && (current.type === 'select' || current.type === 'transform' || current.type === 'stroke')) move(event, true)
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setPanning(false)
    refresh()
    if (cancelled) return
    if (current.type === 'stroke') {
      if (shapes.has(current.operation.kind)) {
        const [a, b] = current.operation.points
        if (!b || Math.hypot(a.x - b.x, a.y - b.y) < 1) return
      }
      addOperation(current.layer, current.operation)
    } else if (current.type === 'transform') {
      const { x, y } = current.operation.transform
      if (Math.hypot(x, y) < 1) return
      addOperation(current.layer, current.operation)
      setSelection(current.outline)
    } else if (current.type === 'select' || current.type === 'lasso') {
      const points = current.outline
      const box = bounds(points)
      setSelection(points.length >= 3 && box.right - box.left > 2 && box.bottom - box.top > 2 ? points : null)
    }
  }

  const cursor = panning ? 'grabbing' : (space || tool === 'hand') ? 'grab' : tool === 'text' ? 'text' : 'crosshair'
  const canvasStyle = drawing.frame ? {
    width: `${width / frame.width * 100}%`, height: `${height / frame.height * 100}%`,
    left: `${-frame.x / frame.width * 100}%`, top: `${-frame.y / frame.height * 100}%`,
  } : undefined
  return <main className="studio-workspace">
    <div ref={view.viewport} className="studio-viewport" style={{ cursor }}
      onPointerDown={start} onPointerMove={move} onPointerUp={end}
      onPointerCancel={(event) => end(event, true)}>
      <div className="studio-sheet" style={view.style}>
        <canvas ref={canvas} width={width} height={height} style={canvasStyle} aria-label="Área de desenho" />
        <SketchGuides frame={frame} guide={settings.guide} symmetry={settings.symmetry} selection={overlay ?? selection} />
      </div>
    </div>
    <div className="studio-viewbar">
      <div className="studio-view-status"><span>{frame.width} × {frame.height} px</span>{status && <span role="status">{status}</span>}</div>
      <div className="studio-zoom" role="group" aria-label="Visualização da tela">
        <IconButton label="Girar visualização" onClick={view.rotate}><RotateCw size={15} /></IconButton>
        <IconButton label="Diminuir zoom" disabled={view.view.zoom <= .25} onClick={() => view.zoom(.8)}><Minus size={16} /></IconButton>
        <output aria-label="Zoom">{Math.round(view.view.zoom * 100)}%</output>
        <IconButton label="Aumentar zoom" disabled={view.view.zoom >= 8} onClick={() => view.zoom(1.25)}><Plus size={16} /></IconButton>
        <IconButton label="Enquadrar tela" onClick={view.reset}><Scan size={16} /></IconButton>
        <IconButton className="studio-help" label="Atalhos e gestos" onClick={showHelp}><CircleHelp size={17} /></IconButton>
      </div>
    </div>
  </main>
}
