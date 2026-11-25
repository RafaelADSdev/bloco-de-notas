import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { BookOpen, Check, FileText, Folder, Layout, SquarePen, X } from 'lucide-react'
import { colors, labels, papers } from './model'

export const itemIcons = { notebook: BookOpen, whiteboard: Layout, text: FileText, folder: Folder, pdf: FileText }

export function Brand() {
  return <span className="brand"><span className="brand-mark"><SquarePen size={19} strokeWidth={1.7} /></span><span>Linha Clara</span></span>
}

export function IconButton({ label, children, className = '', ...props }) {
  return <button type="button" className={'icon-button ' + className} title={label} aria-label={label} {...props}>{children}</button>
}

export function Menu({ label, trigger, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const button = useRef(null)
  const popover = useRef(null)
  useLayoutEffect(() => {
    if (!open) return
    const menu = popover.current
    menu.showPopover?.()

    function position() {
      const anchor = button.current.getBoundingClientRect()
      const gap = 7
      const gutter = 8
      const below = window.innerHeight - anchor.bottom - gap - gutter
      const above = anchor.top - gap - gutter
      const height = menu.scrollHeight + menu.offsetHeight - menu.clientHeight
      const flip = height > below && above > below
      menu.style.maxHeight = Math.max(44, flip ? above : below) + 'px'
      const left = align === 'left' ? anchor.left : anchor.right - menu.offsetWidth
      menu.style.left = Math.max(gutter, Math.min(left, document.documentElement.clientWidth - menu.offsetWidth - gutter)) + 'px'
      menu.style.top = Math.max(gutter, flip ? anchor.top - gap - menu.offsetHeight : anchor.bottom + gap) + 'px'
      menu.style.transformOrigin = (flip ? 'bottom ' : 'top ') + align
    }

    function followScroll(event) {
      if (event.target !== menu) position()
    }
    position()
    window.addEventListener('resize', position)
    window.addEventListener('scroll', followScroll, true)
    return () => {
      window.removeEventListener('resize', position)
      window.removeEventListener('scroll', followScroll, true)
    }
  }, [open, align])
  useEffect(() => {
    if (!open) return
    function outside(event) {
      if (!ref.current.contains(event.target)) setOpen(false)
    }
    function escape(event) {
      if (event.key === 'Escape') {
        setOpen(false)
        if (ref.current.contains(document.activeElement)) button.current.focus()
      }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [open])
  return <div className={'menu-anchor menu-' + align} ref={ref}>
    {trigger({ onClick: () => setOpen(!open), 'aria-expanded': open, 'aria-label': label, ref: button })}
    {open && <div ref={popover} className="popover" popover="manual" onClick={(event) => {
      if (event.target.closest('button')) {
        setOpen(false)
        button.current?.focus({ preventScroll: true })
      }
    }}>{children}</div>}
  </div>
}

export function MenuOption({ icon: Icon, children, danger = false, onClick, disabled }) {
  return <button type="button" className={danger ? 'danger' : ''} onClick={onClick} disabled={disabled}>
    {Icon && <Icon size={16} />}<span>{children}</span>
  </button>
}

export function Dialog({ title, close, children, busy = false }) {
  const ref = useRef(null)
  const titleId = 'dialog-title'
  useEffect(() => {
    const node = ref.current
    const previous = document.activeElement
    node.showModal()
    node.querySelector('[data-autofocus]')?.focus()
    return () => {
      node.close()
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [])
  return <dialog ref={ref} className="dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) close() }} onClick={(event) => {
    if (!busy && event.target === ref.current) {
      const bounds = ref.current.getBoundingClientRect()
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close()
    }
  }}>
    <header><h2 id={titleId}>{title}</h2><IconButton label="Fechar" onClick={close} disabled={busy}><X size={20} /></IconButton></header>
    {children}
  </dialog>
}

export function ColorChoice({ value, change }) {
  return <div className="color-options" role="group" aria-label="Cor da capa">
    {Object.entries(colors).map(([key, [fill, ink, label]]) => <button type="button" key={key} aria-pressed={value === key} aria-label={label}
      title={label} className="color-option" style={{ '--chip': fill, '--chip-ink': ink }} onClick={() => change(key)}>
      {value === key && <Check size={17} />}
    </button>)}
  </div>
}

export function CreateDialog({ type, close, create }) {
  const [title, setTitle] = useState('')
  const [color, setColor] = useState('sage')
  const [paper, setPaper] = useState('lined')
  const [size, setSize] = useState('a4')
  const [landscape, setLandscape] = useState(false)
  const [saving, setSaving] = useState(false)
  const heading = { folder: 'Nova pasta', notebook: 'Novo caderno', whiteboard: 'Novo quadro branco', text: 'Novo documento de texto' }[type]
  return <Dialog title={heading} close={close} busy={saving}>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (saving) return
      setSaving(true)
      create({ type, title: title.trim() || labels[type] + ' sem título', color, paper, size, landscape })
    }}>
      <label className="form-label">Nome
        <input data-autofocus value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={labels[type] + ' sem título'} />
      </label>
      <div className="form-label"><span>{type === 'folder' ? 'Cor da pasta' : 'Cor da capa'}</span><ColorChoice value={color} change={setColor} /></div>
      {type === 'notebook' && <>
        <div className="form-label"><span>Papel</span><div className="paper-options" role="group" aria-label="Modelo de papel">
          {Object.entries(papers).map(([key, label]) => <button key={key} type="button" aria-pressed={paper === key} onClick={() => setPaper(key)}>
            <span className={'mini-paper paper-' + key} />{label}
          </button>)}
        </div></div>
        <div className="form-columns">
          <label className="form-label">Tamanho<select value={size} onChange={(event) => setSize(event.target.value)}>
            <option value="a4">A4</option><option value="a5">A5</option><option value="letter">Carta</option>
          </select></label>
          <label className="form-label">Orientação<select value={landscape ? 'landscape' : 'portrait'} onChange={(event) => setLandscape(event.target.value === 'landscape')}>
            <option value="portrait">Retrato</option><option value="landscape">Paisagem</option>
          </select></label>
        </div>
      </>}
      <footer className="dialog-actions"><button type="button" className="button secondary" onClick={close} disabled={saving}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando…' : 'Criar'}</button></footer>
    </form>
  </Dialog>
}
