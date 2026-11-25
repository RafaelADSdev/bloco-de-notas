import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog } from './ui'
import { readStudio, writeStudio } from './storage'
import { DrawingGallery, DrawingNameForm } from './SketchDialogs'
import { SketchEditor } from './SketchEditor'
import { migrateStudio, newDrawing } from './sketch-model'
import './sketch.css'

export default function SketchStudio({ leave }) {
  const current = useRef(null)
  const clipboard = useRef(null)
  const canStore = useRef(true)
  const [studio, setStudio] = useState(null)
  const [storage, setStorage] = useState('loading')
  const [dialog, setDialog] = useState(null)

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
      if (!stored?.drawings?.length) return save(migrateStudio())
      current.current = stored
      setStudio(stored)
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

  const saveDrawing = useCallback((drawing, manual = false) => {
    const prev = current.current
    const existing = prev.drawings.find((entry) => entry.id === drawing.id)
    if (!existing || (!manual && existing === drawing)) return
    save({ ...prev, drawings: prev.drawings.map((entry) => entry.id === drawing.id ? drawing : entry) }, manual)
  }, [save])

  function open(id) {
    if (id !== current.current.active) save({ ...current.current, active: id })
    setDialog(null)
  }

  function create(name, width, height) {
    const drawing = newDrawing(name || undefined, width, height)
    save({ drawings: [...current.current.drawings, drawing], active: drawing.id })
    setDialog(null)
  }

  function remove(target) {
    const prev = current.current
    const drawings = prev.drawings.filter((entry) => entry.id !== target.id)
    if (!drawings.length) return
    save({ drawings, active: prev.active === target.id ? drawings.at(-1).id : prev.active })
    setDialog({ type: 'gallery' })
  }

  if (!studio) return <main className="loading-view">Abrindo estúdio de desenho…</main>
  const drawing = studio.drawings.find((entry) => entry.id === studio.active) ?? studio.drawings[0]
  return <div className="studio-app">
    <SketchEditor key={drawing.id} initial={drawing} leave={leave} save={saveDrawing} storage={storage} clipboard={clipboard}
      newDrawing={() => setDialog({ type: 'new' })} gallery={() => setDialog({ type: 'gallery' })} externalDialog={Boolean(dialog)} />
    {dialog?.type === 'gallery' && <DrawingGallery drawings={studio.drawings} current={drawing.id} open={open}
      create={() => setDialog({ type: 'new', fromGallery: true })} remove={(target) => setDialog({ type: 'remove', target })} close={() => setDialog(null)} />}
    {dialog?.type === 'new' && <DrawingNameForm title="Novo desenho" create submit={create} close={() => setDialog(dialog.fromGallery ? { type: 'gallery' } : null)} />}
    {dialog?.type === 'remove' && <Dialog title="Excluir desenho?" close={() => setDialog({ type: 'gallery' })}>
      <p>Excluir “{dialog.target.name}” da galeria deste navegador?</p>
      <div className="dialog-actions">
        <button className="button secondary" data-autofocus onClick={() => setDialog({ type: 'gallery' })}>Cancelar</button>
        <button className="button destructive" onClick={() => remove(dialog.target)}>Excluir desenho</button>
      </div>
    </Dialog>}
  </div>
}
