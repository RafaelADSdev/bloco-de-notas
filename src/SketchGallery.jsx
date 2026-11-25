import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Check, Images, Plus, Trash2, Upload } from 'lucide-react'
import { Brand, IconButton } from './ui'
import { isAndroidApp } from './android-platform'
import { MobileNavigation } from './MobileNavigation'
import { drawingFrame } from './sketch-model'
import { drawingThumbnail } from './sketch-render'

// Limit concurrent full-size rendering even when many cards enter the viewport together.
let previews = Promise.resolve()

function DrawingPreview({ drawing, frame }) {
  const canvas = useRef(null)
  const [state, setState] = useState('loading')
  const scale = Math.min(1, 480 / Math.max(frame.width, frame.height))
  const width = Math.max(1, Math.round(frame.width * scale))
  const height = Math.max(1, Math.round(frame.height * scale))

  useEffect(() => {
    const target = canvas.current
    let active = true
    setState('loading')
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      previews = previews.then(async () => {
        if (!active) return
        const preview = await drawingThumbnail(drawing, width, height)
        if (active) {
          const context = target.getContext('2d')
          context.clearRect(0, 0, width, height)
          context.drawImage(preview, 0, 0)
          setState('ready')
        }
      }).catch(() => {
        if (active) setState('error')
      })
    }, { rootMargin: '160px' })
    observer.observe(target)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [drawing, width, height])

  return <span className="drawing-preview" data-preview={state} aria-hidden="true">
    <canvas ref={canvas} width={width} height={height} style={drawing.background ? { background: drawing.background } : undefined} />
    {state === 'error' && <span>Prévia indisponível</span>}
  </span>
}

export function SketchGallery({ drawings, active, open, create, importDrawing, importing, remove, leave, storage, navigate }) {
  return <div className="sketch-gallery">
    {!isAndroidApp && <header className="topbar">
      <button type="button" className="back-link" aria-label="Voltar à biblioteca" onClick={leave}><ArrowLeft size={18} />Biblioteca</button>
      <Brand />
    </header>}
    <main className="workspace">
      <div className="heading-row">
        <h1>Meus desenhos</h1>
        {isAndroidApp ? <IconButton label="Importar projeto" className="android-filter" onClick={importDrawing} disabled={importing}><Upload size={22} /></IconButton> : <div className="gallery-actions">
          <button type="button" className="button secondary" onClick={importDrawing} disabled={importing}>Importar projeto</button>
          <button type="button" className="button primary gallery-create" aria-label="Novo desenho" aria-haspopup="dialog" onClick={create}>
            <Plus size={18} /><span>Novo<span className="gallery-create-suffix"> desenho</span></span>
          </button>
        </div>}
      </div>
      {storage === 'error' && <p className="notice error" role="alert">Não foi possível carregar ou salvar os desenhos locais.</p>}
      {drawings.length ? <ul className="item-grid drawing-grid" aria-label="Desenhos salvos">
        {drawings.map((drawing) => {
          const frame = drawingFrame(drawing)
          const current = drawing.id === active
          return <li key={drawing.id} className="item-card drawing-card">
            <button type="button" className="item-open" aria-label={`Abrir ${drawing.name}`} onClick={() => open(drawing.id)}>
              <DrawingPreview drawing={drawing} frame={frame} />
              <span className="item-details">
                <strong title={drawing.name}>{drawing.name}</strong>
                <span className="item-meta">{frame.width} × {frame.height} px
                  {current && <span className="drawing-recent"><Check size={12} />Último aberto</span>}
                </span>
              </span>
            </button>
            <IconButton className="drawing-delete" label={`Excluir ${drawing.name}`} aria-haspopup="dialog"
              onClick={() => remove(drawing)} disabled={drawings.length === 1}><Trash2 size={17} /></IconButton>
          </li>
        })}
      </ul> : <div className="empty-state gallery-empty">
        <Images size={28} aria-hidden="true" />
        <strong>Nenhum desenho salvo</strong>
        <span>Use “Novo desenho” para começar.</span>
      </div>}
    </main>
    {isAndroidApp && <>
      <MobileNavigation active="drawings" go={navigate} />
      <button type="button" className="android-fab" aria-label="Novo desenho" aria-haspopup="dialog" onClick={create}><Plus size={24} /> Novo</button>
    </>}
  </div>
}
