import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, CloudOff, X } from 'lucide-react'
import { Library } from './Library'
import { CreateDialog, Dialog, IconButton } from './ui'
import { Welcome } from './Welcome'
import { descendants, downloadBackup, isTrashed, newItem, readBackup, starterItems, uid } from './model'
import { readLibrary, writeLibrary } from './storage'

const Editor = lazy(() => import('./Editor'))
const SketchStudio = lazy(() => import('./SketchStudio'))
const importAccept = '.pdf,.txt,.json,application/pdf,text/plain,application/json'

function currentRoute() {
  const path = location.pathname.replace(/\/+$/, '')
  const params = new URLSearchParams(location.search)
  const section = params.get('view')
  return {
    page: !path || path === '/login' ? 'welcome' : path === '/editor' ? 'editor' : 'library',
    doc: params.get('id'), folder: params.get('folder'),
    section: ['favorites', 'trash', 'studio'].includes(section) ? section : 'home',
  }
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const [motion, setMotion] = useState(() => document.documentElement.dataset.motion ?? 'system')
  const [items, setItems] = useState([])
  const latest = useRef([])
  const [ready, setReady] = useState(false)
  const [storageError, setStorageError] = useState('')
  const [dialog, setDialog] = useState(null)
  const [message, setMessage] = useState(null)
  const [busyImport, setBusyImport] = useState(false)
  const toastTimer = useRef(null)
  const importInput = useRef(null)
  const importFolder = useRef(null)

  useEffect(() => {
    let cancelled = false
    readLibrary().then((saved) => {
      if (cancelled) return
      latest.current = saved ?? starterItems()
      setItems(latest.current)
      if (saved === undefined) persist(latest.current)
    }).catch(() => {
      if (!cancelled) setStorageError('O navegador bloqueou o armazenamento. Baixe uma cópia antes de fechar a página.')
    }).finally(() => { if (!cancelled) setReady(true) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    function pop() { setDialog(null); setRoute(currentRoute()) }
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
      clearTimeout(toastTimer.current)
    }
  }, [])

  function persist(next) {
    return writeLibrary(next).then(
      () => setStorageError(''),
      () => setStorageError('Não foi possível salvar no navegador. Baixe uma cópia para guardar as mudanças.'),
    )
  }

  function change(update) {
    const next = update(latest.current)
    latest.current = next
    setItems(next)
    return persist(next)
  }

  function notify(text, error = false) {
    clearTimeout(toastTimer.current)
    setMessage({ text, error })
    toastTimer.current = setTimeout(() => setMessage(null), 4200)
  }

  function changeTheme(next) {
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]').content = next === 'light' ? '#f6f0e6' : '#181715'
    setTheme(next)
    try {
      localStorage.setItem('linha-clara:theme', next)
    } catch {
      // The selected theme still applies when browser settings block storage.
    }
  }

  function changeMotion(next) {
    if (next === 'system') delete document.documentElement.dataset.motion
    else document.documentElement.dataset.motion = next
    setMotion(next)
    try {
      if (next === 'system') localStorage.removeItem('linha-clara:motion')
      else localStorage.setItem('linha-clara:motion', next)
    } catch {
      // The selection still applies to the current page.
    }
  }

  function navigate(url, replace = false) {
    if (location.pathname + location.search !== url) history[replace ? 'replaceState' : 'pushState']({}, '', url)
    setRoute(currentRoute())
    setDialog(null)
    window.scrollTo(0, 0)
  }

  function library(section = 'home', folder = null, replace = false) {
    const query = new URLSearchParams()
    if (section !== 'home') query.set('view', section)
    if (folder) query.set('folder', folder)
    navigate('/home/' + (query.size ? '?' + query : ''), replace)
  }

  function open(item) {
    const query = new URLSearchParams({ id: item.id })
    if (route.section === 'favorites') query.set('view', route.section)
    navigate('/editor/?' + query)
  }

  function patch(item, updates, timestamp = true) {
    change((list) => list.map((entry) => entry.id === item.id
      ? { ...entry, ...updates, updated: timestamp ? Date.now() : entry.updated } : entry))
  }

  function requestCreate(type, parent = route.folder) {
    if (!ready) return
    const index = new Map(latest.current.map((item) => [item.id, item]))
    const destination = index.get(parent)
    const folder = destination?.type === 'folder' && !isTrashed(destination, index) ? parent : null
    if (type === 'import') {
      if (busyImport) return
      if (route.page === 'welcome') {
        setDialog({ type: 'import', parent: folder })
        return
      }
      importFolder.current = folder
      importInput.current.click()
    } else setDialog({ type: 'create', itemType: type, parent: folder })
  }

  async function create(values) {
    const item = newItem({ ...values, parent: dialog.parent })
    await change((list) => [...list, item])
    setDialog(null)
    if (item.type === 'folder') notify('Pasta criada.')
    else open(item)
  }

  async function importFiles(files, folder) {
    if (!files.length || busyImport) return
    setBusyImport(true)
    let imported = 0
    const failures = []
    for (const file of files) {
      try {
        const current = latest.current
        const index = new Map(current.map((item) => [item.id, item]))
        const parent = index.has(folder) && !isTrashed(index.get(folder), index) ? folder : null
        let entries
        if (/\.json$/i.test(file.name)) {
          entries = readBackup(await file.text(), parent)
        } else if (/\.pdf$/i.test(file.name)) {
          const { importPdf } = await import('./pdf')
          entries = [await importPdf(file, parent)]
        } else if (/\.txt$/i.test(file.name)) {
          const item = newItem({ type: 'text', title: file.name.replace(/\.txt$/i, ''), parent })
          const wrapper = document.createElement('div')
          wrapper.textContent = await file.text()
          item.html = wrapper.innerHTML.replace(/\r?\n/g, '<br>')
          entries = [item]
        } else throw new Error('Escolha um PDF, TXT ou uma cópia do Linha Clara.')
        await change((list) => [...list, ...entries])
        imported += entries.length
      } catch (error) {
        failures.push(file.name + ' — ' + error.message)
      }
    }
    setBusyImport(false)
    if (failures.length) notify((imported ? imported + ' importado(s). ' : '') + failures.join(' '), true)
    else notify(imported === 1 ? 'Arquivo importado.' : imported + ' itens importados.')
    if (imported && (currentRoute().page === 'welcome' || route.section !== 'home')) library('home', folder)
  }

  function act(action, item) {
    if (action === 'favorite') {
      patch(item, { favorite: !item.favorite }, false)
      notify(item.favorite ? 'Removido dos favoritos.' : 'Adicionado aos favoritos.')
    }
    if (action === 'backup') {
      const ids = descendants(latest.current, item.id)
      downloadBackup(latest.current.filter((entry) => ids.has(entry.id)), item.title)
      notify('Cópia editável baixada.')
    }
    if (action === 'trash') {
      patch(item, { deleted: true }, false)
      notify('Movido para a lixeira.')
    }
    if (action === 'restore') {
      const index = new Map(latest.current.map((entry) => [entry.id, entry]))
      patch(item, { deleted: false, parent: isTrashed(index.get(item.parent), index) ? null : item.parent }, false)
      notify('Item restaurado.')
    }
    if (action === 'duplicate') {
      const source = latest.current
      const ids = new Map([...descendants(source, item.id)].map((id) => [id, uid()]))
      const copies = source.filter((entry) => ids.has(entry.id)).map((entry) => ({
        ...entry, id: ids.get(entry.id), parent: ids.get(entry.parent) ?? entry.parent,
        updated: Date.now(), title: entry.id === item.id ? (entry.title + ' (cópia)').slice(0, 120) : entry.title,
      }))
      change((list) => [...list, ...copies])
      notify('Cópia criada.')
    }
    if (['rename', 'move', 'delete', 'emptyTrash'].includes(action)) setDialog({ type: action, item })
  }

  const index = new Map(items.map((item) => [item.id, item]))
  const doc = index.get(route.doc)
  const folder = index.get(route.folder)
  const editReady = ready && doc && doc.type !== 'folder' && !isTrashed(doc, index)
  const validFolder = folder && folder.type === 'folder' && !isTrashed(folder, index) ? folder.id : null

  const close = () => setDialog(null)
  const exportLibrary = () => {
    downloadBackup(latest.current)
    notify('Cópia da biblioteca baixada.')
  }

  return <>
    {route.page === 'welcome' ? <Welcome create={requestCreate} ready={ready} busyImport={busyImport} storageError={storageError} backup={exportLibrary} /> : route.page === 'editor' ?
      (editReady ? <Suspense fallback={<main className="loading-view">Abrindo documento…</main>}>
        <Editor key={doc.id} item={doc} patch={(updates, timestamp) => patch(doc, updates, timestamp)} notify={notify}
          leave={() => library(route.section, route.section === 'home' ? doc.parent : null)}
          act={(action) => act(action, doc)} storageError={storageError} />
      </Suspense> : <main className="loading-view">{ready ? <><h1>Documento indisponível</h1><button className="button primary" onClick={() => library('home', null, true)}>Voltar à biblioteca</button></> : 'Abrindo documento…'}</main>)
      : route.section === 'studio' ? <Suspense fallback={<main className="loading-view">Abrindo estúdio de desenho…</main>}><SketchStudio leave={() => library()} /></Suspense> : <Library items={items} section={route.section} folderId={validFolder} select={library} open={open} create={requestCreate} act={act}
          busy={!ready} storageError={storageError} backup={exportLibrary} help={() => setDialog({ type: 'help' })}
          theme={theme} changeTheme={changeTheme} motionSettings={() => setDialog({ type: 'motion' })} />}
    <input ref={importInput} type="file" accept={importAccept} multiple hidden onChange={(event) => {
      const files = Array.from(event.currentTarget.files)
      event.currentTarget.value = ''
      importFiles(files, importFolder.current)
    }} />
    {busyImport && <div className="status-float" role="status">Importando arquivos…</div>}
    {message && <div className={'toast' + (message.error ? ' toast-error' : '')} role={message.error ? 'alert' : 'status'}>
      {message.error ? <CircleAlert size={18} /> : <Check size={18} />}<span>{message.text}</span>
      <IconButton label="Fechar aviso" onClick={() => setMessage(null)}><X size={16} /></IconButton>
    </div>}
    {dialog?.type === 'create' && <CreateDialog key={dialog.itemType} type={dialog.itemType} close={close} create={create} />}
    {dialog?.type === 'import' && <Dialog title="Importar arquivos" close={close}>
      <p className="dialog-copy" id="import-formats">Selecione PDFs, arquivos TXT ou cópias JSON do Linha Clara.</p>
      <form onSubmit={(event) => {
        event.preventDefault()
        const input = event.currentTarget.elements.namedItem('files')
        const files = Array.from(input.files)
        close()
        importFiles(files, dialog.parent)
      }}>
        <label className="form-label">Arquivos
          <input type="file" name="files" accept={importAccept} aria-describedby="import-formats" multiple required data-autofocus />
        </label>
        <footer className="dialog-actions">
          <button type="button" className="button secondary" onClick={close}>Cancelar</button>
          <button type="submit" className="button primary">Importar</button>
        </footer>
      </form>
    </Dialog>}
    {dialog?.type === 'rename' && <Dialog title="Renomear" close={close}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const title = new FormData(event.currentTarget).get('title').trim()
        if (!title) return
        patch(dialog.item, { title })
        close()
      }}>
        <label className="form-label">Nome<input name="title" defaultValue={dialog.item.title} required maxLength={120} data-autofocus /></label>
        <footer className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary">Salvar</button></footer>
      </form>
    </Dialog>}
    {dialog?.type === 'move' && <Dialog title="Mover para pasta" close={close}>
      <form onSubmit={(event) => {
        event.preventDefault()
        patch(dialog.item, { parent: new FormData(event.currentTarget).get('place') || null })
        close()
        notify('Item movido.')
      }}>
        <label className="form-label">Destino<select name="place" data-autofocus defaultValue={dialog.item.parent ?? ''}>
          <option value="">Biblioteca</option>
          {items.filter((entry) => entry.type === 'folder' && !isTrashed(entry, index) &&
            !descendants(items, dialog.item.id).has(entry.id)).map((entry) => <option key={entry.id} value={entry.id}>{folderPath(entry, index)}</option>)}
        </select></label>
        <footer className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary">Mover</button></footer>
      </form>
    </Dialog>}
    {['delete', 'emptyTrash'].includes(dialog?.type) && <Dialog title={dialog.type === 'delete' ? 'Excluir definitivamente?' : 'Esvaziar a lixeira?'} close={close}>
      <p className="dialog-copy">{dialog.type === 'delete' ? '“' + dialog.item.title + '” será excluído deste navegador.' : 'Todos os itens da lixeira serão excluídos deste navegador.'} Esta ação é permanente.</p>
      <footer className="dialog-actions">
        <button type="button" className="button secondary" onClick={close} data-autofocus>Cancelar</button>
        <button className="button destructive" onClick={() => {
          change((list) => {
            if (dialog.type === 'delete') {
              const ids = descendants(list, dialog.item.id)
              return list.filter((entry) => !ids.has(entry.id))
            }
            const byId = new Map(list.map((entry) => [entry.id, entry]))
            return list.filter((entry) => !isTrashed(entry, byId))
          })
          close()
          notify('Exclusão concluída.')
        }}>{dialog.type === 'delete' ? 'Excluir' : 'Esvaziar'}</button>
      </footer>
    </Dialog>}
    {dialog?.type === 'help' && <Dialog title="Seu espaço local" close={close}>
      <div className="dialog-help"><CloudOff size={24} /><p>Seus documentos são salvos neste navegador. Baixe uma cópia antes de limpar os dados do site ou para levar seus documentos para outro navegador.</p></div>
      <footer className="dialog-actions"><button className="button secondary" onClick={close}>Fechar</button><button className="button primary" onClick={exportLibrary}>Baixar cópia</button></footer>
    </Dialog>}
    {dialog?.type === 'motion' && <Dialog title="Animações" close={close}>
      <label className="form-label">Movimento na interface
        <select value={motion} onChange={(event) => changeMotion(event.target.value)} data-autofocus>
          <option value="system">Seguir o dispositivo</option>
          <option value="full">Animações completas</option>
          <option value="reduced">Movimento reduzido</option>
        </select>
      </label>
      <p className="dialog-copy">A preferência vale para o Linha Clara neste navegador.</p>
      <footer className="dialog-actions"><button className="button primary" onClick={close}>Concluir</button></footer>
    </Dialog>}
  </>
}

function folderPath(item, index) {
  const parts = [item.title]
  const seen = new Set([item.id])
  for (let parent = index.get(item.parent); parent && !seen.has(parent.id); parent = index.get(parent.parent)) {
    parts.unshift(parent.title)
    seen.add(parent.id)
  }
  return parts.join(' / ')
}
