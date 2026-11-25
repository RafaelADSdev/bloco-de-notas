import { useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Check, ClipboardPaste, Copy, Crop, Droplet, Eraser, Eye, EyeOff, FlipHorizontal2,
  Grid2X2, Hand, Lasso, Layers3, Lock, Maximize, Minimize, Minus, MoreHorizontal, PaintBucket,
  Paintbrush, Pencil, Pipette, Plus, Redo2, RotateCw, Scan, Scissors, Square, Trash2, Type, Undo2, Unlock, X, Circle,
} from 'lucide-react'
import { IconButton, Menu, MenuOption } from './ui'
import { blends, brushes, drawingFrame, palettes, shapes } from './sketch-model'

const toolGroups = [
  ['Navegação e seleção', [
    ['hand', 'Mover tela', Hand, 'H'], ['select', 'Seleção retangular', Scan, 'M'], ['lasso', 'Laço', Lasso, 'L'],
  ]],
  ['Preenchimento, cor e texto', [
    ['fill', 'Balde de tinta', PaintBucket, 'G'], ['sample', 'Conta-gotas', Pipette, 'I'], ['text', 'Texto', Type, 'T'],
  ]],
  ['Formas e borracha', [
    ['line', 'Linha', Minus], ['rectangle', 'Retângulo', Square], ['ellipse', 'Elipse', Circle], ['erase', 'Borracha', Eraser, 'E'],
  ]],
]
export const tools = toolGroups.flatMap(([, entries]) => entries)

export function SketchToolbar({ tool, setTool, history, undo, redo, panel, togglePanel }) {
  return <div className="studio-toolbar" aria-label="Ferramentas do estúdio">
    <div className="studio-toolbar-group">
      <IconButton label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={19} /></IconButton>
      <IconButton label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}><Redo2 size={19} /></IconButton>
    </div>
    <div className="studio-toolbar-group studio-mobile-tools">
      <IconButton label="Abrir pincéis" aria-expanded={panel === 'brushes'} onClick={() => togglePanel('brushes')}><Paintbrush size={19} /></IconButton>
      <IconButton label="Abrir camadas" aria-expanded={panel === 'layers'} onClick={() => togglePanel('layers')}><Layers3 size={19} /></IconButton>
    </div>
    {toolGroups.map(([name, entries]) =>
      <div className="studio-toolbar-group" role="group" aria-label={name} key={name}>
        {entries.map(([key, label, Icon, short]) => <IconButton key={key} label={label} title={short ? `${label} (${short})` : label}
          aria-pressed={tool === key} onClick={() => setTool(key)}><Icon size={19} /></IconButton>)}
      </div>)}
  </div>
}

export function SketchContext({ tool, settings, change, selection, editable, editRegion, clearSelection, crop, copy, paste, canCopy, canPaste }) {
  const label = brushes[tool]?.label ?? tools.find(([key]) => key === tool)?.[1]
  return <div className="studio-context">
    <strong className="studio-current" title={label}>{label}</strong>
    <div className="studio-context-controls">
      <label><span>Simetria</span><select value={settings.symmetry} onChange={(event) => change('symmetry', event.target.value)}>
        <option value="none">Sem simetria</option><option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option><option value="both">Quatro lados</option><option value="radial">Radial ×6</option>
      </select></label>
      <label><Grid2X2 size={14} /><span>Guias</span><select value={settings.guide} onChange={(event) => change('guide', event.target.value)}>
        <option value="none">Sem guia</option><option value="grid">Grade</option>
        <option value="ruler">Régua horizontal</option><option value="perspective">Perspectiva de 1 ponto</option>
      </select></label>
      {shapes.has(tool) && tool !== 'line' && <label className="studio-check">
        <input type="checkbox" checked={settings.filled} onChange={(event) => change('filled', event.target.checked)} /> Forma preenchida
      </label>}
      {tool === 'fill' && <label className="studio-context-range"><span>Tolerância {settings.tolerance}%</span>
        <input type="range" min="0" max="100" value={settings.tolerance} onChange={(event) => change('tolerance', Number(event.target.value))} aria-label="Tolerância do balde" />
      </label>}
      {(tool === 'sample' || tool === 'text' || tool === 'hand') && <span className="studio-tool-hint">{
        { sample: 'Toque no desenho para capturar uma cor', text: 'Toque na tela para inserir texto', hand: 'Arraste para mover a visualização' }[tool]
      }</span>}
      {selection && <div className="studio-region" role="group" aria-label="Transformar seleção">
        <IconButton label="Girar seleção 90°" disabled={!editable} onClick={() => editRegion({ angle: Math.PI / 2 })}><RotateCw size={16} /></IconButton>
        <IconButton label="Espelhar seleção" disabled={!editable} onClick={() => editRegion({ scaleX: -1 })}><FlipHorizontal2 size={16} /></IconButton>
        <IconButton label="Reduzir seleção" disabled={!editable} onClick={() => editRegion({ scaleX: .8, scaleY: .8 })}><Minimize size={16} /></IconButton>
        <IconButton label="Ampliar seleção" disabled={!editable} onClick={() => editRegion({ scaleX: 1.25, scaleY: 1.25 })}><Maximize size={16} /></IconButton>
        <IconButton label="Apagar seleção" disabled={!editable} onClick={() => editRegion(null)}><Trash2 size={16} /></IconButton>
        <IconButton label="Desmarcar seleção" onClick={clearSelection}><X size={16} /></IconButton>
      </div>}
    </div>
    {(selection || canPaste) && <div className="studio-context-menu">
      <Menu label="Editar seleção" trigger={(props) => <IconButton {...props} label="Editar seleção"><MoreHorizontal size={18} /></IconButton>}>
        <MenuOption icon={Copy} disabled={!canCopy} onClick={() => copy(false)}>Copiar seleção</MenuOption>
        <MenuOption icon={Scissors} disabled={!selection || !editable} onClick={() => copy(true)}>Cortar seleção</MenuOption>
        <MenuOption icon={ClipboardPaste} disabled={!canPaste} onClick={paste}>Colar como camada</MenuOption>
        <MenuOption icon={Crop} disabled={!selection} onClick={crop}>Recortar tela à seleção</MenuOption>
      </Menu>
    </div>}
  </div>
}

function Range({ label, value, change, unit, min = 1, max = 100 }) {
  return <label className="studio-range">
    <span>{label}<output>{value}{unit}</output></span>
    <input type="range" aria-label={label} value={value} min={min} max={max} onChange={(event) => change(Number(event.target.value))} />
  </label>
}

export function BrushPanel({ tool, setTool, settings, change, changeBrush, recent, mobile, close }) {
  const hasSize = Boolean(brushes[tool]) || shapes.has(tool)
  const canPaint = hasSize || tool === 'fill'
  return <aside className={'studio-panel studio-brushes' + (mobile ? ' mobile-open' : '')} aria-label="Paleta de pincéis">
    <div className="studio-panel-head"><h2><Paintbrush size={17} /> Pincéis</h2><IconButton className="studio-mobile-close" label="Fechar pincéis" onClick={close}><X size={18} /></IconButton></div>
    <div className="studio-brush-grid">
      {Object.entries(brushes).map(([key, brush]) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => setTool(key)}>
        <span aria-hidden="true" className={`studio-brush-mark mark-${key}`} />{brush.label}
      </button>)}
    </div>
    <section className="studio-panel-section" aria-label="Cor e ajustes">
      <div className="studio-section-title">
        <h3><Droplet size={14} /> Cor</h3>
        <label className="studio-color"><span>{settings.color.toUpperCase()}</span>
          <input type="color" aria-label="Cor personalizada" value={settings.color} onChange={(event) => change('color', event.target.value)} />
        </label>
      </div>
      <div className="studio-swatches" aria-label="Paleta de cores">
        {[...palettes, ...recent.filter((color) => palettes.every(([, hex]) => hex !== color)).map((color) => [color, color])].map(([label, color]) =>
          <button key={color} type="button" title={label} aria-label={label} aria-pressed={settings.color === color}
            style={{ '--swatch': color }} onClick={() => change('color', color)}>{settings.color === color && <Check size={13} />}</button>)}
      </div>
      {hasSize && <Range label="Tamanho" value={settings.size} change={(value) => changeBrush('size', value)} unit=" px" max={160} />}
      {canPaint && <Range label="Opacidade do traço" value={settings.opacity} change={(value) => changeBrush('opacity', value)} unit="%" />}
      {brushes[tool] && <>
        <Range label="Suavização" value={settings.smoothing} change={(value) => change('smoothing', value)} min={0} max={90} unit="%" />
        <label className="studio-check"><input type="checkbox" checked={settings.pressure} onChange={(event) => change('pressure', event.target.checked)} /> Pressão da caneta</label>
        <label className="studio-check"><input type="checkbox" checked={settings.penOnly} onChange={(event) => change('penOnly', event.target.checked)} /> Desenhar só com caneta ou mouse</label>
      </>}
    </section>
  </aside>
}

function Thumbnail({ layer, renderer, imageVersion, frame }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const ctx = ref.current.getContext('2d')
    const source = renderer.renderLayer(layer)
    const { x, y, width, height } = frame
    const scale = Math.min(50 / width, 38 / height)
    const w = width * scale, h = height * scale
    ctx.clearRect(0, 0, 50, 38)
    ctx.drawImage(source, x, y, width, height, (50 - w) / 2, (38 - h) / 2, w, h)
  }, [renderer, layer.strokes, imageVersion, frame.x, frame.y, frame.width, frame.height])
  return <canvas className="studio-thumb" ref={ref} width={50} height={38} aria-hidden="true" />
}

function LayerOpacity({ layer, preview, commit }) {
  const [value, setValue] = useState(null)
  function finish() {
    if (value == null) return
    preview(null)
    setValue(null)
    if (value !== Math.round(layer.opacity * 100)) commit(value / 100)
  }
  const current = value ?? Math.round(layer.opacity * 100)
  return <label className="studio-range">
    <span>Opacidade da camada<output>{current}%</output></span>
    <input type="range" aria-label="Opacidade da camada" value={current} min="0" max="100"
      onChange={(event) => { const next = Number(event.target.value); setValue(next); preview(next / 100) }}
      onKeyUp={finish} onPointerUp={finish} onPointerCancel={finish} onBlur={finish} />
  </label>
}

export function LayerPanel({ drawing, active, select, renderer, imageVersion, add, update, layerAction, modify, preview, mobile, close }) {
  const frame = drawingFrame(drawing)
  return <aside className={'studio-panel studio-layers' + (mobile ? ' mobile-open' : '')} aria-label="Camadas">
    <div className="studio-panel-head">
      <h2><Layers3 size={17} /> Camadas</h2>
      <div><IconButton label="Adicionar camada" onClick={add}><Plus size={19} /></IconButton>
        <IconButton className="studio-mobile-close" label="Fechar camadas" onClick={close}><X size={18} /></IconButton></div>
    </div>
    <ul className="studio-layer-list">
      {[...drawing.layers].reverse().map((layer, index) => <li key={layer.id} className={layer.id === active.id ? 'active' : ''}>
        <button className="studio-layer-select" aria-pressed={layer.id === active.id} onClick={() => select(layer.id)}>
          <Thumbnail layer={layer} renderer={renderer} imageVersion={imageVersion} frame={frame} />
          <span title={layer.name}>{layer.name}<small>{layer.strokes.some((s) => s.kind === 'text') ? 'Texto' : layer.strokes.some((s) => s.kind === 'image') ? 'Imagem' : 'Desenho'}{layer.locked && <Lock size={11} aria-label="Bloqueada" />}</small></span>
        </button>
        <IconButton label={layer.visible ? 'Ocultar ' + layer.name : 'Mostrar ' + layer.name} onClick={() => update(layer.id, { visible: !layer.visible })}>
          {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
        </IconButton>
        <Menu label={`Opções de ${layer.name}`} trigger={(props) => <IconButton {...props} label={`Opções de ${layer.name}`}><MoreHorizontal size={18} /></IconButton>}>
          <MenuOption icon={Pencil} onClick={() => modify('rename', layer)}>Renomear camada</MenuOption>
          {layer.strokes.some((s) => s.kind === 'text') && <MenuOption icon={Type} disabled={layer.locked} onClick={() => modify('text', layer)}>Editar texto</MenuOption>}
          <MenuOption icon={layer.locked ? Unlock : Lock} onClick={() => update(layer.id, { locked: !layer.locked })}>{layer.locked ? 'Desbloquear camada' : 'Bloquear camada'}</MenuOption>
          <MenuOption icon={Copy} onClick={() => layerAction('copy', layer.id)}>Duplicar camada</MenuOption>
          <MenuOption icon={ArrowUp} disabled={index === 0} onClick={() => layerAction('up', layer.id)}>Subir camada</MenuOption>
          <MenuOption icon={ArrowDown} disabled={index === drawing.layers.length - 1} onClick={() => layerAction('down', layer.id)}>Descer camada</MenuOption>
          <MenuOption icon={Trash2} danger disabled={layer.locked || drawing.layers.length === 1} onClick={() => layerAction('remove', layer.id)}>Excluir camada</MenuOption>
        </Menu>
      </li>)}
    </ul>
    <section className="studio-panel-section studio-layer-settings" aria-label="Ajustes da camada ativa">
      <label className="studio-select"><span>Modo de mesclagem</span><select value={active.blend} onChange={(event) => update(active.id, { blend: event.target.value })}>
        {Object.entries(blends).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select></label>
      <LayerOpacity key={active.id} layer={active} preview={preview} commit={(opacity) => update(active.id, { opacity })} />
    </section>
  </aside>
}
