export const paper = '#fffefa'
export const canvasSizes = [
  ['1200×800', 'Paisagem'], ['1200×1200', 'Quadrado'], ['900×1350', 'Retrato'],
  ['1920×1080', 'Tela ampla'],
]

export const brushes = {
  pencil: { label: 'Lápis', size: 5, opacity: 85 },
  ink: { label: 'Caneta', size: 6, opacity: 100 },
  brush: { label: 'Pincel redondo', size: 16, opacity: 100 },
  marker: { label: 'Marcador', size: 28, opacity: 42 },
  chalk: { label: 'Pastel seco', size: 30, opacity: 78 },
  wash: { label: 'Aquarela', size: 52, opacity: 70 },
  spray: { label: 'Aerógrafo', size: 65, opacity: 80 },
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

export function symmetryMatrices(mode, frame) {
  const x = frame.x + frame.width / 2, y = frame.y + frame.height / 2
  const matrices = [[1, 0, 0, 1, 0, 0]]
  if (mode === 'vertical' || mode === 'both') matrices.push([-1, 0, 0, 1, x * 2, 0])
  if (mode === 'horizontal' || mode === 'both') matrices.push([1, 0, 0, -1, 0, y * 2])
  if (mode === 'both') matrices.push([-1, 0, 0, -1, x * 2, y * 2])
  if (mode === 'radial') {
    for (let i = 1; i < 6; i++) {
      const cos = Math.cos(i * Math.PI / 3), sin = Math.sin(i * Math.PI / 3)
      matrices.push([cos, sin, -sin, cos, x - x * cos + y * sin, y - x * sin - y * cos])
    }
  }
  return matrices.length === 1 ? undefined : matrices
}
