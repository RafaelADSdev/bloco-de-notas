import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { brushes, clamp } from './sketch-model'
import { IconButton } from './ui'

const storageKey = 'linha-clara:pinceis-do-estudio'
const brushRanges = { size: [1, 160], opacity: [1, 100], spacing: [10, 150] }
const strokeRanges = { smoothing: [0, 90], stabilizer: [0, 80], prediction: [0, 5] }
const stampShapes = new Set(['diamond', 'circle', 'square'])

function settingsFor(values) {
  const result = {}
  for (const [key, [min, max]] of Object.entries({ ...brushRanges, ...strokeRanges })) {
    if (Number.isFinite(values[key])) result[key] = clamp(values[key], min, max)
  }
  if (stampShapes.has(values.stampShape)) result.stampShape = values.stampShape
  if (typeof values.pressure === 'boolean') result.pressure = values.pressure
  return result
}

function savedPresets() {
  try {
    const values = JSON.parse(localStorage.getItem(storageKey))
    if (!Array.isArray(values)) return []
    return values.filter((preset) => preset && typeof preset.name === 'string' && preset.name.trim()
      && Object.hasOwn(brushes, preset.tool) && preset.options).slice(0, 24)
      .map((preset) => ({ name: preset.name.slice(0, 50), tool: preset.tool, options: settingsFor(preset.options) }))
  } catch {
    return []
  }
}

export function SketchBrushPresets({ tool, settings, usePreset }) {
  const [presets, setPresets] = useState(savedPresets)
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')

  function store(next) {
    setPresets(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setMessage('')
    } catch {
      setMessage('Os pincéis salvos ficam disponíveis só neste painel.')
    }
  }

  function save(event) {
    event.preventDefault()
    if (!name.trim() || !Object.hasOwn(brushes, tool)) return
    const label = name.trim()
    store([{ name: label, tool, options: settingsFor(settings) }, ...presets.filter((preset) => preset.name !== label)].slice(0, 24))
    setName('')
  }

  return <details className="studio-brush-presets">
    <summary>Meus pincéis</summary>
    {presets.map((preset, index) => <div className="studio-brush-preset" key={preset.name + index}>
      <button type="button" className="button secondary" onClick={() => usePreset(preset)}>{preset.name}</button>
      <IconButton label={'Remover pincel ' + preset.name} onClick={() => store(presets.filter((_, i) => i !== index))}><Trash2 size={16} /></IconButton>
    </div>)}
    {Object.hasOwn(brushes, tool) && <form onSubmit={save}>
      <label className="form-label">Nome do pincel<input value={name} maxLength={50} placeholder={brushes[tool].label}
        onChange={(event) => setName(event.target.value)} required /></label>
      <button type="submit" className="button secondary" disabled={!name.trim()}>Guardar ajustes</button>
    </form>}
    {message && <small role="status">{message}</small>}
  </details>
}
