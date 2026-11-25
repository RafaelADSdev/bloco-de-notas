import { getCompositeCanvas, getLayerCanvas, initializeCanvas, readPsd, writePsd } from 'ag-psd'
import { canvasLimits, drawingFrame, layerLabels, newDrawing, newLayer } from './sketch-model.js'
import { bitmap, encode } from './sketch-raster.js'

const maxBytes = 48 * 1024 * 1024
const maxLayerCount = 64
const maxWorkingPixels = 40_000_000
const maxOffset = canvasLimits.max * 8

const psdBlend = new Map([
  ['source-over', 'normal'], ['multiply', 'multiply'], ['screen', 'screen'], ['overlay', 'overlay'],
  ['soft-light', 'soft light'], ['darken', 'darken'], ['lighten', 'lighten'], ['color-dodge', 'color dodge'],
  ['color-burn', 'color burn'], ['hard-light', 'hard light'], ['difference', 'difference'],
  ['exclusion', 'exclusion'], ['hue', 'hue'], ['saturation', 'saturation'], ['color', 'color'],
  ['luminosity', 'luminosity'], ['lighter', 'linear dodge'],
])
const canvasBlend = new Map([...psdBlend].map(([canvas, psd]) => [psd, canvas]))

initializeCanvas(bitmap, (width, height) => new ImageData(width, height))

function checkSize(width, height, layers) {
  if (width < 1 || height < 1 || width > canvasLimits.max || height > canvasLimits.max
    || width * height > canvasLimits.pixels || layers > maxLayerCount || width * height * layers > maxWorkingPixels) {
    throw new Error('Este PSD excede o tamanho ou a quantidade de camadas que o estúdio pode abrir.')
  }
}

function psdHeader(bytes) {
  const header = new DataView(bytes)
  if (header.byteLength < 26 || header.getUint32(0) !== 0x38425053) throw new Error('Este arquivo não é um PSD.')
  if (header.getUint16(4) !== 1) throw new Error('Use o formato PSD padrão. Arquivos PSB usam outro formato.')
  const channels = header.getUint16(12)
  if (header.getUint16(22) !== 8 || header.getUint16(24) !== 3 || channels < 3 || channels > 4) {
    throw new Error('Converta o arquivo para RGB de 8 bits por canal para abrir o PSD.')
  }
  checkSize(header.getUint32(18), header.getUint32(14), 1)
}

function hasCustomBlendRanges(ranges) {
  if (!ranges) return false
  const channels = ranges.ranges.flatMap(({ sourceRange, destRange }) => [sourceRange, destRange])
  return [ranges.compositeGrayBlendSource, ranges.compositeGraphBlendDestinationRange, ...channels]
    .some(([blackStart, blackEnd, whiteStart, whiteEnd]) => blackStart !== 0 || blackEnd !== 0 || whiteStart !== 255 || whiteEnd !== 255)
}

function validateLayers(psd) {
  const layers = psd.children ?? []
  checkSize(psd.width, psd.height, layers.length || 1)
  if (psd.artboards?.count || (psd.globalLayerMaskInfo && psd.globalLayerMaskInfo.opacity !== 0)) {
    throw new Error('O PSD usa pranchetas ou máscaras globais. Salve uma cópia com camadas raster simples.')
  }
  let pixels = 0
  for (const [index, layer] of layers.entries()) {
    if (layer.children || layer.mask || layer.realMask || layer.vectorMask || layer.vectorFill || layer.vectorStroke
      || layer.adjustment || layer.text || layer.effects || layer.placedLayer || layer.artboard
      || layer.knockout || layer.channelBlendingRestrictions?.length || layer.fillOpacity < 1 || hasCustomBlendRanges(layer.blendingRanges)) {
      throw new Error('O PSD usa grupos, máscaras de camada ou objetos avançados. Salve uma cópia com camadas raster simples.')
    }
    if (!canvasBlend.has(layer.blendMode) || (index === 0 && layer.clipping)) {
      throw new Error('O PSD usa um modo de mesclagem ou uma máscara de recorte incompatível.')
    }
    const width = Math.max(0, layer.right - layer.left), height = Math.max(0, layer.bottom - layer.top)
    if (width && height) {
      checkSize(width, height, 1)
      const channels = new Set(layer.rawData?.channels.map(({ id, data }) => data && id))
      if (![0, 1, 2].every((id) => channels.has(id)) || channels.size > 4 || [...channels].some((id) => ![-1, 0, 1, 2].includes(id))) {
        throw new Error('O PSD tem canais de cor inválidos ou sem suporte.')
      }
      if (Math.abs(layer.left) > maxOffset || Math.abs(layer.top) > maxOffset) {
        throw new Error('Há uma camada do PSD fora dos limites do estúdio.')
      }
      pixels += width * height
      if (pixels > maxWorkingPixels) throw new Error('As imagens das camadas do PSD são grandes demais.')
    }
  }
  return layers
}

function cropLayer(source, frame, temporary) {
  if (frame.x === 0 && frame.y === 0 && source.width === frame.width && source.height === frame.height) return source
  const canvas = bitmap(frame.width, frame.height)
  temporary.push(canvas)
  canvas.getContext('2d').drawImage(source, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
  return canvas
}

export async function encodeDrawingPsd(drawing, renderer, canvas) {
  const frame = drawingFrame(drawing)
  const { width, height } = frame
  checkSize(width, height, drawing.layers.length + (drawing.background ? 1 : 0))
  if (canvas.width !== width || canvas.height !== height) throw new Error('O enquadramento do PSD mudou antes da exportação.')
  if (drawing.layers[0]?.clipToBelow || drawing.layers.some((layer) => !psdBlend.has(layer.blend))) {
    throw new Error('Revise a máscara de recorte e os modos de mesclagem antes de exportar o PSD.')
  }
  await renderer.ready(drawing.layers)
  const children = []
  const temporary = []
  const bottom = drawing.background ? 1 : 0
  try {
    if (drawing.background) {
      const background = bitmap(width, height)
      temporary.push(background)
      const context = background.getContext('2d')
      context.fillStyle = drawing.background
      context.fillRect(0, 0, width, height)
      children.push({ name: 'Fundo da tela', canvas: background, id: 1, protected: { all: true } })
    }
    // PSD records and the studio renderer both start at the bottom of the stack.
    for (const [index, layer] of drawing.layers.entries()) {
      const name = layer.name.slice(0, 255)
      const source = layer.strokes.length ? cropLayer(renderer.renderLayer(layer), frame, temporary) : undefined
      children.push({
        id: index + bottom + 1,
        name,
        canvas: source,
        hidden: !layer.visible,
        opacity: layer.opacity,
        blendMode: psdBlend.get(layer.blend),
        clipping: !!layer.clipToBelow,
        transparencyProtected: !!layer.alphaLock || !!layer.locked,
        protected: { all: !!layer.locked, transparency: !!layer.alphaLock },
        layerColor: layer.colorLabel,
      })
    }
    const active = drawing.layers.findIndex((layer) => layer.id === drawing.active)
    const layerState = active + bottom
    const imageResources = active >= 0 ? { layerState, layerSelectionIds: [layerState + 1] } : undefined
    const bytes = writePsd({ width, height, canvas, children, imageResources }, { trimImageData: true, noBackground: true })
    if (bytes.byteLength > maxBytes) throw new Error('O PSD ultrapassa o limite de 48 MB.')
    return bytes
  } finally {
    for (const canvas of temporary) canvas.width = 0
  }
}

async function raster(canvas, x, y) {
  if (!canvas) return []
  try {
    return [{ kind: 'image', blob: await encode(canvas), x, y, w: canvas.width, h: canvas.height }]
  } finally {
    canvas.width = 0
  }
}

export async function decodeDrawingPsd(file) {
  if (!(file instanceof Blob) || file.size > maxBytes) throw new Error('Selecione um PSD de até 48 MB.')
  const bytes = await file.arrayBuffer()
  psdHeader(bytes)
  let psd
  try {
    psd = readPsd(bytes, {
      useRawData: true,
      skipCompositeImageData: true,
      skipThumbnail: true,
      skipLinkedFilesData: true,
      imageResourcesWhitelist: ['layerSelectionIds', 'layerState'],
      totalMemoryLimit: maxWorkingPixels * 4,
    })
  } catch {
    throw new Error('Não foi possível ler a estrutura do PSD.')
  }
  const source = validateLayers(psd)
  const title = file.name?.replace(/\.psd$/i, '').trim().slice(0, 90) || 'Desenho importado'
  const drawing = { ...newDrawing(title, psd.width, psd.height), background: null }
  const layers = []
  try {
    for (const layer of source) {
      const locked = !!(layer.protected?.all || layer.protected?.composite || layer.protected?.position)
      layers.push({
        ...newLayer(layer.name?.trim() || 'Camada ' + (layers.length + 1)),
        visible: !layer.hidden,
        locked,
        alphaLock: !!(layer.protected?.transparency || (!locked && layer.transparencyProtected)),
        clipToBelow: !!layer.clipping,
        opacity: layer.opacity,
        blend: canvasBlend.get(layer.blendMode),
        ...(Object.hasOwn(layerLabels, layer.layerColor) ? { colorLabel: layer.layerColor } : {}),
        strokes: await raster(getLayerCanvas(layer), layer.left, layer.top),
      })
    }
    if (!source.length) {
      const composite = getCompositeCanvas(psd)
      if (!composite) throw new Error('Imagem composta indisponível.')
      layers.push({ ...newLayer('Imagem'), strokes: await raster(composite, 0, 0) })
    }
  } catch {
    throw new Error('Não foi possível ler os pixels do PSD.')
  }
  drawing.layers = layers
  const selectedId = psd.imageResources?.layerSelectionIds?.[0]
  const selected = selectedId == null ? psd.imageResources?.layerState : source.findIndex((layer) => layer.id === selectedId)
  const fallback = layers.findLast((layer) => layer.visible && !layer.locked) ?? layers.at(-1)
  drawing.active = (layers[selected] ?? fallback).id
  return drawing
}
