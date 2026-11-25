import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from './ui'
import { readStudio, writeStudio } from './storage'
import { DrawingNameForm } from './SketchDialogs'
import { SketchEditor } from './SketchEditor'
import { SketchGallery } from './SketchGallery'
import { migrateStudio, newDrawing } from './sketch-model'
import './sketch.css'

export default function SketchStudio({ view, leave, showGallery, showEditor }) {
  const current = useRef(null)
  const clipboard = useRef(null)
  const canStore = useRef(true)
  const [studio, setStudio] = useState(null)
  const [storage, setStorage] = useState('loading')
  const [dialog, setDialog] = useState(null)
  const inGallery = view === 'drawings'
  const [editorOpened, setEditorOpened] = useState(!inGallery)

  const save = useCallback((next, manual = false) => {
    current.current = next
    setStudio(next)
    if (!canStore.current) return
    setStorage('saving')
    writeStudio(next).then(() => {
      if (current.current === next) setStorage(manual ? 'confirmed' : 'saved')
    }).catch(() => {
      if (current.current === next) setStorage('error')
    })
  }, [])

  useEffect(() => {
    let open = true
    readStudio().then((stored) => {
      if (!open) return
      const hasDrawings = Array.isArray(stored?.drawings)
      const next = hasDrawings ? stored : migrateStudio()
      if (!hasDrawings && next.drawings.length) return save(next)
      current.current = next
      setStudio(next)
      setStorage('saved')
    }).catch(() => {
      if (!open) return
      canStore.current = false
      current.current = migrateStudio()
      setStudio(current.current)
      setStorage('error')
    })
    return () => { open = false }
  }, [save])

  useEffect(() => {
    setDialog(null)
    if (!inGallery) setEditorOpened(true)
  }, [inGallery])

  useEffect(() => {
    if (inGallery || !studio || studio.drawings.length) return
    const drawing = newDrawing()
    save({ drawings: [drawing], active: drawing.id })
  }, [inGallery, studio, save])

  const saveDrawing = useCallback((drawing, manual = false) => {
    const prev = current.current
    const existing = prev.drawings.find((entry) => entry.id === drawing.id)
    if (!existing || (!manual && existing === drawing)) return
    save({ ...prev, drawings: prev.drawings.map((entry) => entry.id === drawing.id ? drawing : entry) }, manual)
  }, [save])

  function open(id) {
    if (id !== current.current.active) save({ ...current.current, active: id })
    showEditor()
  }

  function create(name, width, height) {
    const drawing = newDrawing(name || undefined, width, height)
    save({ drawings: [...current.current.drawings, drawing], active: drawing.id })
    setDialog(null)
    if (inGallery) showEditor()
  }

  function remove(target) {
    const prev = current.current
    const drawings = prev.drawings.filter((entry) => entry.id !== target.id)
    if (!drawings.length) return
    save({ drawings, active: prev.active === target.id ? drawings.at(-1).id : prev.active })
    setDialog(null)
  }

  const drawing = studio?.drawings.find((entry) => entry.id === studio.active) ?? studio?.drawings[0]
  if (!studio || (!inGallery && !drawing)) return <main className="loading-view">Abrindo desenhos…</main>
  function startDrawing() { setDialog({ type: 'new' }) }
  function closeDialog() { setDialog(null) }

  return <>
    {inGallery && <SketchGallery drawings={studio.drawings} active={studio.active} open={open} create={startDrawing}
      remove={(target) => setDialog({ type: 'remove', target })} leave={leave} storage={storage} />}
    {drawing && (editorOpened || !inGallery) && <div className="studio-app" hidden={inGallery}>
      <SketchEditor key={drawing.id} initial={drawing} leave={leave} save={saveDrawing} storage={storage} clipboard={clipboard}
        newDrawing={startDrawing} gallery={showGallery} externalDialog={inGallery || Boolean(dialog)} />
    </div>}
    {dialog?.type === 'new' && <DrawingNameForm title="Novo desenho" create submit={create} close={closeDialog} />}
    {dialog?.type === 'remove' && <Dialog title="Excluir desenho?" close={closeDialog}>
      <p>Excluir “{dialog.target.name}” da galeria deste navegador?</p>
      <div className="dialog-actions">
        <button className="button secondary" data-autofocus onClick={closeDialog}>Cancelar</button>
        <button className="button destructive" onClick={() => remove(dialog.target)}>Excluir desenho</button>
      </div>
    </Dialog>}
  </>
}
