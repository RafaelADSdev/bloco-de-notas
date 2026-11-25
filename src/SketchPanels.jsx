import { useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowDown, ArrowUp, Blend, Check, ClipboardPaste, Copy, Crop, Droplet, Eraser, Eye, EyeOff, FlipHorizontal2,
  Grid2X2, Hand, Lasso, Layers3, Lock, Maximize, Minimize, Minus, MoreHorizontal, PaintBucket,
  Paintbrush, Pencil, Pipette, Plus, Redo2, RotateCw, Scan, Scissors, Square, Trash2, Type, Undo2, Unlock, X, Circle,
} from 'lucide-react'
import { IconButton, Menu, MenuOption } from './ui'
import { SketchBrushPresets } from './SketchBrushPresets'
import { blends, brushes, canMergeDown, drawingFrame, layerLabels, palettes, shapes } from './sketch-model'

const toolGroups = [
  ['Navegação e seleção', [
    ['hand', 'Mover tela', Hand, 'H'], ['select', 'Seleção retangular', Scan, 'M'], ['lasso', 'Laço', Lasso, 'L'],
  ]],
  ['Preenchimento, cor e texto', [
    ['fill', 'Balde de tinta', PaintBucket, 'G'], ['gradient', 'Degradê', Blend], ['area-fill', 'Laço preenchido', Lasso],
    ['sample', 'Conta-gotas', Pipette, 'I'], ['text', 'Texto', Type, 'T'],
  ]],
  ['Formas e borracha', [
    ['line', 'Linha', Minus], ['rectangle', 'Retângulo', Square], ['ellipse', 'Elipse', Circle], ['erase', 'Borracha', Eraser, 'E'],
  ]],
]
export const tools = toolGroups.flatMap(([, entries]) => entries)
const symmetryOptions = [['none', 'Nenhuma'], ['vertical', 'Vertical'], ['horizontal', 'Horizontal'], ['both', '4 lados'], ['free', 'Livre'], ['radial', 'Radial']]
const guideOptions = [['none', 'Nenhuma'], ['grid', 'Grade'], ['ruler', 'Régua'], ['ellipse', 'Elipse'],
  ['perspective', '1 ponto'], ['perspective2', '2 pontos'], ['perspective3', '3 pontos']]

function ViewOptions({ label, options, value, change }) {
  return <div className="studio-view-options" role="group" aria-label={label}>
    <span>{label}</span>
    <div>{options.map(([key, text]) => <button type="button" key={key} aria-pressed={value === key}
      onClick={() => change(key)}>{text}</button>)}</div>
  </div>
}

export function SketchToolbar({ tool, setTool, history, undo, redo }) {
  return <div className="studio-toolbar" aria-label="Ferramentas do estúdio">
    <div className="studio-toolbar-group">
      <IconButton label="Desfazer" title="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo}><Undo2 size={19} /></IconButton>
      <IconButton label="Refazer" title="Refazer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo}><Redo2 size={19} /></IconButton>
    </div>
    {toolGroups.map(([name, entries]) =>
      <div className="studio-toolbar-group" role="group" aria-label={name} key={name}>
        {entries.map(([key, label, Icon, short]) => <IconButton key={key} label={label} title={short ? `${label} (${short})` : label}
          aria-pressed={tool === key} onClick={() => setTool(key)}><Icon size={19} /></IconButton>)}
      </div>)}
  </div>
}

export function SketchContext({ tool, settings, change, selection, editable, editRegion, paintSelection, clearSelection, crop, copy, paste, position, canCopy, canPaste, compact = false }) {
  const label = brushes[tool]?.label ?? tools.find(([key]) => key === tool)?.[1]
  const adjustingGuide = settings.guide !== 'none' && settings.guide !== 'grid'
  const adjustingSymmetry = settings.symmetry !== 'none'
  const precision = <>
    {adjustingGuide && <div className="studio-precision-fields" role="group" aria-label="Posição da guia">
      <button type="button" className="button secondary" onClick={() => position('guide')}>Posicionar guia na folha</button>
      <label className="studio-check"><input type="checkbox" checked={settings.guideSnap}
        onChange={(event) => change('guideSnap', event.target.checked)} /> Encaixar traço na guia</label>
      <Range label="Opacidade da guia" value={settings.guideOpacity} change={(value) => change('guideOpacity', value)} min={10} unit="%" />
      {settings.guide.startsWith('perspective') &&
        <Range label="Densidade da perspectiva" value={settings.guideDensity} change={(value) => change('guideDensity', value)} min={4} max={24} />}
      <Range label="Centro horizontal da guia" value={settings.guideX} change={(value) => change('guideX', value)} min={0} unit="%" />
      <Range label="Altura da guia" value={settings.guideY} change={(value) => change('guideY', value)} min={0} unit="%" />
      {['ruler', 'ellipse'].includes(settings.guide) &&
        <Range label="Ângulo da guia" value={settings.guideAngle} change={(value) => change('guideAngle', value)} min={-180} max={180} unit="°" />}
      {settings.guide === 'ellipse' && <>
        <Range label="Largura da guia elíptica" value={settings.ellipseWidth} change={(value) => change('ellipseWidth', value)} min={5} unit="%" />
        <Range label="Altura da guia elíptica" value={settings.ellipseHeight} change={(value) => change('ellipseHeight', value)} min={5} unit="%" />
      </>}
    </div>}
    {adjustingSymmetry && <div className="studio-precision-fields" role="group" aria-label="Ajustes da simetria">
      <button type="button" className="button secondary" onClick={() => position('symmetry')}>Posicionar centro na folha</button>
      <Range label="Centro horizontal da simetria" value={settings.symmetryX} change={(value) => change('symmetryX', value)} min={0} unit="%" />
      <Range label="Centro vertical da simetria" value={settings.symmetryY} change={(value) => change('symmetryY', value)} min={0} unit="%" />
      {(settings.symmetry === 'radial' || settings.symmetry === 'free') &&
        <Range label={settings.symmetry === 'radial' ? 'Ângulo das guias radiais' : 'Ângulo da simetria'}
          value={settings.symmetryAngle} change={(value) => change('symmetryAngle', value)} min={-180} max={180} unit="°" />}
      {settings.symmetry === 'radial' &&
        <Range label="Repetições da simetria" value={settings.symmetryCount} change={(value) => change('symmetryCount', value)} min={2} max={16} />}
    </div>}
  </>
  return <div className={'studio-context' + (compact ? ' studio-context-compact' : '')}>
    <strong className="studio-current" title={label}>{label}</strong>
    <div className="studio-context-controls">
      {compact ? <>
        <ViewOptions label="Simetria" options={symmetryOptions} value={settings.symmetry} change={(value) => change('symmetry', value)} />
        <ViewOptions label="Guias" options={guideOptions} value={settings.guide} change={(value) => change('guide', value)} />
      </> : <><label><span>Simetria</span><select value={settings.symmetry} onChange={(event) => change('symmetry', event.target.value)}>
        <option value="none">Sem simetria</option><option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option><option value="both">Quatro lados</option><option value="free">Eixo livre</option><option value="radial">Radial</option>
      </select></label>
      <label><Grid2X2 size={14} /><span>Guias</span><select value={settings.guide} onChange={(event) => change('guide', event.target.value)}>
        <option value="none">Sem guia</option><option value="grid">Grade</option>
        <option value="ruler">Régua</option><option value="ellipse">Guia elíptica</option>
        <option value="perspective">Perspectiva de 1 ponto</option><option value="perspective2">Perspectiva de 2 pontos</option>
        <option value="perspective3">Perspectiva de 3 pontos</option>
      </select></label></>}
      {shapes.has(tool) && tool !== 'line' && <label className="studio-check">
        <input type="checkbox" checked={settings.filled} onChange={(event) => change('filled', event.target.checked)} /> Forma preenchida
      </label>}
      {tool === 'fill' && <label className="studio-context-range"><span>Tolerância {settings.tolerance}%</span>
        <input type="range" min="0" max="100" value={settings.tolerance} onChange={(event) => change('tolerance', Number(event.target.value))} aria-label="Tolerância do balde" />
      </label>}
      {tool === 'gradient' && <label className="studio-gradient-options"><span>Cor final</span>
        <input type="color" aria-label="Cor final do degradê" value={settings.endColor} onChange={(event) => change('endColor', event.target.value)} />
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
        <MenuOption icon={PaintBucket} disabled={!selection || !editable} onClick={() => paintSelection('area-fill')}>Preencher seleção</MenuOption>
        <MenuOption icon={Square} disabled={!selection || !editable} onClick={() => paintSelection('area-outline')}>Contornar seleção</MenuOption>
      </Menu>
    </div>}
    {(adjustingGuide || adjustingSymmetry) && (compact
      ? <details className="studio-precision"><summary>Ajustar posição e ângulo</summary>{precision}</details>
      : <Menu label="Ajustar guias e simetria" trigger={(props) => <IconButton {...props} label="Ajustar guias e simetria"><Grid2X2 size={16} /></IconButton>}>{precision}</Menu>)}
  </div>
}

function Range({ label, value, change, unit, min = 1, max = 100 }) {
  return <label className="studio-range">
    <span>{label}<output>{value}{unit}</output></span>
    <input type="range" aria-label={label} value={value} min={min} max={max} onChange={(event) => change(Number(event.target.value))} />
  </label>
}

export function ColorSwatches({ color: current, recent, change }) {
  return <div className="studio-swatches" aria-label="Paleta de cores">
    {[...palettes, ...recent.filter((color) => palettes.every(([, hex]) => hex !== color)).map((color) => [color, color])].map(([label, color]) =>
      <button key={color} type="button" title={label} aria-label={label} aria-pressed={current === color}
        style={{ '--swatch': color }} onClick={() => change('color', color)}>{current === color && <Check size={13} />}</button>)}
  </div>
}

export function BrushTip({ brush }) {
  return <span className={'studio-brush-tip tip-' + brush} aria-hidden="true"><i /></span>
}

export function BrushPanel({ tool, setTool, settings, change, changeBrush, recent, openColor, usePreset, compact = false }) {
  const hasSize = Boolean(brushes[tool]) || shapes.has(tool)
  const canPaint = hasSize || ['fill', 'gradient', 'area-fill'].includes(tool)
  return <aside className="studio-panel studio-brushes" aria-label="Paleta de pincéis">
    {!compact && <div className="studio-panel-head"><h2><Paintbrush size={17} /> Pincéis</h2></div>}
    <div className="studio-brush-grid">
      {Object.entries(brushes).map(([key, brush]) => <button key={key} type="button" aria-pressed={tool === key} onClick={() => setTool(key)}>
        {compact ? <BrushTip brush={key} /> : <span aria-hidden="true" className={`studio-brush-mark mark-${key}`} />}{brush.label}
      </button>)}
    </div>
    <section className="studio-panel-section" aria-label={compact ? 'Ajustes do pincel' : 'Cor e ajustes'}>
      {!compact && <><div className="studio-section-title">
        <h3><Droplet size={14} /> Cor</h3>
        <label className="studio-color"><span>{settings.color.toUpperCase()}</span>
          <input type="color" aria-label="Cor personalizada" value={settings.color} onChange={(event) => change('color', event.target.value)} />
        </label>
      </div><ColorSwatches color={settings.color} recent={recent} change={change} />
      <button type="button" className="button secondary studio-open-color" onClick={openColor}>Editar cores</button></>}
      {hasSize && <Range label="Tamanho" value={settings.size} change={(value) => changeBrush('size', value)} unit=" px" max={160} />}
      {canPaint && <Range label="Opacidade do traço" value={settings.opacity} change={(value) => changeBrush('opacity', value)} unit="%" />}
      {brushes[tool] && <>
        <Range label="Suavização" value={settings.smoothing} change={(value) => change('smoothing', value)} min={0} max={90} unit="%" />
        <Range label="Estabilizador" value={settings.stabilizer} change={(value) => change('stabilizer', value)} min={0} max={80} unit=" px" />
        <Range label="Traço preditivo" value={settings.prediction} change={(value) => change('prediction', value)} min={0} max={5} />
        {(tool === 'stamp' || tool === 'splatter') &&
          <Range label="Espaçamento" value={settings.spacing ?? (tool === 'stamp' ? 65 : 40)} change={(value) => changeBrush('spacing', value)} min={10} max={150} unit="%" />}
        {tool === 'stamp' && <label className="studio-select"><span>Formato do carimbo</span>
          <select value={settings.stampShape ?? 'diamond'} onChange={(event) => changeBrush('stampShape', event.target.value)}>
            <option value="diamond">Losango</option><option value="square">Quadrado</option><option value="circle">Círculo</option>
          </select>
        </label>}
        <label className="studio-check"><input type="checkbox" checked={settings.pressure} onChange={(event) => change('pressure', event.target.checked)} /> Pressão da caneta</label>
        <label className="studio-check"><input type="checkbox" checked={settings.penOnly} onChange={(event) => change('penOnly', event.target.checked)} /> Desenhar só com caneta ou mouse</label>
      </>}
      <SketchBrushPresets tool={tool} settings={settings} usePreset={usePreset} />
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
  }, [renderer, layer.strokes, layer.adjustments, imageVersion, frame.x, frame.y, frame.width, frame.height])
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

export function LayerPanel({ drawing, active, select, renderer, imageVersion, add, update, layerAction, modify, preview, compact = false }) {
  const frame = drawingFrame(drawing)
  const activeIndex = drawing.layers.indexOf(active)
  const visibleLayers = drawing.layers.filter((layer) => layer.visible)
  const canMergeVisible = visibleLayers.length > 1 && visibleLayers.every((layer) => !layer.locked)
  return <aside className="studio-panel studio-layers" aria-label="Camadas">
    {!compact && <div className="studio-panel-head">
      <h2><Layers3 size={17} /> Camadas</h2><IconButton label="Adicionar camada" onClick={add}><Plus size={19} /></IconButton>
    </div>}
    <ul className="studio-layer-list">
      {[...drawing.layers].reverse().map((layer, index) => <li key={layer.id} className={layer.id === active.id ? 'active' : ''} data-layer-color={layer.colorLabel}>
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
          <MenuOption icon={Droplet} disabled={layer.locked} onClick={() => modify('color', layer)}>Ajustar cor</MenuOption>
          <MenuOption icon={ArrowDown} disabled={!canMergeDown(drawing.layers, drawing.layers.length - index - 1)}
            onClick={() => layerAction('merge', layer.id)}>Mesclar com a camada abaixo</MenuOption>
          <MenuOption icon={Layers3} disabled={!canMergeVisible} onClick={() => layerAction('merge-visible', layer.id)}>Mesclar camadas visíveis</MenuOption>
          <MenuOption icon={Trash2} disabled={layer.locked || !layer.strokes.length} onClick={() => update(layer.id, { strokes: [] })}>Limpar camada</MenuOption>
          <MenuOption icon={ArrowUp} disabled={index === 0} onClick={() => layerAction('up', layer.id)}>Subir camada</MenuOption>
          <MenuOption icon={ArrowDown} disabled={index === drawing.layers.length - 1} onClick={() => layerAction('down', layer.id)}>Descer camada</MenuOption>
          <MenuOption icon={Trash2} danger disabled={layer.locked || drawing.layers.length === 1} onClick={() => layerAction('remove', layer.id)}>Excluir camada</MenuOption>
        </Menu>
      </li>)}
    </ul>
    <section className="studio-panel-section studio-layer-settings" aria-label="Ajustes da camada ativa">
      {compact && <div className="studio-layer-tools" role="group" aria-label="Comandos da camada ativa">
        <button type="button" onClick={() => modify('rename', active)}><Pencil size={18} />Renomear</button>
        <button type="button" onClick={() => layerAction('copy', active.id)}><Copy size={18} />Duplicar</button>
        <button type="button" onClick={() => update(active.id, { locked: !active.locked })}>
          {active.locked ? <Unlock size={18} /> : <Lock size={18} />}{active.locked ? 'Desbloquear' : 'Bloquear'}
        </button>
        <button type="button" disabled={activeIndex === drawing.layers.length - 1} onClick={() => layerAction('up', active.id)}><ArrowUp size={18} />Subir</button>
        <button type="button" disabled={activeIndex === 0} onClick={() => layerAction('down', active.id)}><ArrowDown size={18} />Descer</button>
        <button type="button" disabled={active.locked || drawing.layers.length === 1} onClick={() => layerAction('remove', active.id)}><Trash2 size={18} />Excluir</button>
      </div>}
      <label className="studio-select"><span>Modo de mesclagem</span><select value={active.blend} onChange={(event) => update(active.id, { blend: event.target.value })}>
        {Object.entries(blends).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select></label>
      <label className="studio-select"><span>Etiqueta de cor</span><select value={active.colorLabel ?? 'none'} onChange={(event) => update(active.id, { colorLabel: event.target.value })}>
        {Object.entries(layerLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
      </select></label>
      <LayerOpacity key={active.id} layer={active} preview={preview} commit={(opacity) => update(active.id, { opacity })} />
      <label className="studio-check"><input type="checkbox" checked={!!active.alphaLock} disabled={active.locked}
        onChange={(event) => update(active.id, { alphaLock: event.target.checked })} /> Bloquear transparência</label>
      <label className="studio-check"><input type="checkbox" checked={!!active.clipToBelow} disabled={activeIndex === 0 && !active.clipToBelow}
        onChange={(event) => update(active.id, { clipToBelow: event.target.checked })} /> Máscara de recorte</label>
    </section>
  </aside>
}
