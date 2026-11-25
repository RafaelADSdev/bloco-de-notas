import { bitmap, flood, polygon, transformRegion } from './sketch-raster'
import { drawingFrame } from './sketch-model'
import { adjustLayerImage, hasLayerColor, layerColorArea } from './sketch-layer-color'

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

function stampStroke(ctx, { points, size, spacing, stampShape }, tool) {
  const step = Math.max(1, size * (spacing ?? (tool === 'stamp' ? 72 : 42)) / 100)
  spaced(points, step, (point, index) => {
    const { x, y } = point
    const r = Math.max(.5, radius(point, size))
    ctx.beginPath()
    if (tool === 'splatter') {
      for (let dot = 0; dot < 18; dot++) {
        const seed = index * 54 + dot * 3
        const angle = noise(seed) * Math.PI * 2
        const spread = Math.pow(noise(seed + 1), 1.2) * r
        const fleck = Math.max(.4, r * (.018 + .135 * noise(seed + 2) ** 2))
        const cx = x + Math.cos(angle) * spread, cy = y + Math.sin(angle) * spread
        ctx.moveTo(cx + fleck, cy)
        ctx.arc(cx, cy, fleck, 0, Math.PI * 2)
      }
    } else if (stampShape === 'circle') {
      ctx.arc(x, y, r, 0, Math.PI * 2)
    } else if (stampShape === 'square') {
      ctx.rect(x - r, y - r, r * 2, r * 2)
    } else {
      ctx.moveTo(x, y - r)
      ctx.lineTo(x + r, y)
      ctx.lineTo(x, y + r)
      ctx.lineTo(x - r, y)
      ctx.closePath()
    }
    ctx.fill()
  })
}

function smudgeStroke(ctx, { points, size }) {
  if (points.length < 2) return
  const { a, b, c, d, e, f } = ctx.getTransform()
  const opacity = ctx.globalAlpha
  const pigment = [0, 0, 0, 0]
  spaced(points, Math.max(4, size * .22), (point, index) => {
    const { x, y } = point
    const sx = Math.floor(a * x + c * y + e), sy = Math.floor(b * x + d * y + f)
    const sample = ctx.getImageData(sx, sy, 1, 1).data
    const carriedAlpha = pigment[3]
    if (index && carriedAlpha > .006) {
      const rgb = pigment.slice(0, 3).map((v) => Math.round(v / carriedAlpha)).join(' ')
      const r = Math.max(.5, radius(point, size))
      const dab = ctx.createRadialGradient(x, y, 0, x, y, r)
      dab.addColorStop(0, `rgb(${rgb})`)
      dab.addColorStop(1, `rgb(${rgb} / 0)`)
      ctx.fillStyle = dab
      ctx.globalAlpha = opacity * carriedAlpha * .64
      ctx.fillRect(x - r, y - r, r * 2, r * 2)
    }

    // Store premultiplied color so pickup from empty pixels only thins the pigment.
    const pickup = index ? .24 : 1
    const alpha = sample[3] / 255
    for (let channel = 0; channel < 3; channel++) {
      pigment[channel] += (sample[channel] * alpha - pigment[channel]) * pickup
    }
    pigment[3] += (alpha - pigment[3]) * pickup
  })
}

function trace(ctx, s, tool) {
  const { points, size } = s
  if (tool === 'chalk' || tool === 'wash' || tool === 'spray') {
    softStroke(ctx, s, tool)
    return
  }
  if (tool === 'stamp' || tool === 'splatter') {
    stampStroke(ctx, s, tool)
    return
  }
  if (tool === 'smudge') {
    smudgeStroke(ctx, s)
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
  if (s.lockAlpha && tool === 'erase') return
  const opacity = s.opacity ?? (tool === 'marker' ? .3 : tool === 'pencil' ? .65 : 1)
  for (const matrix of s.matrices ?? [null]) {
    ctx.save()
    if (s.clip) {
      polygon(ctx, s.clip)
      ctx.clip()
    }
    if (matrix) ctx.transform(...matrix)
    ctx.globalCompositeOperation = tool === 'erase' ? 'destination-out' : s.lockAlpha ? 'source-atop' : 'source-over'
    ctx.globalAlpha = opacity
    ctx.strokeStyle = ctx.fillStyle = s.color
    ctx.lineWidth = s.size
    ctx.lineCap = tool === 'marker' && s.kind ? 'square' : 'round'
    ctx.lineJoin = 'round'
    trace(ctx, s, tool)
    ctx.restore()
  }
}

function area(ctx, operation) {
  const { points, kind, color, opacity = 1, clip, size = 1, lockAlpha } = operation
  const gradient = kind === 'gradient'
  if (gradient ? points.length < 2 : points.length < 3) return

  const [start, end] = [points[0], points.at(-1)]
  if (gradient && Math.hypot(end.x - start.x, end.y - start.y) < .01) return
  ctx.save()
  if (clip?.length) {
    polygon(ctx, clip)
    ctx.clip()
  }
  ctx.globalCompositeOperation = lockAlpha ? 'source-atop' : 'source-over'
  ctx.globalAlpha = opacity
  if (gradient) {
    const paint = ctx.createLinearGradient(start.x, start.y, end.x, end.y)
    paint.addColorStop(0, color)
    paint.addColorStop(1, operation.endColor)
    ctx.fillStyle = paint
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
  } else {
    polygon(ctx, points)
    if (kind === 'area-outline') {
      ctx.strokeStyle = color
      ctx.lineWidth = size
      ctx.lineJoin = 'round'
      ctx.stroke()
    } else {
      ctx.fillStyle = color
      ctx.fill('evenodd')
    }
  }
  ctx.restore()
}

export function studioRenderer(width, height, imageReady) {
  const cache = new Map()
  const images = new WeakMap()
  const scratch = bitmap(width, height).getContext('2d', { willReadFrequently: true })
  let clipping
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
    } else if (operation.kind === 'area-fill' || operation.kind === 'area-outline' || operation.kind === 'gradient') {
      area(ctx, operation)
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

  function renderEntry(layer) {
    let entry = cache.get(layer.id)
    if (!entry) {
      entry = { ctx: bitmap(width, height).getContext('2d', { willReadFrequently: true }), strokes: [] }
      cache.set(layer.id, entry)
    }
    const { strokes } = layer
    if (entry.strokes === strokes && entry.revision === revision) return entry
    const incremental = entry.revision === revision && entry.strokes.length <= strokes.length
      && entry.strokes.every((operation, index) => operation === strokes[index])
    if (!incremental) entry.ctx.clearRect(0, 0, width, height)
    for (let i = incremental ? entry.strokes.length : 0; i < strokes.length; i++) apply(entry.ctx, strokes[i])
    entry.strokes = strokes
    entry.revision = revision
    return entry
  }

  function renderRawLayer(layer) {
    return renderEntry(layer).ctx.canvas
  }

  function renderLayer(layer) {
    const entry = renderEntry(layer)
    const { adjustments } = layer
    if (!hasLayerColor(adjustments)) {
      if (entry.adjusted) {
        entry.adjusted.ctx.canvas.width = 0
        entry.adjusted = undefined
      }
      return entry.ctx.canvas
    }
    const cached = entry.adjusted ??= { ctx: bitmap(width, height).getContext('2d') }
    if (cached.options !== adjustments || cached.strokes !== entry.strokes || cached.revision !== entry.revision) {
      const extendsCache = cached.options === adjustments && cached.revision === entry.revision
        && cached.strokes.length < entry.strokes.length && cached.strokes.every((stroke, index) => stroke === entry.strokes[index])
      const changed = extendsCache
        ? layerColorArea(entry.strokes.slice(cached.strokes.length), width, height)
        : { x: 0, y: 0, width, height }
      if (changed.width && changed.height) {
        const { x, y } = changed
        const pixels = entry.ctx.getImageData(x, y, changed.width, changed.height)
        cached.ctx.putImageData(adjustLayerImage(pixels, adjustments), x, y)
      }
      cached.options = adjustments
      cached.strokes = entry.strokes
      cached.revision = entry.revision
    }
    return cached.ctx.canvas
  }

  function paint(ctx, drawing, draft) {
    ctx.clearRect(0, 0, width, height)
    if (drawing.background) {
      ctx.fillStyle = drawing.background
      ctx.fillRect(0, 0, width, height)
    }
    const layers = drawing.layers
    for (let index = 0; index < layers.length;) {
      const layer = layers[index++]
      if (layer.clipToBelow) continue
      const firstClip = index
      while (layers[index]?.clipToBelow) index++
      const opacity = layer.opacity ?? 1
      if (!layer.visible || opacity <= 0) continue

      let rendered = drawLayer(layer, draft)
      if (index > firstClip) {
        const clipped = layers.slice(firstClip, index).filter((mask) => mask.visible && (mask.opacity ?? 1) > 0)
        if (clipped.length) rendered = drawClipped(rendered, clipped, draft)
      }
      ctx.globalAlpha = opacity
      ctx.globalCompositeOperation = layer.blend || 'source-over'
      ctx.drawImage(rendered, 0, 0)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function drawLayer(layer, draft) {
    if (draft?.layer !== layer.id) return renderLayer(layer)
    const rendered = renderRawLayer(layer)
    scratch.clearRect(0, 0, width, height)
    scratch.drawImage(rendered, 0, 0)
    apply(scratch, draft.operation, draft.captured)
    if (hasLayerColor(layer.adjustments)) {
      const changed = layerColorArea([draft.operation], width, height)
      if (!changed.width || !changed.height) return renderLayer(layer)
      const { x, y } = changed
      const pixels = scratch.getImageData(x, y, changed.width, changed.height)
      if (changed.width < width || changed.height < height) {
        scratch.clearRect(0, 0, width, height)
        scratch.drawImage(renderLayer(layer), 0, 0)
      }
      scratch.putImageData(adjustLayerImage(pixels, layer.adjustments), x, y)
    }
    return scratch.canvas
  }

  function drawClipped(base, layers, draft) {
    clipping ??= bitmap(width, height).getContext('2d', { willReadFrequently: true })
    clipping.clearRect(0, 0, width, height)
    clipping.drawImage(base, 0, 0)

    const blend = layers.some((layer) => layer.blend && layer.blend !== 'source-over')
    let alpha
    if (blend) {
      // Blend colors on an opaque surface, then restore the base alpha exactly.
      const image = clipping.getImageData(0, 0, width, height)
      alpha = new Uint8Array(width * height)
      for (let index = 0; index < alpha.length; index++) {
        const channel = index * 4 + 3
        alpha[index] = image.data[channel]
        image.data[channel] = 255
      }
      clipping.putImageData(image, 0, 0)
    }

    for (const layer of layers) {
      clipping.globalAlpha = layer.opacity ?? 1
      clipping.globalCompositeOperation = blend ? (layer.blend || 'source-over') : 'source-atop'
      clipping.drawImage(drawLayer(layer, draft), 0, 0)
    }
    clipping.globalAlpha = 1
    clipping.globalCompositeOperation = 'source-over'

    if (alpha) {
      const image = clipping.getImageData(0, 0, width, height)
      for (let index = 0; index < alpha.length; index++) image.data[index * 4 + 3] = alpha[index]
      clipping.putImageData(image, 0, 0)
    }
    return clipping.canvas
  }

  return {
    prepare,
    renderLayer,
    renderRawLayer,
    paint,
    prune(layers) {
      for (const [id, entry] of cache) {
        if (layers.some((layer) => layer.id === id)) continue
        releaseEntry(entry)
        cache.delete(id)
      }
    },
    async ready(layers) {
      prepare(layers)
      const pending = layers.flatMap((layer) => layer.strokes.filter((operation) => operation.kind === 'image').map((operation) => images.get(operation.blob)))
      await Promise.all(pending.map((image) => image.ready))
      if (pending.some((image) => image.error)) throw new Error('Não foi possível carregar uma das imagens.')
    },
    release(layers) {
      scratch.canvas.width = 0
      if (clipping) clipping.canvas.width = 0
      for (const entry of cache.values()) releaseEntry(entry)
      cache.clear()
      for (const layer of layers) {
        for (const operation of layer.strokes) {
          if (operation.kind !== 'image') continue
          images.get(operation.blob)?.bitmap?.close()
          images.delete(operation.blob)
        }
      }
    },
  }
}

function releaseEntry(entry) {
  entry.ctx.canvas.width = 0
  if (entry.adjusted) entry.adjusted.ctx.canvas.width = 0
}

export async function drawingThumbnail(drawing, width, height) {
  const layers = drawing.layers
  const renderer = studioRenderer(drawing.width, drawing.height, () => {})
  const surface = bitmap(drawing.width, drawing.height)
  try {
    await renderer.ready(layers.filter((layer) => layer.visible))
    renderer.paint(surface.getContext('2d'), { ...drawing, layers })
    const frame = drawingFrame(drawing)
    const preview = bitmap(width, height)
    preview.getContext('2d').drawImage(surface, frame.x, frame.y, frame.width, frame.height, 0, 0, width, height)
    return preview
  } finally {
    renderer.release(layers)
    surface.width = 0
  }
}
