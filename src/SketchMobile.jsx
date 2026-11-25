import { useState } from 'react'
import { Check, Grid2X2, ImagePlus, Layers3, Pipette, Redo2, SlidersHorizontal, Undo2 } from 'lucide-react'
import { BrushTip, ColorSwatches, tools } from './SketchPanels'
import { brushes, canvasSizes, clamp } from './sketch-model'
import { IconButton } from './ui'
import { bitmap } from './sketch-raster'
import { isAndroidApp } from './android-platform'

const compactViewport = window.matchMedia('(max-width: 760px), (max-width: 1100px) and (max-height: 560px)')
const paletteKey = 'linha-clara:paleta-do-estudio'
const harmonies = { similar: [-30, 0, 30], opposite: [0, 180], trio: [0, 120, 240] }

function readColors() {
  try {
    const values = JSON.parse(localStorage.getItem(paletteKey))
    return Array.isArray(values) ? values.filter((value) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)).slice(0, 20) : []
  } catch {
    return []
  }
}

async function colorsFromImage(file) {
  if (file.size > 24 * 1024 * 1024) throw new Error('A imagem precisa ter até 24 MB.')
  const image = await createImageBitmap(file, { resizeWidth: 48, resizeHeight: 48, resizeQuality: 'low' })
  try {
    const ctx = bitmap(48, 48).getContext('2d', { willReadFrequently: true })
    ctx.drawImage(image, 0, 0, 48, 48)
    const { data } = ctx.getImageData(0, 0, 48, 48)
    const groups = new Map()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5)
      const group = groups.get(key) ?? [0, 0, 0, 0]
      group[0] += r; group[1] += g; group[2] += b; group[3]++
      groups.set(key, group)
    }
    return [...groups.values()].sort((a, b) => b[3] - a[3]).slice(0, 8).map(([r, g, b, count]) =>
      '#' + [r, g, b].map((channel) => Math.round(channel / count).toString(16).padStart(2, '0')).join(''))
  } finally {
    image.close()
  }
}

export function defaultDrawingFormat() {
  return (isAndroidApp || compactViewport.matches) && window.matchMedia('(orientation: portrait)').matches ? '900×1350' : canvasSizes[0][0]
}

export function SketchToolDock({ tool, color, history, undo, redo, open, guided }) {
  return <div className="studio-touch-tools" role="group" aria-label="Ferramentas de desenho">
    <IconButton label="Desfazer" disabled={!history.past.length} onClick={undo}><Undo2 size={20} /></IconButton>
    <IconButton label="Refazer" disabled={!history.future.length} onClick={redo}><Redo2 size={20} /></IconButton>
    <IconButton label="Ferramentas e guias" aria-haspopup="dialog" data-active={!brushes[tool] || guided}
      onClick={() => open('tools')}><Grid2X2 size={20} /></IconButton>
    <IconButton label="Cor do traço" aria-haspopup="dialog" onClick={() => open('color')}>
      <span className="studio-ink-chip" style={{ '--current-ink': color }} />
    </IconButton>
    <IconButton label="Camadas" aria-haspopup="dialog" onClick={() => open('layers')}><Layers3 size={21} /></IconButton>
  </div>
}

export function SketchBrushRail({ tool, choose, open }) {
  return <div className="studio-brush-rail" role="group" aria-label="Pincéis rápidos">
    <IconButton className="studio-rail-settings" label="Pincéis e ajustes" aria-haspopup="dialog" onClick={open}><SlidersHorizontal size={19} /></IconButton>
    <div className="studio-rail-brushes">
      {Object.entries(brushes).map(([key, { label }]) => <IconButton key={key} label={label} aria-pressed={tool === key}
        onClick={() => choose(key)}><BrushTip brush={key} /></IconButton>)}
    </div>
  </div>
}

export function SketchToolGrid({ tool, choose }) {
  return <div className="studio-touch-tool-grid" role="group" aria-label="Escolher ferramenta">
    {tools.filter(([key]) => key !== 'erase').map(([key, label, Icon]) =>
      <button type="button" key={key} aria-pressed={tool === key} onClick={() => choose(key)}>
        <Icon size={19} />{label}
      </button>
    )}
  </div>
}

function fromHex(color, defaultHue = 0) {
  const [r, g, b] = color.slice(1).match(/../g).map((channel) => parseInt(channel, 16) / 255)
  const max = Math.max(r, g, b), delta = max - Math.min(r, g, b)
  let hue = defaultHue
  if (delta) {
    if (max === r) hue = 60 * ((g - b) / delta)
    else if (max === g) hue = 60 * ((b - r) / delta + 2)
    else hue = 60 * ((r - g) / delta + 4)
    hue = (hue + 360) % 360
  }
  return { hue, saturation: max ? delta / max : 0, brightness: max }
}

function toHex({ hue, saturation, brightness }) {
  const color = (offset) => {
    const sector = (offset + hue / 60) % 6
    const channel = brightness * (1 - saturation * Math.max(0, Math.min(sector, 4 - sector, 1)))
    return Math.round(channel * 255).toString(16).padStart(2, '0')
  }
  return '#' + color(5) + color(3) + color(1)
}

export function SketchColorPicker({ color, recent, apply, sample }) {
  const [draft, setDraft] = useState(() => fromHex(color))
  const [harmony, setHarmony] = useState('similar')
  const [saved, setSaved] = useState(readColors)
  const [extracted, setExtracted] = useState([])
  const [colorMessage, setColorMessage] = useState('')
  const current = toHex(draft)

  function pick(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    setDraft((previous) => ({
      ...previous,
      saturation: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      brightness: 1 - clamp((event.clientY - rect.top) / rect.height, 0, 1),
    }))
  }

  function pickHue(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left - rect.width / 2
    const y = event.clientY - rect.top - rect.height / 2
    const hue = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360
    setDraft((previous) => ({ ...previous, hue }))
  }

  function track(change) {
    return {
      onPointerDown(event) {
        if (event.button !== 0) return
        event.currentTarget.setPointerCapture(event.pointerId)
        change(event)
      },
      onPointerMove(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) change(event)
      },
      onPointerUp(event) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) change(event)
      },
    }
  }

  function setHex(value) {
    setDraft((previous) => fromHex(value, previous.hue))
  }

  function saveColor(value) {
    const colors = [value, ...saved.filter((entry) => entry !== value)].slice(0, 20)
    setSaved(colors)
    try {
      localStorage.setItem(paletteKey, JSON.stringify(colors))
      setColorMessage('Cor guardada.')
    } catch {
      setColorMessage('A cor fica disponível só nesta sessão.')
    }
  }

  async function importColors(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const colors = await colorsFromImage(file)
      setExtracted(colors)
      setColorMessage(colors.length ? 'Cores da imagem prontas.' : 'A imagem não tem cores opacas.')
    } catch (error) {
      setColorMessage(error.message.includes('24 MB') ? error.message : 'Não foi possível ler as cores da imagem.')
    }
  }

  function colorRow(label, colors) {
    return <div className="studio-extra-swatches" role="group" aria-label={label}>
      {[...new Set(colors)].map((value) => <button key={value} type="button" aria-label={value.toUpperCase()} style={{ background: value }}
        aria-pressed={value === current} onClick={() => setHex(value)} />)}
    </div>
  }

  const angle = draft.hue * Math.PI / 180
  return <div className="studio-color-picker">
    <div className="studio-color-wheel" aria-hidden="true">
      <div className="studio-color-ring" {...track(pickHue)}>
        <span style={{ left: 50 + Math.sin(angle) * 44 + '%', top: 50 - Math.cos(angle) * 44 + '%', backgroundColor: `hsl(${draft.hue} 100% 50%)` }} />
      </div>
      <div className="studio-color-field" style={{ '--hue': draft.hue }} {...track(pick)}>
        <span style={{ left: draft.saturation * 100 + '%', top: (1 - draft.brightness) * 100 + '%', backgroundColor: current }} />
      </div>
    </div>
    <div className="studio-color-inputs">
      <label className="studio-hue"><span className="sr-only">Matiz</span>
        <input type="range" min="0" max="359" value={Math.round(draft.hue) % 360}
          onChange={(event) => setDraft({ ...draft, hue: Number(event.target.value) })} />
      </label>
      <label className="studio-color studio-color-native"><input type="color" aria-label="Cor personalizada" value={current}
        onChange={(event) => setHex(event.target.value)} /><span>{current.toUpperCase()}</span></label>
      <ColorSwatches color={current} recent={recent} change={(_, value) => setHex(value)} />
      <div className="studio-color-actions">
        <button type="button" className="button secondary" onClick={sample}><Pipette size={17} /> Conta-gotas</button>
        <button type="button" className="button primary" onClick={() => apply(current)}><Check size={17} /> Usar cor</button>
      </div>
    </div>
    <details className="studio-palette-options">
      <summary>Harmonias e paletas</summary>
      <div className="studio-palette-layout">
        <label className="studio-select"><span>Harmonia</span><select value={harmony} onChange={(event) => setHarmony(event.target.value)}>
          <option value="similar">Análoga</option><option value="opposite">Complementar</option><option value="trio">Triádica</option>
        </select></label>
        {colorRow('Cores da harmonia', harmonies[harmony].map((offset) => toHex({ ...draft, hue: (draft.hue + offset + 360) % 360 })))}
        <div className="studio-color-actions">
          <button type="button" className="button secondary" onClick={() => saveColor(current)}>Guardar cor</button>
          <label className="button secondary studio-image-palette"><ImagePlus size={17} /> Ler imagem
            <input type="file" accept="image/*" aria-label="Extrair cores de imagem" onChange={importColors} />
          </label>
        </div>
        {saved.length > 0 && colorRow('Cores guardadas', saved)}
        {extracted.length > 0 && colorRow('Cores da imagem', extracted)}
        {colorMessage && <small role="status">{colorMessage}</small>}
      </div>
    </details>
  </div>
}
