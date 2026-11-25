import { useLayoutEffect, useRef, useState } from 'react'
import { clamp } from './sketch-model'

const home = { x: 0, y: 0, zoom: 1, angle: 0, flipped: false }

function rotate(x, y, angle) {
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return { x: x * cos - y * sin, y: x * sin + y * cos }
}

export function useSketchView(width, height) {
  const viewport = useRef(null)
  const latest = useRef(home)
  const [view, setView] = useState(home)
  const [area, setArea] = useState({ width: 0, height: 0 })
  const previousFit = useRef(null)
  const spacious = area.width >= 900 && area.height >= 570
  const margin = spacious ? 44 : 14
  const fit = clamp(Math.min((area.width - margin) / width, (area.height - margin) / height), .05, spacious ? 2 : 1)

  useLayoutEffect(() => {
    const element = viewport.current
    const observer = new ResizeObserver(([entry]) => setArea({
      width: entry.contentRect.width, height: entry.contentRect.height,
    }))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  function update(next) {
    latest.current = next
    setView(next)
  }

  useLayoutEffect(() => {
    const previous = previousFit.current
    if (!area.width || !area.height) return
    previousFit.current = { fit, width, height }
    if (!previous || previous.width !== width || previous.height !== height || previous.fit === fit) return
    const current = latest.current
    if (current.x || current.y) update({ ...current, x: current.x * fit / previous.fit, y: current.y * fit / previous.fit })
  }, [area.width, area.height, fit, width, height])

  function coordinate(clientX, clientY) {
    const rect = viewport.current.getBoundingClientRect()
    return { x: clientX - rect.left - rect.width / 2, y: clientY - rect.top - rect.height / 2 }
  }

  function point(event) {
    const { x, y, zoom, angle, flipped } = latest.current
    const centered = coordinate(event.clientX, event.clientY)
    const local = rotate(centered.x - x, centered.y - y, -angle)
    const scale = fit * zoom
    return { x: (flipped ? -local.x : local.x) / scale + width / 2, y: local.y / scale + height / 2 }
  }

  function adjust(base, zoom, angle, pivot = { x: 0, y: 0 }, nextPivot = pivot) {
    zoom = clamp(zoom, .25, 8)
    const offset = rotate(base.x - pivot.x, base.y - pivot.y, angle - base.angle)
    update({ ...base, zoom, angle, x: nextPivot.x + offset.x * zoom / base.zoom, y: nextPivot.y + offset.y * zoom / base.zoom })
  }

  useLayoutEffect(() => {
    const element = viewport.current
    function wheel(event) {
      event.preventDefault()
      const base = latest.current
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      adjust(base, base.zoom * Math.exp(-delta * .002), base.angle, coordinate(event.clientX, event.clientY))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  }, [])

  return {
    view, viewport, latest, update, point, coordinate, adjust,
    reset: () => update(home),
    zoom: (factor) => adjust(latest.current, latest.current.zoom * factor, latest.current.angle),
    rotate: () => adjust(latest.current, latest.current.zoom, latest.current.angle + Math.PI / 2),
    flip: () => update({ ...latest.current, flipped: !latest.current.flipped }),
    style: {
      width: width * fit * view.zoom, height: height * fit * view.zoom,
      left: `calc(50% + ${view.x}px)`, top: `calc(50% + ${view.y}px)`,
      transform: `translate(-50%, -50%) rotate(${view.angle}rad) scaleX(${view.flipped ? -1 : 1})`,
    },
  }
}
