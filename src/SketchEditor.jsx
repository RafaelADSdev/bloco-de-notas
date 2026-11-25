import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, Download, Expand, ImagePlus, Images, Minimize2, Pencil, Plus, Save, Square } from 'lucide-react'
import { IconButton, Menu, MenuOption } from './ui'
import { SketchCanvas } from './SketchCanvas'
import { DrawingHelp, DrawingNameForm, DrawingTextForm } from './SketchDialogs'
import { BrushPanel, LayerPanel, SketchContext, SketchToolbar, tools } from './SketchPanels'
import { bounds, brushes, clamp, drawingFrame, editHistory, newLayer, numberedLayer, paper, shapes, transformPoints, updateLayer } from './sketch-model'
import { bitmap, captureRegion, encode, imageLayer } from './sketch-raster'
import { studioRenderer } from './sketch-render'
import { fileName, saveFile } from './model'

const storageLabels = {
  saved: 'Salvo neste navegador',
  confirmed: 'Desenho salvo neste navegador',
  saving: 'Salvando…',
  error: 'O navegador não salvou as alterações',
}

export function SketchEditor({ initial, leave, save, storage, newDrawing, gallery, clipboard, externalDialog }) {
  const [history, edit] = useReducer(editHistory, { drawing: initial, past: [], future: [] })
  const { drawing } = history
  const [tool, setTool] = useState('pencil')
  const lastBrush = useRef('pencil')
  const [brushOptions, setBrushOptions] = useState({})
  const [options, setOptions] = useState({
    color: '#243129', smoothing: 28, pressure: true, penOnly: false,
    symmetry: 'none', guide: 'none', filled: false, tolerance: 15,
  })
  const [recent, setRecent] = useState([])
  const [selection, setSelection] = useState(null)
  const [alpha, setAlpha] = useState(null)
  const [space, setSpace] = useState(false)
  const [panel, setPanel] = useState(null)
  const [focused, setFocused] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const [canPaste, setCanPaste] = useState(() => Boolean(clipboard.current))
  const [imageVersion, refreshImages] = useReducer((version) => version + 1, 0)
  const input = useRef(null)
  const mounted = useRef(true)
  const renderer = useMemo(() => studioRenderer(drawing.width, drawing.height, refreshImages), [drawing.width, drawing.height])
  const active = drawing.layers.find((layer) => layer.id === drawing.active) ?? drawing.layers.at(-1)
  const editable = active.visible && !active.locked
  const frame = drawingFrame(drawing)
  const brushKey = brushes[tool] ? tool : shapes.has(tool) ? 'shape' : tool
  const settings = { ...options, size: 5, opacity: 100, ...brushes[tool], ...brushOptions[brushKey] }

  useEffect(() => { save(drawing) }, [drawing, save])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  function commit(update) {
    edit({ type: 'commit', update })
  }

  function chooseTool(key) {
    if (brushes[key] && key !== 'erase') lastBrush.current = key
    setTool(key)
    setPanel(null)
    setMessage(null)
  }

  function option(key, value) {
    setOptions((previous) => ({ ...previous, [key]: value }))
    if (key === 'color') setRecent((previous) => [value, ...previous.filter((color) => color !== value)].slice(0, 5))
  }

  function changeBrush(key, value) {
    setBrushOptions((previous) => ({ ...previous, [brushKey]: { ...previous[brushKey], [key]: value } }))
  }

  function undoRedo(type) {
    setSelection(null)
    setAlpha(null)
    setMessage(null)
    edit({ type })
  }

  function select(id) {
    if (id === active.id) return
    setSelection(null)
    setAlpha(null)
    edit({ type: 'select', id })
  }

  function append(layer) {
    setSelection(null)
    setAlpha(null)
    commit((previous) => {
      const layers = [...previous.layers]
      layers.splice(layers.findIndex((entry) => entry.id === previous.active) + 1, 0, layer)
      return { ...previous, layers, active: layer.id }
    })
  }

  function update(id, changes) {
    commit((previous) => updateLayer(previous, id, (layer) => ({ ...layer, ...changes })))
  }

  function addOperation(id, operation) {
    commit((previous) => {
      const layer = previous.layers.find((entry) => entry.id === id)
      if (!layer?.visible || layer.locked) return previous
      return updateLayer(previous, id, (current) => ({ ...current, strokes: [...current.strokes, operation] }))
    })
  }

  function layerAction(action, layerId) {
    setSelection(null)
    setAlpha(null)
    const copy = action === 'copy' ? newLayer('') : null
    commit((previous) => {
      const layers = [...previous.layers]
      const index = layers.findIndex((layer) => layer.id === layerId)
      if (index < 0) return previous
      const [layer] = layers.splice(index, 1)
      if (action === 'remove') {
        return { ...previous, layers, active: previous.active === layerId ? layers[Math.max(0, index - 1)].id : previous.active }
      }
      if (copy) {
        layers.splice(index, 0, layer, { ...layer, id: copy.id, name: layer.name + ' — cópia', locked: false })
        return { ...previous, layers, active: copy.id }
      }
      layers.splice(index + (action === 'up' ? 1 : -1), 0, layer)
      return { ...previous, layers }
    })
  }

  function editRegion(transform) {
    if (!selection || !editable) return
    addOperation(active.id, { kind: 'region', points: selection, transform })
    setSelection(transform ? transformPoints(selection, transform) : null)
  }

  function crop() {
    if (!selection) return
    const box = bounds(selection)
    const x = clamp(Math.floor(box.left), frame.x, frame.x + frame.width)
    const y = clamp(Math.floor(box.top), frame.y, frame.y + frame.height)
    const width = clamp(Math.ceil(box.right), frame.x, frame.x + frame.width) - x
    const height = clamp(Math.ceil(box.bottom), frame.y, frame.y + frame.height) - y
    if (width < 2 || height < 2) return
    commit((previous) => ({ ...previous, frame: { x, y, width, height } }))
    setSelection(null)
  }

  function copy(cut) {
    if (!selection || !active.visible || (cut && !editable)) return
    const captured = captureRegion(renderer.renderLayer(active), selection)
    if (!captured) return
    clipboard.current = { ...captured, blob: encode(captured.image).catch(() => null) }
    setCanPaste(true)
    if (cut) editRegion(null)
    setMessage(cut ? 'Seleção cortada' : 'Seleção copiada')
  }

  async function paste() {
    const copied = clipboard.current
    if (!copied) return
    const blob = await copied.blob
    if (!mounted.current) return
    if (!blob) return setMessage('Não foi possível colar a seleção.')
    const scale = Math.min(1, frame.width / copied.image.width, frame.height / copied.image.height)
    const w = copied.image.width * scale, h = copied.image.height * scale
    const operation = {
      kind: 'image', blob, w, h,
      x: clamp(copied.x + 16, frame.x, frame.x + frame.width - w),
      y: clamp(copied.y + 16, frame.y, frame.y + frame.height - h),
    }
    append({ ...newLayer('Seleção colada'), strokes: [operation] })
    setMessage(null)
  }

  useEffect(() => {
    function keydown(event) {
      if (dialog || externalDialog) return
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        setPanel(null)
        setSelection(null)
        return
      }
      if ((event.ctrlKey || event.metaKey) && key === 's' && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        if (!busy && !event.repeat) save(drawing, true)
        return
      }
      if (event.target.closest('input, textarea, select, [contenteditable]')) return
      if ((event.ctrlKey || event.metaKey) && (key === 'z' || key === 'y')) {
        event.preventDefault()
        undoRedo(key === 'y' || event.shiftKey ? 'redo' : 'undo')
        return
      }
      if (event.ctrlKey || event.metaKey) {
        if (key === 'v' && canPaste) {
          event.preventDefault()
          paste()
        }
        if ((key === 'c' || key === 'x') && selection && active.visible && (key === 'c' || editable)) {
          event.preventDefault()
          copy(key === 'x')
        }
        return
      }
      if (event.altKey || event.repeat) return
      if (key === ' ' && !event.target.closest('button')) {
        event.preventDefault()
        setSpace(true)
      }
      if (key === 'delete' && selection) editRegion(null)
      if (key === 'b') chooseTool(lastBrush.current)
      const match = tools.find(([, , , shortcut]) => shortcut?.toLowerCase() === key)
      if (match) chooseTool(match[0])
    }
    function keyup(event) { if (event.key === ' ') setSpace(false) }
    function blur() { setSpace(false) }
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      window.removeEventListener('blur', blur)
    }
  })

  async function importImage(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const operation = await imageLayer(file, frame.width, frame.height)
      operation.x += frame.x
      operation.y += frame.y
      if (mounted.current) append({ ...newLayer(file.name.replace(/\.[^.]+$/, '').slice(0, 90) || 'Imagem'), strokes: [operation] })
    } catch {
      if (mounted.current) setMessage('Não foi possível abrir a imagem.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function exportImage(format) {
    setBusy(true)
    setMessage(null)
    try {
      await renderer.ready(drawing.layers)
      const png = format !== 'jpeg'
      const surface = bitmap(drawing.width, drawing.height)
      const ctx = surface.getContext('2d')
      renderer.paint(ctx, { ...drawing, background: format === 'transparent' ? null : drawing.background ?? (png ? null : '#ffffff') })
      let output = surface
      if (drawing.frame) {
        output = bitmap(frame.width, frame.height)
        output.getContext('2d').drawImage(surface, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
      }
      const blob = await encode(output, png ? 'image/png' : 'image/jpeg', .94)
      await saveFile(blob, blob.type, fileName(drawing.name) + (png ? '.png' : '.jpg'))
    } catch {
      if (mounted.current) setMessage('Não foi possível exportar a imagem.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const renderedDrawing = useMemo(() => alpha == null ? drawing : updateLayer(drawing, active.id, (layer) => ({ ...layer, opacity: alpha })), [drawing, active.id, alpha])
  const status = message ?? (!active.visible ? 'Camada oculta' : active.locked ? 'Camada bloqueada' : '')
  const toggle = (key) => setPanel((value) => value === key ? null : key)
  const close = () => setDialog(null)
  const dialogLayer = dialog?.layer && drawing.layers.find((layer) => layer.id === dialog.layer)
  const textOperation = dialogLayer?.strokes.find((operation) => operation.kind === 'text')

  return <>
    <header className="studio-header">
      <div className="studio-brand">
        <button type="button" className="studio-return" aria-label="Voltar à biblioteca" onClick={leave}><ArrowLeft size={18} /><span>Biblioteca</span></button>
        <h1>Estúdio de desenho</h1>
      </div>
      <div className="studio-document">
        <Menu label="Opções do desenho" trigger={(props) => <button {...props} className="studio-name"><span>{drawing.name}</span><ChevronDown size={15} /></button>}>
          <MenuOption icon={Pencil} onClick={() => setDialog({ type: 'rename' })}>Renomear desenho</MenuOption>
          <MenuOption icon={Square} onClick={() => commit((previous) => ({ ...previous, background: previous.background ? null : paper }))}>
            {drawing.background ? 'Usar fundo transparente' : 'Usar fundo de papel'}
          </MenuOption>
        </Menu>
        <span className="studio-storage" role="status" data-status={storage}>{storageLabels[storage]}</span>
      </div>
      <div className="studio-header-actions">
        <button type="button" className="button secondary studio-new" aria-label="Novo desenho" aria-haspopup="dialog" disabled={busy} onClick={newDrawing}>
          <Plus size={17} /><span>Novo<span className="studio-new-suffix"> desenho</span></span>
        </button>
        <button type="button" className="button primary studio-save" aria-label="Salvar desenho" aria-keyshortcuts="Control+S Meta+S" disabled={busy} onClick={() => save(drawing, true)}>
          <Save size={17} />Salvar
        </button>
        <button type="button" className="studio-gallery-button" aria-label="Meus desenhos" title="Meus desenhos" disabled={busy} onClick={gallery}><Images size={18} /><span>Desenhos</span></button>
        <IconButton label="Importar imagem" disabled={busy} onClick={() => input.current.click()}><ImagePlus size={19} /></IconButton>
        <input ref={input} type="file" hidden accept="image/*" onChange={importImage} />
        <IconButton label={focused ? 'Mostrar ferramentas' : 'Modo foco'} aria-pressed={focused}
          onClick={() => { setFocused(!focused); setPanel(null) }}>{focused ? <Minimize2 size={18} /> : <Expand size={18} />}</IconButton>
        <Menu label="Exportar desenho" trigger={(props) => <button {...props} type="button" title="Exportar desenho" disabled={busy} className="button secondary studio-export"><Download size={17} /><span>Exportar</span></button>}>
          <MenuOption onClick={() => exportImage('png')}>Baixar PNG</MenuOption>
          <MenuOption onClick={() => exportImage('transparent')}>Baixar PNG transparente</MenuOption>
          <MenuOption onClick={() => exportImage('jpeg')}>Baixar JPEG</MenuOption>
        </Menu>
      </div>
    </header>
    {!focused && <SketchToolbar tool={tool} setTool={chooseTool} history={history} undo={() => undoRedo('undo')} redo={() => undoRedo('redo')} panel={panel} togglePanel={toggle} />}
    {!focused && <SketchContext tool={tool} settings={settings} change={option} selection={selection} editable={editable} editRegion={editRegion}
      clearSelection={() => setSelection(null)} crop={crop} copy={copy} paste={paste} canPaste={canPaste} canCopy={Boolean(selection && active.visible)} />}
    <div className={'studio-layout' + (focused ? ' is-focused' : '')}>
      {!focused && <BrushPanel tool={tool} setTool={chooseTool} settings={settings} recent={recent} change={option} changeBrush={changeBrush} mobile={panel === 'brushes'} close={() => setPanel(null)} />}
      <SketchCanvas drawing={renderedDrawing} active={active} tool={tool} settings={settings} renderer={renderer} imageVersion={imageVersion}
        selection={selection} setSelection={setSelection} addOperation={addOperation} space={space} status={status}
        pickColor={(value) => { chooseTool(lastBrush.current); option('color', value) }}
        insertText={(point) => setDialog({ type: 'new-text', point })} showHelp={() => setDialog({ type: 'help' })} />
      {!focused && <LayerPanel drawing={drawing} active={active} select={select} renderer={renderer} imageVersion={imageVersion} mobile={panel === 'layers'}
        add={() => append(numberedLayer(drawing.layers))} update={update} layerAction={layerAction} preview={setAlpha}
        modify={(type, layer) => setDialog({ type: 'layer-' + type, layer: layer.id })} close={() => setPanel(null)} />}
      {!focused && panel && <button type="button" className="studio-scrim" aria-label="Fechar painel" onClick={() => setPanel(null)} />}
    </div>
    {dialog?.type === 'help' && <DrawingHelp close={close} />}
    {dialog?.type === 'rename' && <DrawingNameForm title="Renomear desenho" initial={drawing.name} close={close} submit={(name) => {
      if (!name) return
      commit((previous) => ({ ...previous, name }))
      close()
    }} />}
    {dialog?.type === 'layer-rename' && dialogLayer && <DrawingNameForm title="Renomear camada" initial={dialogLayer.name} close={close} submit={(name) => {
      if (!name) return
      update(dialogLayer.id, { name })
      close()
    }} />}
    {dialog?.type === 'new-text' && <DrawingTextForm operation={{ ...dialog.point, color: options.color }} close={close} change={(operation) => {
      append({ ...newLayer(operation.text.replace(/\s+/g, ' ').slice(0, 38)), strokes: [operation] })
      close()
    }} />}
    {dialog?.type === 'layer-text' && textOperation && <DrawingTextForm operation={textOperation} close={close} change={(operation) => {
      update(dialogLayer.id, { strokes: dialogLayer.strokes.map((entry) => entry === textOperation ? operation : entry) })
      close()
    }} />}
  </>
}
