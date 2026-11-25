import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowLeft, Download, Expand, FileUp, ImagePlus, Minimize2, MoreHorizontal, Pencil, Plus, Save, Square, Video } from 'lucide-react'
import { Dialog, IconButton, Menu, MenuOption } from './ui'
import { SketchCanvas } from './SketchCanvas'
import { DrawingHelp, DrawingNameForm, DrawingTextForm, LayerColorForm } from './SketchDialogs'
import { BrushPanel, LayerPanel, SketchContext, tools } from './SketchPanels'
import { SketchBrushRail, SketchColorPicker, SketchToolDock, SketchToolGrid } from './SketchMobile'
import { bounds, brushes, canMergeDown, clamp, drawingFrame, editHistory, newLayer, numberedLayer, paper, shapes, transformPoints, updateLayer } from './sketch-model'
import { bitmap, captureRegion, encode, imageLayer } from './sketch-raster'
import { studioRenderer } from './sketch-render'
import { fileName, saveFile } from './model'
import { useSketchRecording } from './useSketchRecording'
import { isAndroidApp } from './android-platform'

const localApp = isAndroidApp || window.location.protocol === 'linhaclara:'
const storageLabels = {
  saved: localApp ? 'Salvo no dispositivo' : 'Salvo neste navegador',
  confirmed: localApp ? 'Desenho salvo no dispositivo' : 'Desenho salvo neste navegador',
  saving: 'Salvando…',
  error: 'Não foi possível salvar as alterações',
}
const panelTitles = { brushes: 'Pincéis', color: 'Cor do traço', layers: 'Camadas', tools: 'Ferramentas e guias' }

export function SketchEditor({ initial, leave, save, storage, newDrawing, gallery, clipboard, externalDialog, importDrawing }) {
  const [history, edit] = useReducer(editHistory, { drawing: initial, past: [], future: [] })
  const { drawing } = history
  const [tool, setTool] = useState('pencil')
  const lastBrush = useRef('pencil')
  const [brushOptions, setBrushOptions] = useState({})
  const [options, setOptions] = useState({
    color: '#243129', smoothing: 28, pressure: true, penOnly: false,
    symmetry: 'none', guide: 'none', filled: false, tolerance: 15,
    endColor: '#ffffff', stabilizer: 0, prediction: 0,
    guideX: 50, guideY: 50, guideAngle: 0, ellipseWidth: 65, ellipseHeight: 40,
    guideSnap: true, guideOpacity: 65, guideDensity: 11,
    symmetryX: 50, symmetryY: 50, symmetryAngle: 0, symmetryCount: 6,
  })
  const [recent, setRecent] = useState([])
  const [selection, setSelection] = useState(null)
  const [alpha, setAlpha] = useState(null)
  const [layerColor, setLayerColor] = useState(null)
  const [space, setSpace] = useState(false)
  const [panel, setPanel] = useState(null)
  const [focused, setFocused] = useState(false)
  const [dialog, setDialog] = useState(null)
  const [message, setMessage] = useState(null)
  const [positionTarget, setPositionTarget] = useState(null)
  const [busy, setBusy] = useState(false)
  const recording = useSketchRecording()
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

  function chooseTool(key, keepPanel = false) {
    if (brushes[key] && key !== 'erase') lastBrush.current = key
    setTool(key)
    if (!keepPanel) setPanel(null)
    setMessage(null)
    setPositionTarget(null)
  }

  function option(key, value) {
    setOptions((previous) => ({ ...previous, [key]: value }))
    if (key === 'color') setRecent((previous) => [value, ...previous.filter((color) => color !== value)].slice(0, 5))
  }

  function changeBrush(key, value) {
    setBrushOptions((previous) => ({ ...previous, [brushKey]: { ...previous[brushKey], [key]: value } }))
  }

  function useBrushPreset({ tool: key, options: preset }) {
    chooseTool(key, true)
    const { smoothing, stabilizer, prediction, pressure, ...brush } = preset
    setBrushOptions((previous) => ({ ...previous, [key]: brush }))
    setOptions((previous) => ({
      ...previous, smoothing: smoothing ?? previous.smoothing, stabilizer: stabilizer ?? previous.stabilizer,
      prediction: prediction ?? previous.prediction, pressure: pressure ?? previous.pressure,
    }))
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
    if (action === 'merge' || action === 'merge-visible') {
      setPanel(null)
      setDialog({ type: action, layer: layerId })
      return
    }
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

  async function mergeLayers(kind, layerId) {
    const mergeVisible = kind === 'merge-visible'
    const index = drawing.layers.findIndex((layer) => layer.id === layerId)
    const group = mergeVisible ? drawing.layers.filter((layer) => layer.visible) : drawing.layers.slice(index - 1, index + 1)
    if (group.length < 2 || (mergeVisible ? group.some((layer) => layer.locked) : !canMergeDown(drawing.layers, index))) return
    const ids = new Set(group.map((layer) => layer.id))
    const oldDrawing = drawing
    const surface = bitmap(drawing.width, drawing.height)
    setBusy(true)
    setDialog(null)
    try {
      await renderer.ready(group)
      renderer.paint(surface.getContext('2d'), { ...drawing, layers: mergeVisible ? drawing.layers : group, background: mergeVisible ? drawing.background : null })
      const blob = await encode(surface)
      if (!mounted.current) return
      const merged = newLayer(mergeVisible ? 'Camadas visíveis mescladas' : group.map((layer) => layer.name).join(' + '))
      merged.strokes = [{ kind: 'image', x: 0, y: 0, w: drawing.width, h: drawing.height, blob }]
      commit((previous) => {
        if (previous !== oldDrawing) return previous
        const layers = mergeVisible
          ? [merged, ...previous.layers.filter((layer) => !ids.has(layer.id))]
          : [...previous.layers.slice(0, index - 1), merged, ...previous.layers.slice(index + 1)]
        return { ...previous, layers, active: merged.id, background: mergeVisible ? null : previous.background }
      })
      setSelection(null)
      setAlpha(null)
    } catch {
      if (mounted.current) setMessage('Não foi possível mesclar as camadas.')
    } finally {
      surface.width = 0
      if (mounted.current) setBusy(false)
    }
  }

  function editRegion(transform) {
    if (!selection || !editable) return
    addOperation(active.id, { kind: 'region', points: selection, transform })
    setSelection(transform ? transformPoints(selection, transform) : null)
  }

  function paintSelection(kind) {
    if (!selection || !editable) return
    addOperation(active.id, { kind, points: selection, color: settings.color, size: settings.size,
      opacity: settings.opacity / 100, lockAlpha: !!active.alphaLock })
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
      if (dialog || externalDialog || panel) return
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        setPanel(null)
        setSelection(null)
        setPositionTarget(null)
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
  useEffect(() => { if (externalDialog) setPanel(null) }, [externalDialog])

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
    let surface, output
    try {
      if (format === 'project') {
        const { encodeDrawingProject } = await import('./sketch-files')
        await saveFile(await encodeDrawingProject(drawing), 'application/json', fileName(drawing.name) + '.linha-desenho.json')
        return
      }
      await renderer.ready(drawing.layers)
      const png = format !== 'jpeg'
      surface = bitmap(drawing.width, drawing.height)
      const ctx = surface.getContext('2d')
      renderer.paint(ctx, { ...drawing, background: format === 'transparent' ? null : drawing.background ?? (png ? null : '#ffffff') })
      output = surface
      if (drawing.frame) {
        output = bitmap(frame.width, frame.height)
        output.getContext('2d').drawImage(surface, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height)
      }
      if (format === 'pdf') {
        const { createDrawingPdf } = await import('./sketch-files')
        await saveFile(await createDrawingPdf(output, drawing.name), 'application/pdf', fileName(drawing.name) + '.pdf')
        return
      }
      if (format === 'psd') {
        const { encodeDrawingPsd } = await import('./sketch-psd')
        await saveFile(await encodeDrawingPsd(drawing, renderer, output), 'image/vnd.adobe.photoshop', fileName(drawing.name) + '.psd')
        return
      }
      const blob = await encode(output, png ? 'image/png' : 'image/jpeg', .94)
      await saveFile(blob, blob.type, fileName(drawing.name) + (png ? '.png' : '.jpg'))
    } catch {
      if (mounted.current) setMessage('Não foi possível exportar o desenho.')
    } finally {
      if (output && output !== surface) output.width = 0
      if (surface) surface.width = 0
      if (mounted.current) setBusy(false)
    }
  }

  async function recordTimelapse() {
    if (!recording.recording) {
      setMessage(recording.start() ? 'Timelapse iniciado' : 'O gravador de vídeo está indisponível.')
      return
    }
    setBusy(true)
    setMessage('Preparando o timelapse…')
    try {
      const video = await recording.stop()
      if (!video) {
        setMessage('Faça uma alteração no desenho durante a gravação para gerar o vídeo.')
        return
      }
      const extension = video.type.includes('mp4') ? 'mp4' : 'webm'
      const saved = await saveFile(video, 'video/' + extension, fileName(drawing.name) + '-timelapse.' + extension)
      setMessage(saved ? 'Timelapse salvo.' : null)
    } catch {
      setMessage('Não foi possível salvar o timelapse.')
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  const renderedDrawing = useMemo(() => {
    const withOpacity = alpha == null ? drawing : updateLayer(drawing, active.id, (layer) => ({ ...layer, opacity: alpha }))
    return layerColor ? updateLayer(withOpacity, layerColor.id, (layer) => ({ ...layer, adjustments: layerColor.values })) : withOpacity
  }, [drawing, active.id, alpha, layerColor])
  const placement = positionTarget === 'guide' ? 'Toque na folha para mover a guia'
    : positionTarget === 'symmetry' ? 'Toque na folha para mover o centro da simetria' : null
  const status = placement ?? message ?? (!active.visible ? 'Camada oculta' : active.locked ? 'Camada bloqueada'
    : tool === 'erase' && active.alphaLock ? 'A transparência está bloqueada nesta camada' : '')
  const canLeave = !busy && !recording.recording
  const close = () => { setDialog(null); setLayerColor(null) }
  const closePanel = () => setPanel(null)
  function placeGuide(point) {
    const x = Math.round((point.x - frame.x) / frame.width * 100)
    const y = Math.round((point.y - frame.y) / frame.height * 100)
    setOptions((previous) => ({ ...previous, [positionTarget + 'X']: x, [positionTarget + 'Y']: y }))
    setPositionTarget(null)
  }
  const addLayer = () => append(numberedLayer(drawing.layers))
  const togglePaper = () => commit((previous) => ({ ...previous, background: previous.background ? null : paper }))
  const saveNow = () => save(drawing, true)
  const toggleFocus = () => { setFocused(!focused); closePanel() }
  const rename = () => setDialog({ type: 'rename' })
  const brushPanel = <BrushPanel tool={tool} setTool={(key) => chooseTool(key, true)} settings={settings}
    change={option} changeBrush={changeBrush} usePreset={useBrushPreset} />
  const layerPanel = <LayerPanel drawing={drawing} active={active} select={select} renderer={renderer} imageVersion={imageVersion}
    update={update} layerAction={layerAction} preview={setAlpha}
    modify={(type, layer) => { closePanel(); setDialog({ type: 'layer-' + type, layer: layer.id }) }} />
  const context = <SketchContext tool={tool} settings={settings} change={option} selection={selection} editable={editable} editRegion={editRegion}
    paintSelection={paintSelection} clearSelection={() => setSelection(null)} crop={crop} copy={copy} paste={paste} canPaste={canPaste}
    position={(target) => { setPositionTarget(target); closePanel() }} canCopy={Boolean(selection && active.visible)} />
  const documentOptions = <>
    <MenuOption icon={Pencil} onClick={rename}>Renomear desenho</MenuOption>
    <MenuOption icon={Square} onClick={togglePaper}>{drawing.background ? 'Usar fundo transparente' : 'Usar fundo de papel'}</MenuOption>
    <MenuOption icon={FileUp} disabled={!importDrawing || !canLeave} onClick={importDrawing}>Abrir projeto editável</MenuOption>
    <MenuOption icon={Video} disabled={busy || !recording.supported} onClick={recordTimelapse}>
      {recording.recording ? 'Finalizar timelapse' : 'Iniciar timelapse'}
    </MenuOption>
  </>
  const exportOptions = <>
    <MenuOption onClick={() => exportImage('png')}>Baixar PNG</MenuOption>
    <MenuOption onClick={() => exportImage('transparent')}>Baixar PNG transparente</MenuOption>
    <MenuOption onClick={() => exportImage('jpeg')}>Baixar JPEG</MenuOption>
    <MenuOption onClick={() => exportImage('pdf')}>Baixar PDF</MenuOption>
    <MenuOption onClick={() => exportImage('psd')}>Baixar PSD em camadas</MenuOption>
    <MenuOption onClick={() => exportImage('project')}>Baixar projeto editável</MenuOption>
  </>
  const focusButton = <IconButton label={focused ? 'Mostrar ferramentas' : 'Modo foco'} aria-pressed={focused}
    onClick={toggleFocus}>{focused ? <Minimize2 size={19} /> : <Expand size={19} />}</IconButton>
  const dialogLayer = dialog?.layer && drawing.layers.find((layer) => layer.id === dialog.layer)
  const textOperation = dialogLayer?.strokes.find((operation) => operation.kind === 'text')

  return <>
    <input ref={input} type="file" hidden accept="image/*" onChange={importImage} />
    <header className="studio-touch-header">
      <IconButton label="Meus desenhos" onClick={gallery} disabled={!canLeave}><ArrowLeft size={21} /></IconButton>
      <div className="studio-touch-document">
        <h1 title={drawing.name}>{drawing.name}</h1>
        <div className="studio-document-meta">
          <span className="studio-storage" role="status" data-status={recording.recording ? 'recording' : storage}>
            {recording.recording ? 'Gravando timelapse' : storageLabels[storage]}
          </span>
          <span className="studio-document-size">{frame.width} × {frame.height} px</span>
        </div>
      </div>
      <div className="studio-wide-actions">
        <button type="button" className="button secondary" aria-label="Novo desenho" aria-haspopup="dialog" disabled={!canLeave} onClick={newDrawing}>
          <Plus size={17} /> Novo desenho
        </button>
        <Menu label="Exportar desenho" trigger={(props) => <button {...props} type="button" className="button secondary" disabled={busy}>
          <Download size={17} /> Exportar
        </button>}>{exportOptions}</Menu>
      </div>
      <IconButton className="studio-touch-save" label="Salvar desenho" aria-keyshortcuts="Control+S Meta+S" disabled={busy} onClick={saveNow}><Save size={19} /></IconButton>
      {focusButton}
      <Menu label="Opções do desenho" trigger={(props) => <IconButton {...props} label="Opções do desenho" disabled={busy}><MoreHorizontal size={22} /></IconButton>}>
        <div className="studio-overflow-actions"><MenuOption icon={Plus} disabled={!canLeave} onClick={newDrawing}>Novo desenho</MenuOption></div>
        {documentOptions}
        <MenuOption icon={ImagePlus} onClick={() => input.current.click()}>Importar imagem</MenuOption>
        <div className="studio-overflow-actions"><hr />{exportOptions}</div>
        <hr />
        <MenuOption icon={ArrowLeft} disabled={!canLeave} onClick={leave}>Voltar à biblioteca</MenuOption>
      </Menu>
    </header>
    <div className={'studio-layout' + (focused ? ' is-focused' : '')}>
      {!focused && <SketchToolDock tool={tool} color={options.color} history={history}
        undo={() => undoRedo('undo')} redo={() => undoRedo('redo')} open={setPanel}
        guided={Boolean(selection || settings.guide !== 'none' || settings.symmetry !== 'none')} />}
      {!focused && <SketchBrushRail tool={tool} choose={chooseTool} open={() => setPanel('brushes')} />}
      <SketchCanvas drawing={renderedDrawing} active={active} tool={tool} settings={settings} renderer={renderer} imageVersion={imageVersion}
        selection={selection} setSelection={setSelection} addOperation={addOperation} space={space} status={status}
        recordFrame={recording.recordFrame}
        positionTarget={positionTarget} positionGuide={placeGuide}
        pickColor={(value) => { chooseTool(lastBrush.current); option('color', value) }}
        insertText={(point) => setDialog({ type: 'new-text', point })} showHelp={() => setDialog({ type: 'help' })} />
    </div>
    {panel && !externalDialog && <Dialog title={panelTitles[panel]} className={'studio-touch-panel studio-touch-panel--' + panel} close={closePanel}
      headerAction={panel === 'layers' && <IconButton label="Nova camada" onClick={addLayer}><Plus size={21} /></IconButton>}>
      {panel === 'brushes' && brushPanel}
      {panel === 'layers' && layerPanel}
      {panel === 'tools' && <>{context}<SketchToolGrid tool={tool} choose={(key) => chooseTool(key, true)} /></>}
      {panel === 'color' && <SketchColorPicker color={options.color} recent={recent} sample={() => chooseTool('sample')}
        apply={(value) => { option('color', value); closePanel() }} />}
    </Dialog>}
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
    {dialog?.type === 'layer-color' && dialogLayer && <LayerColorForm initial={dialogLayer.adjustments} close={close}
      preview={(values) => setLayerColor({ id: dialogLayer.id, values })}
      apply={(adjustments) => { update(dialogLayer.id, { adjustments }); close() }} />}
    {(dialog?.type === 'merge' || dialog?.type === 'merge-visible') && <Dialog
      title={dialog.type === 'merge' ? 'Mesclar com a camada abaixo?' : 'Mesclar camadas visíveis?'} close={close}>
      <p>{dialog.type === 'merge' ? 'As duas camadas serão combinadas em uma imagem.' : 'As camadas visíveis e o papel serão combinados em uma imagem. Camadas ocultas continuam separadas.'}</p>
      <div className="dialog-actions">
        <button type="button" className="button secondary" onClick={close}>Cancelar</button>
        <button type="button" className="button primary" onClick={() => mergeLayers(dialog.type, dialog.layer)}>Mesclar</button>
      </div>
    </Dialog>}
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
