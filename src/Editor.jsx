import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine, ArrowLeft, Bookmark, ChevronLeft, ChevronRight, ChevronsUpDown, Copy, FilePlus2, Lock, Mic,
  MoreHorizontal, PanelLeft, Pencil, Plus, Printer, Star, Trash2, Unlock, X, ZoomIn, ZoomOut,
} from 'lucide-react'
import { downloadBackup, labels, newPage, papers, uid } from './model'
import { Dialog, IconButton, Menu, MenuOption } from './ui'
import DrawingSurface from './DrawingSurface'
import DrawingTools from './DrawingTools'
import RichEditor from './RichEditor'
import AudioPanel from './AudioPanel'

export default function Editor({ item, patch, leave, act, notify, storageError }) {
  const rich = item.type === 'text'
  const board = item.type === 'whiteboard'
  const [pageId, setPageId] = useState(item.pages[0]?.id)
  const [tool, setTool] = useState(board ? 'hand' : 'pen')
  const [color, setColor] = useState('#28372d')
  const [size, setSize] = useState(4)
  const [zoom, setZoom] = useState(board ? 60 : 100)
  const [pageSidebar, setPageSidebar] = useState(() => window.innerWidth >= 850 && !board)
  const [readOnly, setReadOnly] = useState(false)
  const [selection, setSelection] = useState([])
  const [stack, setStack] = useState({ past: [], future: [] })
  const [panel, setPanel] = useState(null)
  const [exporting, setExporting] = useState(false)
  const scroll = useRef(null)
  const page = item.pages.find((entry) => entry.id === pageId) ?? item.pages[0]
  const pageIndex = item.pages.indexOf(page)
  const effectiveSize = tool === 'marker' ? size * 4 : tool === 'eraser' ? size * 4 : tool === 'laser' ? Math.max(5, size) : size

  function choosePage(id) {
    setPageId(id)
    setSelection([])
    scroll.current?.scrollTo(0, 0)
  }

  function commit(pages) {
    setStack({ past: [...stack.past.slice(-39), item.pages], future: [] })
    patch({ pages })
  }

  function updatePage(id, updates) {
    commit(item.pages.map((entry) => entry.id === id ? { ...entry, ...updates } : entry))
  }

  function undo() {
    if (readOnly || !stack.past.length) return
    patch({ pages: stack.past.at(-1) })
    setStack({ past: stack.past.slice(0, -1), future: [item.pages, ...stack.future] })
    setSelection([])
  }

  function redo() {
    if (readOnly || !stack.future.length) return
    patch({ pages: stack.future[0] })
    setStack({ past: [...stack.past, item.pages], future: stack.future.slice(1) })
    setSelection([])
  }

  useEffect(() => {
    if (rich) return
    function key(event) {
      if (panel || document.querySelector('dialog[open]') || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) return
      if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
        event.preventDefault()
        if (event.shiftKey || event.key.toLowerCase() === 'y') redo()
        else undo()
        return
      }
      if (event.key === 'Escape') setSelection([])
      if (['Backspace', 'Delete'].includes(event.key) && selection.length && !readOnly) {
        event.preventDefault()
        eraseSelection()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  function addPage(position = pageIndex + 1) {
    if (readOnly || !page) return
    const added = newPage({ paper: page.pdfPage === undefined ? page.paper : 'plain', width: page.width, height: page.height })
    commit([...item.pages.slice(0, position), added, ...item.pages.slice(position)])
    choosePage(added.id)
  }

  function removePage(id) {
    const index = item.pages.findIndex((entry) => entry.id === id)
    const pages = item.pages.filter((entry) => entry.id !== id)
    if (!pages.length) return
    commit(pages)
    if (page.id === id) choosePage(pages[Math.min(index, pages.length - 1)].id)
    setPanel(null)
  }

  function duplicatePage(index) {
    const copy = { ...item.pages[index], id: uid(), bookmarked: false }
    commit([...item.pages.slice(0, index + 1), copy, ...item.pages.slice(index + 1)])
    choosePage(copy.id)
  }

  function eraseSelection() {
    updatePage(page.id, { items: page.items.filter((entry) => !selection.includes(entry.id)) })
    setSelection([])
  }

  async function downloadPdf() {
    setExporting(true)
    try {
      const { exportPdf } = await import('./export-pdf')
      await exportPdf(item)
      notify('PDF baixado.')
    } catch {
      notify('Não foi possível exportar este documento como PDF.', true)
    } finally { setExporting(false) }
  }

  function selectTool(key) {
    setTool(key)
    if (key !== 'lasso') setSelection([])
  }

  return <main className="editor">
    <header className="editor-header">
      <div className="editor-nav">
        <IconButton label="Voltar à biblioteca" onClick={leave}><ArrowLeft size={21} /></IconButton>
        {!rich && <IconButton label="Mostrar páginas" aria-pressed={pageSidebar} onClick={() => setPageSidebar(!pageSidebar)}><PanelLeft size={19} /></IconButton>}
        <div className="editor-heading">
          <button className="editor-title" title={item.title} onClick={() => act('rename')} disabled={readOnly}><span>{item.title}</span><ChevronsUpDown size={13} /></button>
          <small>{labels[item.type]}<span className="editor-save"> · {storageError ? 'Falha ao salvar' : 'Salvo neste navegador'}</span></small>
        </div>
      </div>
      <div className="editor-actions">
        <IconButton label={item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'} aria-pressed={item.favorite} onClick={() => act('favorite')}><Star size={19} /></IconButton>
        <IconButton label={readOnly ? 'Voltar a editar' : 'Modo de leitura'} aria-pressed={readOnly} onClick={() => { setReadOnly(!readOnly); setSelection([]) }}>
          {readOnly ? <Lock size={17} /> : <Unlock size={17} />}
        </IconButton>
        <IconButton label="Gravações de áudio" className="editor-audio-button" onClick={() => setPanel({ type: 'audio' })}><Mic size={19} /></IconButton>
        {!rich && <IconButton label="Adicionar página" className="editor-add-button" onClick={() => addPage()} disabled={readOnly}><FilePlus2 size={19} /></IconButton>}
        <Menu label="Mais opções do documento" trigger={(props) => <button type="button" {...props} className="icon-button" title="Mais opções"><MoreHorizontal size={21} /></button>}>
          <MenuOption icon={ArrowDownToLine} onClick={downloadPdf} disabled={exporting}>Baixar PDF</MenuOption>
          <MenuOption icon={Copy} onClick={() => { downloadBackup([item], item.title); notify('Cópia editável baixada.') }}>Baixar cópia editável</MenuOption>
          {rich && <MenuOption icon={Printer} onClick={() => window.print()}>Imprimir documento</MenuOption>}
          <MenuOption icon={Mic} onClick={() => setPanel({ type: 'audio' })}>Gravações de áudio</MenuOption>
          {!rich && <><hr />
            <MenuOption icon={FilePlus2} onClick={() => addPage()} disabled={readOnly}>Adicionar página</MenuOption>
            <MenuOption icon={Bookmark} onClick={() => updatePage(page.id, { bookmarked: !page.bookmarked })} disabled={readOnly}>{page.bookmarked ? 'Remover marcador da página' : 'Marcar página'}</MenuOption>
            <MenuOption icon={Pencil} onClick={() => setPanel({ type: 'paper' })} disabled={readOnly}>Mudar papel da página</MenuOption>
          </>}
        </Menu>
        <button className="button primary export-button" onClick={downloadPdf} disabled={exporting}><ArrowDownToLine size={17} /><span>{exporting ? 'Exportando…' : 'Exportar PDF'}</span></button>
      </div>
    </header>
    {storageError && <div className="notice error" role="alert">{storageError}</div>}
    {rich ? <RichEditor item={item} patch={patch} readOnly={readOnly} notify={notify} /> : <>
      <DrawingTools tool={readOnly ? 'hand' : tool} change={selectTool} color={color} setColor={setColor} size={size} setSize={setSize}
        undo={undo} redo={redo} canUndo={!!stack.past.length} canRedo={!!stack.future.length} readOnly={readOnly} />
      <div className="drawing-workspace">
        {pageSidebar && <aside className="page-sidebar" aria-label="Páginas">
          <div className="page-sidebar-head"><h2>Páginas</h2><IconButton label="Fechar páginas" onClick={() => setPageSidebar(false)}><X size={17} /></IconButton></div>
          {item.pages.map((entry, index) => <div className={'page-outline' + (page.id === entry.id ? ' page-active' : '')} key={entry.id}>
            <button className="page-thumbnail-button" onClick={() => { choosePage(entry.id); if (window.innerWidth <= 700) setPageSidebar(false) }}
              aria-label={'Ir para página ' + (index + 1)} aria-current={page.id === entry.id ? 'page' : undefined}>
              <span className={'page-thumbnail paper-' + entry.paper} aria-hidden="true">{entry.pdfPage !== undefined ? 'PDF' : entry.items.length > 0 && <Pencil size={14} />}</span>
              <span>{index + 1}{entry.bookmarked && <Bookmark size={13} fill="currentColor" aria-label="Marcador" />}</span>
            </button>
            {!readOnly && <Menu label={'Opções da página ' + (index + 1)} align="left"
              trigger={(props) => <button type="button" {...props} className="icon-button page-menu"><MoreHorizontal size={16} /></button>}>
              <MenuOption icon={Plus} onClick={() => addPage(index)}>Inserir página antes</MenuOption>
              <MenuOption icon={Plus} onClick={() => addPage(index + 1)}>Inserir página depois</MenuOption>
              <MenuOption icon={Copy} onClick={() => duplicatePage(index)}>Duplicar página</MenuOption>
              <MenuOption icon={Bookmark} onClick={() => updatePage(entry.id, { bookmarked: !entry.bookmarked })}>{entry.bookmarked ? 'Remover marcador' : 'Marcar página'}</MenuOption>
              <MenuOption icon={Trash2} danger disabled={item.pages.length < 2} onClick={() => setPanel({ type: 'remove', id: entry.id, index })}>Excluir página</MenuOption>
            </Menu>}
          </div>)}
          {!readOnly && <button className="button secondary add-page" onClick={() => addPage(item.pages.length)}><Plus size={16} />Nova página</button>}
        </aside>}
        <div className="drawing-scroll" ref={scroll}>
          {selection.length > 0 && !readOnly && <div className="selection-bar" role="status">
            {selection.length} {selection.length === 1 ? 'item selecionado' : 'itens selecionados'}
            <IconButton label="Duplicar seleção" onClick={() => {
              const copied = page.items.filter((entry) => selection.includes(entry.id)).map((entry) => ({
                ...entry, id: uid(), x: entry.x === undefined ? undefined : entry.x + 24, y: entry.y === undefined ? undefined : entry.y + 24,
                points: entry.points?.map(({ x, y }) => ({ x: x + 24, y: y + 24 })),
              }))
              updatePage(page.id, { items: [...page.items, ...copied] })
              setSelection(copied.map((entry) => entry.id))
            }}><Copy size={15} /></IconButton>
            <IconButton label="Apagar seleção" onClick={eraseSelection}><Trash2 size={15} /></IconButton>
          </div>}
          <DrawingSurface key={page.id} page={page} item={item} tool={tool} color={color} size={effectiveSize} zoom={zoom} readOnly={readOnly}
            selection={selection} select={setSelection} update={(items) => updatePage(page.id, { items })} scrollRef={scroll}
            addText={(entry) => setPanel({ ...entry, type: 'annotation', objectType: entry.type, pageId: page.id })} notify={notify} />
        </div>
      </div>
      <footer className="editor-footer">
        <div className="page-controls">
          <IconButton label="Página anterior" disabled={pageIndex === 0} onClick={() => choosePage(item.pages[pageIndex - 1].id)}><ChevronLeft size={17} /></IconButton>
          <button className="page-count" onClick={() => setPanel({ type: 'goto' })} title="Ir para página">{pageIndex + 1} / {item.pages.length}</button>
          <IconButton label="Próxima página" disabled={pageIndex + 1 === item.pages.length} onClick={() => choosePage(item.pages[pageIndex + 1].id)}><ChevronRight size={17} /></IconButton>
          {!readOnly && <IconButton label="Nova página" onClick={() => addPage()}><Plus size={17} /></IconButton>}
        </div>
        <div className="zoom-controls">
          <IconButton label="Diminuir zoom" disabled={zoom <= 25} onClick={() => setZoom(Math.max(25, zoom - 15))}><ZoomOut size={18} /></IconButton>
          <button className="page-count" title="Redefinir zoom" onClick={() => setZoom(board ? 60 : 100)}>{zoom}%</button>
          <IconButton label="Aumentar zoom" disabled={zoom >= 240} onClick={() => setZoom(Math.min(240, zoom + 15))}><ZoomIn size={18} /></IconButton>
        </div>
      </footer>
    </>}
    {panel?.type === 'audio' && <AudioPanel item={item} patch={patch} close={() => setPanel(null)} readOnly={readOnly} notify={notify} />}
    {panel?.type === 'annotation' && <Dialog title={panel.objectType === 'sticky' ? 'Nota adesiva' : 'Texto na página'} close={() => setPanel(null)}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const value = new FormData(event.currentTarget).get('content').trim()
        if (!value) return
        const { x, y, id, pageId: target, objectType } = panel
        const current = item.pages.find((entry) => entry.id === target)
        const next = { id: id ?? uid(), type: objectType, x, y, value, size: panel.size ?? (board ? 38 : 24),
          color: panel.color ?? (objectType === 'sticky' ? '#f7dfa4' : color) }
        if (current) {
          const items = id ? current.items.map((entry) => entry.id === id ? next : entry) : [...current.items, next]
          updatePage(target, { items })
        }
        setPanel(null)
      }}>
        <label className="form-label">Conteúdo<textarea name="content" rows={4} defaultValue={panel.value} data-autofocus required maxLength={2400} /></label>
        <footer className="dialog-actions"><button type="button" className="button secondary" onClick={() => setPanel(null)}>Cancelar</button><button className="button primary">Salvar</button></footer>
      </form>
    </Dialog>}
    {panel?.type === 'paper' && <Dialog title="Modelo de papel" close={() => setPanel(null)}>
      <div className="paper-options">{Object.entries(papers).map(([key, label]) => <button type="button" key={key} aria-pressed={page.paper === key} onClick={() => { updatePage(page.id, { paper: key }); setPanel(null) }}>
        <span className={'mini-paper paper-' + key} />{label}
      </button>)}</div>
    </Dialog>}
    {panel?.type === 'remove' && <Dialog title={'Excluir página ' + (panel.index + 1) + '?'} close={() => setPanel(null)}>
      <p className="dialog-copy">As anotações desta página serão removidas. Você pode desfazer a exclusão na barra de ferramentas.</p>
      <footer className="dialog-actions"><button className="button secondary" data-autofocus onClick={() => setPanel(null)}>Cancelar</button>
        <button className="button destructive" onClick={() => removePage(panel.id)}>Excluir</button></footer>
    </Dialog>}
    {panel?.type === 'goto' && <Dialog title="Ir para página" close={() => setPanel(null)}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const index = Number(new FormData(event.currentTarget).get('page')) - 1
        if (item.pages[index]) choosePage(item.pages[index].id)
        setPanel(null)
      }}>
        <label className="form-label">Página<input name="page" type="number" min={1} max={item.pages.length} defaultValue={pageIndex + 1} data-autofocus required /></label>
        <footer className="dialog-actions"><button className="button primary">Ir</button></footer>
      </form>
    </Dialog>}
  </main>
}
