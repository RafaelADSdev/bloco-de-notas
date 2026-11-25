import { bitmap, flood, polygon, transformRegion } from './sketch-raster'

const legacyBrushes = { Lápis: 'pencil', Caneta: 'ink', Pincel: 'brush', Marcador: 'marker', Borracha: 'erase', Linha: 'line', Retângulo: 'rectangle', Elipse: 'ellipse' }

function path(ctx, points) {
  const first = points[0]
  ctx.beginPath()
  ctx.moveTo(first.x, first.y)
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2)
  }
  const last = points.at(-1)
  ctx.lineTo(last.x + (points.length === 1 ? .01 : 0), last.y)
}

function spaced(points, step, dab) {
  let remainder = step
  dab(points[0], 0)
  let index = 1
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i]
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy)
    let distance = remainder
    for (; distance <= length; distance += step) {
      const ratio = distance / length
      const pressure = (a.pressure ?? 1) * (1 - ratio) + (b.pressure ?? 1) * ratio
      dab({ x: a.x + dx * ratio, y: a.y + dy * ratio, pressure }, index++)
    }
    remainder = distance - length
  }
}

const radius = (point, size) => size * (point.pressure ?? 1) / 2
const noise = (i) => { const value = Math.sin(i * 127.1 + 13) * 43758.5453; return value - Math.floor(value) }

function softStroke(ctx, s, tool) {
  const { points, size, color } = s
  const step = Math.max(.75, size * (tool === 'chalk' ? .17 : .16))
  ctx.globalAlpha *= tool === 'spray' ? .25 : tool === 'wash' ? .35 : .74
  spaced(points, step, (point, index) => {
    const { x, y } = point, r = Math.max(.4, radius(point, size))
    if (tool === 'chalk') {
      for (let dab = 0; dab < 12; dab++) {
        const seed = index * 36 + dab * 3
        const angle = noise(seed) * Math.PI * 2, spread = Math.sqrt(noise(seed + 1)) * r
        const fleck = Math.max(.6, r * (.035 + noise(seed + 2) * .14))
        ctx.fillRect(x + Math.cos(angle) * spread, y + Math.sin(angle) * spread, fleck, fleck)
      }
      return
    }
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r)
    gradient.addColorStop(0, color)
    gradient.addColorStop(tool === 'wash' ? .72 : .34, color + (tool === 'wash' ? '56' : '48'))
    gradient.addColorStop(1, color + '00')
    ctx.fillStyle = gradient
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  })
}

function trace(ctx, s, tool) {
  const { points, size } = s
  if (tool === 'chalk' || tool === 'wash' || tool === 'spray') {
    softStroke(ctx, s, tool)
    return
  }
  if (tool === 'rectangle' || tool === 'ellipse') {
    const a = points[0], b = points.at(-1)
    ctx.beginPath()
    if (tool === 'rectangle') ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y)
    else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.max(.1, Math.abs(b.x - a.x) / 2), Math.max(.1, Math.abs(b.y - a.y) / 2), 0, 0, Math.PI * 2)
    if (s.filled) ctx.fill()
    else ctx.stroke()
    return
  }
  if (points[0].pressure != null && tool !== 'line') {
    ctx.beginPath()
    spaced(points, Math.max(.38, size * .09), (point) => {
      const r = radius(point, size)
      ctx.moveTo(point.x + r, point.y)
      ctx.arc(point.x, point.y, r, 0, Math.PI * 2)
    })
    ctx.fill()
    return
  }
  if (s.kind) path(ctx, points)
  else {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
    if (points.length === 1) ctx.lineTo(points[0].x + .01, points[0].y + .01)
  }
  ctx.stroke()
}

function stroke(ctx, s) {
  if (!s.points.length) return
  const tool = s.kind ?? legacyBrushes[s.tool]
  const opacity = s.opacity ?? (tool === 'marker' ? .3 : tool === 'pencil' ? .65 : 1)
  for (const matrix of s.matrices ?? [null]) {
    ctx.save()
    if (s.clip) {
      polygon(ctx, s.clip)
      ctx.clip()
    }
    if (matrix) ctx.transform(...matrix)
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : 'source-over'
    ctx.globalAlpha = opacity
    ctx.strokeStyle = ctx.fillStyle = s.color
    ctx.lineWidth = s.size
    ctx.lineCap = tool === 'marker' && s.kind ? 'square' : 'round'
    ctx.lineJoin = 'round'
    trace(ctx, s, tool)
    ctx.restore()
  }
}

export function studioRenderer(width, height, imageReady) {
  const cache = new Map()
  const images = new WeakMap()
  const scratch = bitmap(width, height).getContext('2d', { willReadFrequently: true })
  let revision = 0

  function prepare(layers) {
    for (const layer of layers) {
      for (const operation of layer.strokes) {
        if (operation.kind !== 'image' || images.has(operation.blob)) continue
        const image = {}
        images.set(operation.blob, image)
        image.ready = createImageBitmap(operation.blob).then((bitmap) => {
          image.bitmap = bitmap
          revision++
          imageReady()
        }).catch((error) => { image.error = error })
      }
    }
  }

  function apply(ctx, operation, captured) {
    if (operation.kind === 'fill') {
      flood(ctx, operation)
    } else if (operation.kind === 'region') {
      transformRegion(ctx, operation, captured)
    } else if (operation.kind === 'image') {
      const source = images.get(operation.blob)?.bitmap
      if (source) ctx.drawImage(source, operation.x, operation.y, operation.w, operation.h)
    } else if (operation.kind === 'text') {
      ctx.save()
      ctx.font = `${operation.size}px ${operation.font}`
      ctx.fillStyle = operation.color
      ctx.textBaseline = 'top'
      operation.text.split('\n').forEach((line, i) => ctx.fillText(line, operation.x, operation.y + operation.size * 1.2 * i))
      ctx.restore()
    } else {
      stroke(ctx, operation)
    }
  }

  function renderLayer(layer) {
    let entry = cache.get(layer.id)
    if (!entry) {
      entry = { ctx: bitmap(width, height).getContext('2d', { willReadFrequently: true }), strokes: [] }
      cache.set(layer.id, entry)
    }
    const { strokes } = layer
    if (entry.strokes === strokes && entry.revision === revision) return entry.ctx.canvas
    const incremental = entry.revision === revision && entry.strokes.length <= strokes.length
      && entry.strokes.every((operation, index) => operation === strokes[index])
    if (!incremental) entry.ctx.clearRect(0, 0, width, height)
    for (let i = incremental ? entry.strokes.length : 0; i < strokes.length; i++) apply(entry.ctx, strokes[i])
    entry.strokes = strokes
    entry.revision = revision
    return entry.ctx.canvas
  }

  function paint(ctx, drawing, draft) {
    ctx.clearRect(0, 0, width, height)
    if (drawing.background) {
      ctx.fillStyle = drawing.background
      ctx.fillRect(0, 0, width, height)
    }
    for (const layer of drawing.layers) {
      if (!layer.visible) continue
      let rendered = renderLayer(layer)
      if (draft?.layer === layer.id) {
        scratch.clearRect(0, 0, width, height)
        scratch.drawImage(rendered, 0, 0)
        apply(scratch, draft.operation, draft.captured)
        rendered = scratch.canvas
      }
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = layer.blend
      ctx.drawImage(rendered, 0, 0)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  return {
    prepare,
    renderLayer,
    paint,
    prune(layers) {
      for (const id of cache.keys()) if (!layers.some((layer) => layer.id === id)) cache.delete(id)
    },
    async ready(layers) {
      prepare(layers)
      const pending = layers.flatMap((layer) => layer.strokes.filter((operation) => operation.kind === 'image').map((operation) => images.get(operation.blob)))
      await Promise.all(pending.map((image) => image.ready))
      if (pending.some((image) => image.error)) throw new Error('Não foi possível carregar uma das imagens.')
    },
  }
}
