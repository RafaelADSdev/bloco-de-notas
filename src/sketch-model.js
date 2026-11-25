export const paper = '#fffefa'
export const canvasSizes = [
  ['1200×800', 'Paisagem'], ['1200×1200', 'Quadrado'], ['900×1350', 'Retrato'],
  ['1920×1080', 'Tela ampla'],
]
export const canvasLimits = { min: 128, max: 4096, pixels: 12_000_000 }

export const brushes = {
  pencil: { label: 'Lápis', size: 5, opacity: 85 },
  ink: { label: 'Caneta', size: 6, opacity: 100 },
  brush: { label: 'Pincel redondo', size: 16, opacity: 100 },
  marker: { label: 'Marcador', size: 28, opacity: 42 },
  chalk: { label: 'Pastel seco', size: 30, opacity: 78 },
  wash: { label: 'Aquarela', size: 52, opacity: 70 },
  spray: { label: 'Aerógrafo', size: 65, opacity: 80 },
  stamp: { label: 'Carimbo', size: 26, opacity: 88 },
  splatter: { label: 'Respingos', size: 44, opacity: 85 },
  smudge: { label: 'Esfuminho', size: 34, opacity: 85 },
  erase: { label: 'Borracha', size: 32, opacity: 100 },
}

export const blends = {
  'source-over': 'Normal',
  multiply: 'Multiplicar',
  screen: 'Tela',
  overlay: 'Sobrepor',
  'soft-light': 'Luz suave',
  darken: 'Escurecer',
  lighten: 'Clarear',
  'color-dodge': 'Subexpor cor',
  'color-burn': 'Superexpor cor',
  'hard-light': 'Luz forte',
  difference: 'Diferença',
  exclusion: 'Exclusão',
  hue: 'Matiz',
  saturation: 'Saturação',
  color: 'Cor',
  luminosity: 'Luminosidade',
  lighter: 'Adicionar',
}

export const layerLabels = {
  none: 'Sem etiqueta', gray: 'Cinza', red: 'Vermelho', orange: 'Laranja', yellow: 'Amarelo',
  green: 'Verde', blue: 'Azul', violet: 'Violeta',
}
export const layerAdjustments = { hue: 0, saturation: 0, lightness: 0, red: 0, green: 0, blue: 0 }

export function canMergeDown(layers, index) {
  if (index <= 0 || index >= layers.length || layers[index + 1]?.clipToBelow) return false
  return [layers[index - 1], layers[index]].every((layer) => layer.visible && !layer.locked
    && !layer.clipToBelow && layer.blend === 'source-over')
}

export const palettes = [
  ['Carvão', '#243129'], ['Branco', '#ffffff'], ['Sálvia', '#5c8168'], ['Turquesa', '#277b79'],
  ['Índigo', '#3e5989'], ['Violeta', '#76528b'], ['Terracota', '#b75342'], ['Rosa', '#d98883'],
  ['Ocre', '#dbad54'], ['Areia', '#e9d9b7'],
]

export const shapes = new Set(['line', 'rectangle', 'ellipse'])
export const id = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function newLayer(name) {
  return { id: id(), name, visible: true, locked: false, opacity: 1, blend: 'source-over', strokes: [] }
}

export function numberedLayer(layers) {
  const names = new Set(layers.map((layer) => layer.name))
  let index = 1
  while (names.has('Camada ' + index)) index++
  return newLayer('Camada ' + index)
}

export function drawingFrame(drawing) {
  return drawing.frame ?? { x: 0, y: 0, width: drawing.width, height: drawing.height }
}

export function newDrawing(name = 'Desenho sem título', width = 1200, height = 800) {
  const layer = newLayer('Camada 1')
  return { id: id(), name, width, height, background: paper, layers: [layer], active: layer.id }
}

export function migrateStudio() {
  try {
    const layers = JSON.parse(localStorage.getItem('linha-clara-studio'))
    if (Array.isArray(layers) && layers.length) {
      const drawing = newDrawing()
      drawing.layers = layers.map((layer) => ({ ...newLayer(layer.name), ...layer }))
      drawing.active = drawing.layers[0].id
      return { drawings: [drawing], active: drawing.id }
    }
  } catch {
    // Opening the editor can still start a drawing if legacy storage is unavailable.
  }
  return { drawings: [], active: null }
}

export function editHistory(state, action) {
  const { drawing, past, future } = state
  if (action.type === 'select') {
    return { ...state, drawing: { ...drawing, active: action.id } }
  }
  if (action.type === 'undo') {
    return past.length ? { drawing: past.at(-1), past: past.slice(0, -1), future: [drawing, ...future] } : state
  }
  if (action.type === 'redo') {
    return future.length ? { drawing: future[0], past: [...past, drawing], future: future.slice(1) } : state
  }
  const next = action.update(drawing)
  return next === drawing ? state : { drawing: next, past: [...past.slice(-39), drawing], future: [] }
}

export function updateLayer(drawing, layerId, update) {
  return { ...drawing, layers: drawing.layers.map((layer) => layer.id === layerId ? update(layer) : layer) }
}

export function bounds(points) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const { x, y } of points) {
    left = Math.min(left, x)
    right = Math.max(right, x)
    top = Math.min(top, y)
    bottom = Math.max(bottom, y)
  }
  return { left, top, right, bottom, x: (left + right) / 2, y: (top + bottom) / 2 }
}

export function rectangle(a, b) {
  return [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]
}

export function inside(points, p) {
  return points.reduce((hit, a, i) => {
    const b = points.at(i - 1)
    const crosses = (a.y > p.y) !== (b.y > p.y)
    return crosses && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x ? !hit : hit
  }, false)
}

export function transformPoints(points, { x = 0, y = 0, angle = 0, scaleX = 1, scaleY = 1 }) {
  const center = bounds(points)
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return points.map((p) => {
    const dx = (p.x - center.x) * scaleX, dy = (p.y - center.y) * scaleY
    return { x: center.x + x + dx * cos - dy * sin, y: center.y + y + dx * sin + dy * cos }
  })
}

export function symmetryMatrices(mode, frame, settings = {}) {
  const x = frame.x + frame.width * (settings.symmetryX ?? 50) / 100
  const y = frame.y + frame.height * (settings.symmetryY ?? 50) / 100
  const matrices = [[1, 0, 0, 1, 0, 0]]
  if (mode === 'vertical' || mode === 'both') matrices.push([-1, 0, 0, 1, x * 2, 0])
  if (mode === 'horizontal' || mode === 'both') matrices.push([1, 0, 0, -1, 0, y * 2])
  if (mode === 'both') matrices.push([-1, 0, 0, -1, x * 2, y * 2])
  if (mode === 'free') {
    const angle = (settings.symmetryAngle ?? 0) * Math.PI / 180
    const cos = Math.cos(2 * angle), sin = Math.sin(2 * angle)
    matrices.push([cos, sin, sin, -cos, x - x * cos - y * sin, y - x * sin + y * cos])
  }
  if (mode === 'radial') {
    const count = settings.symmetryCount ?? 6
    for (let i = 1; i < count; i++) {
      const cos = Math.cos(i * Math.PI * 2 / count), sin = Math.sin(i * Math.PI * 2 / count)
      matrices.push([cos, sin, -sin, cos, x - x * cos + y * sin, y - x * sin - y * cos])
    }
  }
  return matrices.length === 1 ? undefined : matrices
}

export function stabilizePoint(point, last, radius, smoothing) {
  const distance = Math.hypot(point.x - last.x, point.y - last.y)
  if (distance <= radius) return last
  const ratio = (1 - radius / distance) * (1 - smoothing / 120)
  return { x: last.x + (point.x - last.x) * ratio, y: last.y + (point.y - last.y) * ratio, pressure: point.pressure }
}

export function predictStroke(points, strength) {
  if (!strength || points.length < 4) return points
  const first = points[0], last = points.at(-1)
  const dx = last.x - first.x, dy = last.y - first.y
  const length = Math.hypot(dx, dy)
  if (length < 18) return points
  const tolerance = Math.max(1.5, Math.min(22, length * .012 * strength))
  const projections = points.map((point) => ((point.x - first.x) * dx + (point.y - first.y) * dy) / (length * length))
  if (points.some((point, i) => projections[i] < -.03 || projections[i] > 1.03
    || (i && projections[i] < projections[i - 1] - .045)
    || Math.abs((point.x - first.x) * dy - (point.y - first.y) * dx) > tolerance * length)) return points
  return points.map(({ pressure }, i) => ({ x: first.x + dx * projections[i], y: first.y + dy * projections[i], pressure }))
}
