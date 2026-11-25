import { fileData } from './model.js'
import { blends, brushes, canvasLimits, id, layerAdjustments, layerLabels, shapes } from './sketch-model.js'
import { encode } from './sketch-raster.js'

const format = 'linha-clara-desenho'
const version = 1
const { max: maxSide, pixels: maxPixels } = canvasLimits
const maxLayerPixels = 96_000_000
const maxImagePixels = 48_000_000
const maxProjectBytes = 32 * 1024 * 1024
const maxPoints = 450_000
const maxOperations = 30_000
const coordinateLimit = maxSide * 8
const pngPrefix = 'data:image/png;base64,'
const legacyBrushes = new Set(['Lápis', 'Caneta', 'Pincel', 'Marcador', 'Borracha', 'Linha', 'Retângulo', 'Elipse'])
const stampShapes = new Set(['circle', 'square', 'diamond'])
const standardFonts = new Set(['sans-serif', 'serif', 'monospace'])

function requireValid(condition) {
  if (!condition) throw new Error('O arquivo tem dados de desenho inválidos.')
}

function requireBudget(condition) {
  if (!condition) throw new Error('Este desenho é grande demais para um arquivo editável.')
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const inRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max
const coordinate = (value) => inRange(value, -coordinateLimit, coordinateLimit)
const dimension = (value) => Number.isInteger(value) && inRange(value, 1, maxSide)
const validColor = (value) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
const validId = (value) => typeof value === 'string' && value.length > 0 && value.length <= 128

function point(value) {
  requireValid(isObject(value) && coordinate(value.x) && coordinate(value.y))
  const result = { x: value.x, y: value.y }
  if (value.pressure != null) {
    requireValid(inRange(value.pressure, 0, 1))
    result.pressure = value.pressure
  }
  return result
}

function points(values, limits, minimum = 1) {
  requireValid(Array.isArray(values) && values.length >= minimum)
  limits.points += values.length
  requireBudget(limits.points <= maxPoints)
  return values.map(point)
}

function transform(value) {
  if (value == null) return null
  requireValid(isObject(value))
  const result = {}
  for (const key of ['x', 'y', 'angle', 'scaleX', 'scaleY']) {
    if (value[key] === undefined) continue
    const limit = key.startsWith('scale') ? 16 : coordinateLimit
    requireValid(inRange(value[key], -limit, limit))
    result[key] = value[key]
  }
  return result
}

function symmetry(value) {
  requireValid(Array.isArray(value) && value.length > 0 && value.length <= 32)
  return value.map((matrix) => {
    requireValid(Array.isArray(matrix) && matrix.length === 6)
    const [a, b, c, d, x, y] = matrix
    requireValid([a, b, c, d].every((term) => inRange(term, -1, 1)) && coordinate(x) && coordinate(y))
    return [a, b, c, d, x, y]
  })
}

function paintOptions(value, limits) {
  requireValid(validColor(value.color) && (value.opacity == null || inRange(value.opacity, 0, 1)))
  const result = { color: value.color }
  if (value.opacity != null) result.opacity = value.opacity
  if (value.clip != null) result.clip = points(value.clip, limits, 3)
  if (value.lockAlpha === true) result.lockAlpha = true
  return result
}

function brushOperation(value, limits) {
  const modern = typeof value.kind === 'string' && (Object.hasOwn(brushes, value.kind)
    || shapes.has(value.kind) || value.kind === 'stamp' || value.kind === 'splatter')
  requireValid(modern || (value.kind == null && legacyBrushes.has(value.tool)))
  requireValid(inRange(value.size, 0.25, maxSide))
  const style = paintOptions(value, limits)
  const path = points(value.points, limits)
  const result = { ...style, points: path, size: value.size }
  if (modern) result.kind = value.kind
  else result.tool = value.tool
  if (value.matrices != null) result.matrices = symmetry(value.matrices)
  if (value.filled === true) result.filled = true
  if (value.stampShape != null) {
    requireValid(stampShapes.has(value.stampShape))
    result.stampShape = value.stampShape
  }
  if (value.spacing != null) {
    requireValid(inRange(value.spacing, 10, 150))
    result.spacing = value.spacing
  }
  return result
}

function operation(value, limits) {
  requireValid(isObject(value))
  limits.operations += 1
  requireBudget(limits.operations <= maxOperations)
  switch (value.kind) {
    case 'image': {
      requireValid(coordinate(value.x) && coordinate(value.y) && inRange(value.w, Number.MIN_VALUE, maxSide)
        && inRange(value.h, Number.MIN_VALUE, maxSide))
      return { kind: 'image', x: value.x, y: value.y, w: value.w, h: value.h, blob: value.blob }
    }
    case 'text': {
      requireValid(coordinate(value.x) && coordinate(value.y) && validColor(value.color)
        && inRange(value.size, 8, 240) && standardFonts.has(value.font)
        && typeof value.text === 'string' && value.text.length <= 500 && value.text.trim())
      return { kind: 'text', x: value.x, y: value.y, size: value.size, font: value.font, text: value.text, color: value.color }
    }
    case 'region':
      return { kind: 'region', points: points(value.points, limits, 3), transform: transform(value.transform) }
    case 'fill':
      requireValid(inRange(value.tolerance, 0, 100) && inRange(value.opacity, 0, 1))
      return { kind: 'fill', ...paintOptions(value, limits), point: point(value.point), tolerance: value.tolerance }
    case 'area-fill':
      requireValid(inRange(value.opacity, 0, 1))
      return { kind: 'area-fill', ...paintOptions(value, limits), points: points(value.points, limits, 3) }
    case 'area-outline':
      requireValid(inRange(value.opacity, 0, 1) && inRange(value.size, 0.25, maxSide))
      return { kind: 'area-outline', ...paintOptions(value, limits), points: points(value.points, limits, 3), size: value.size }
    case 'gradient':
      requireValid(inRange(value.opacity, 0, 1) && validColor(value.endColor) && value.points?.length === 2)
      return { kind: 'gradient', ...paintOptions(value, limits), points: points(value.points, limits, 2), endColor: value.endColor }
    default:
      return brushOperation(value, limits)
  }
}

function normalizedDrawing(value) {
  requireValid(isObject(value) && typeof value.name === 'string' && value.name.trim() && value.name.length <= 90)
  const { width, height, frame } = value
  requireValid(dimension(width) && dimension(height) && width * height <= maxPixels)
  requireValid(value.background == null || validColor(value.background))
  requireValid(Array.isArray(value.layers) && value.layers.length > 0 && value.layers.length <= 128)
  requireBudget(width * height * value.layers.length <= maxLayerPixels)
  const limits = { operations: 0, points: 0 }
  const layerIds = new Set()
  const layers = value.layers.map((layer) => {
    requireValid(isObject(layer) && validId(layer.id) && !layerIds.has(layer.id)
      && typeof layer.name === 'string' && layer.name.length <= 8192
      && Object.hasOwn(blends, layer.blend) && inRange(layer.opacity, 0, 1)
      && typeof layer.visible === 'boolean' && typeof layer.locked === 'boolean' && Array.isArray(layer.strokes))
    layerIds.add(layer.id)
    let adjustments
    if (layer.adjustments != null) {
      requireValid(isObject(layer.adjustments))
      adjustments = Object.fromEntries(Object.keys(layerAdjustments).map((key) => {
        const max = key === 'hue' ? 180 : 100
        const amount = layer.adjustments[key] ?? 0
        requireValid(inRange(amount, -max, max))
        return [key, amount]
      }))
    }
    return {
      id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, opacity: layer.opacity, blend: layer.blend,
      ...(layer.alphaLock === true ? { alphaLock: true } : {}),
      ...(layer.clipToBelow === true ? { clipToBelow: true } : {}),
      ...(adjustments ? { adjustments } : {}),
      ...(Object.hasOwn(layerLabels, layer.colorLabel) ? { colorLabel: layer.colorLabel } : {}),
      strokes: layer.strokes.map((entry) => operation(entry, limits)),
    }
  })
  requireValid(layerIds.has(value.active))
  const drawing = { name: value.name, width, height, background: value.background ?? null, layers, active: value.active }
  if (frame != null) {
    requireValid(isObject(frame) && Number.isInteger(frame.x) && Number.isInteger(frame.y)
      && frame.x >= 0 && frame.y >= 0 && dimension(frame.width) && dimension(frame.height)
      && frame.x + frame.width <= width && frame.y + frame.height <= height)
    drawing.frame = { x: frame.x, y: frame.y, width: frame.width, height: frame.height }
  }
  return drawing
}

async function convertImages(drawing, convert) {
  for (const layer of drawing.layers) {
    for (const entry of layer.strokes) {
      if (entry.kind === 'image') entry.blob = await convert(entry.blob)
    }
  }
}

function pngPixels(bytes) {
  requireValid(bytes.byteLength > 32)
  const header = new DataView(bytes)
  requireValid(header.getUint32(0) === 0x89504e47 && header.getUint32(4) === 0x0d0a1a0a
    && header.getUint32(8) === 13 && header.getUint32(12) === 0x49484452)
  const width = header.getUint32(16), height = header.getUint32(20)
  requireValid(dimension(width) && dimension(height) && width * height <= maxPixels)
  return width * height
}

async function readPng(value, limits) {
  requireValid(typeof value === 'string' && value.startsWith(pngPrefix))
  const data = value.slice(pngPrefix.length)
  requireValid(data.length % 4 === 0 && /^[a-z\d+/]+={0,2}$/i.test(data))
  const bytes = Uint8Array.from(atob(data), (letter) => letter.charCodeAt(0))
  limits.imagePixels += pngPixels(bytes.buffer)
  requireBudget(limits.imagePixels <= maxImagePixels)
  const png = new Blob([bytes], { type: 'image/png' })
  const image = await createImageBitmap(png).catch(() => null)
  requireValid(image)
  image.close()
  return png
}

export async function encodeDrawingProject(value) {
  const drawing = normalizedDrawing(value)
  let bytes = 0, imagePixels = 0
  await convertImages(drawing, async (blob) => {
    requireValid(blob instanceof Blob && blob.type === 'image/png' && blob.size > 0)
    bytes += Math.ceil(blob.size / 3) * 4
    requireBudget(bytes <= maxProjectBytes)
    imagePixels += pngPixels(await blob.slice(0, 33).arrayBuffer())
    requireBudget(imagePixels <= maxImagePixels)
    return fileData(blob)
  })
  const json = JSON.stringify({ format, version, drawing })
  requireBudget(new Blob([json]).size <= maxProjectBytes)
  return json
}

export async function decodeDrawingProject(file) {
  requireValid(file instanceof Blob)
  requireBudget(file.size <= maxProjectBytes)
  const contents = await file.text()
  let envelope
  try {
    envelope = JSON.parse(contents)
  } catch {
    throw new Error('Não foi possível ler o arquivo de desenho.')
  }
  if (envelope?.format !== format || envelope.version !== version) throw new Error('Este arquivo não é um projeto de desenho do Linha Clara.')
  const drawing = normalizedDrawing(envelope.drawing)
  const limits = { imagePixels: 0 }
  await convertImages(drawing, (value) => readPng(value, limits))
  const active = drawing.layers.findIndex((layer) => layer.id === drawing.active)
  drawing.id = id()
  for (const layer of drawing.layers) layer.id = id()
  drawing.active = drawing.layers[active].id
  return drawing
}

export async function createDrawingPdf(canvas, title) {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  if (title) pdf.setTitle(title)
  const png = await encode(canvas)
  const image = await pdf.embedPng(await png.arrayBuffer())
  const scale = 842 / Math.max(canvas.width, canvas.height)
  const width = canvas.width * scale, height = canvas.height * scale
  pdf.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height })
  return pdf.save()
}
