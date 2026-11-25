import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownToLine, ArrowLeft, BookOpen, ChevronDown, ChevronRight, CircleHelp, CloudOff, Copy, FileText, Folder, FolderInput,
  Grid2X2, Layout, List, Menu as MenuIcon, Moon, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Star, Sun, Trash2, Upload, X,
} from 'lucide-react'
import { colors, dateLabel, isTrashed, labels, matches, searchable } from './model'
import { Brand, IconButton, itemIcons, Menu, MenuOption } from './ui'

const navigation = [
  { key: 'home', title: 'Biblioteca', icon: BookOpen },
  { key: 'favorites', title: 'Favoritos', icon: Star },
  { key: 'studio', title: 'Estúdio de desenho', icon: Pencil },
  { key: 'trash', title: 'Lixeira', icon: Trash2 },
]

function NewMenu({ create }) {
  return <Menu label="Novo" trigger={(props) => <button {...props} className="button primary new-button">
    <Plus size={17} strokeWidth={2.2} /><span>Novo</span><ChevronDown size={15} />
  </button>}>
    <MenuOption icon={BookOpen} onClick={() => create('notebook')}>Caderno</MenuOption>
    <MenuOption icon={Layout} onClick={() => create('whiteboard')}>Quadro branco</MenuOption>
    <MenuOption icon={FileText} onClick={() => create('text')}>Documento de texto</MenuOption>
    <MenuOption icon={Folder} onClick={() => create('folder')}>Pasta</MenuOption>
    <hr />
    <MenuOption icon={Upload} onClick={() => create('import')}>Importar arquivo</MenuOption>
  </Menu>
}

export function ItemMenu({ item, act, trashed = false }) {
  return <Menu label={'Opções de ' + item.title} trigger={(props) => <button className="icon-button card-menu" title={'Opções de ' + item.title} {...props}><MoreHorizontal size={19} /></button>}>
    {trashed ? <>
      <MenuOption icon={RotateCcw} onClick={() => act('restore', item)}>Restaurar</MenuOption>
      <MenuOption icon={Trash2} danger onClick={() => act('delete', item)}>Excluir definitivamente</MenuOption>
    </> : <>
      <MenuOption icon={Star} onClick={() => act('favorite', item)}>{item.favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}</MenuOption>
      <MenuOption icon={Pencil} onClick={() => act('rename', item)}>Renomear</MenuOption>
      <MenuOption icon={FolderInput} onClick={() => act('move', item)}>Mover para pasta</MenuOption>
      <MenuOption icon={Copy} onClick={() => act('duplicate', item)}>Duplicar</MenuOption>
      <MenuOption icon={ArrowDownToLine} onClick={() => act('backup', item)}>Baixar cópia editável</MenuOption>
      <hr />
      <MenuOption icon={Trash2} danger onClick={() => act('trash', item)}>Mover para a lixeira</MenuOption>
    </>}
  </Menu>
}

function ItemCard({ item, act, open, trashed, list, childCount }) {
  const [fill, ink] = colors[item.color]
  const Icon = itemIcons[item.type]
  const folder = item.type === 'folder'
  return <article className={'item-card' + (folder ? ' folder-card' : '') + (list ? ' item-row' : '')} style={{ '--cover': fill, '--cover-ink': ink }}>
    <button className="item-open" title={trashed ? 'Restaurar ' + item.title : item.title} onClick={() => trashed ? act('restore', item) : open(item)}>
      {folder || list ? <span className="folder-icon"><Icon size={folder ? 21 : 18} strokeWidth={1.7} /></span> :
        <span className={'item-cover item-cover--' + item.type} aria-hidden="true">
          <span className="cover-object"><Icon size={17} strokeWidth={1.55} /><span>{item.title}</span></span>
        </span>}
      <span className="item-details">
        <strong>{item.title}</strong>
        <span className="item-meta">
          {folder ? <span>{childCount} {childCount === 1 ? 'item' : 'itens'}</span> :
            <><span>{labels[item.type]}</span><span>{dateLabel(item.updated)}</span></>}
          {item.example && <span>Exemplo</span>}
        </span>
      </span>
    </button>
    {item.favorite && !trashed && <Star className="favorite-indicator" size={14} aria-label="Favorito" />}
    <ItemMenu item={item} act={act} trashed={trashed} />
  </article>
}

const sorters = {
  recent: (a, b) => b.updated - a.updated,
  name: (a, b) => a.title.localeCompare(b.title, 'pt-BR'),
  oldest: (a, b) => a.updated - b.updated,
}
export function Library({ items, section, folderId, select, open, create, act, busy, storageError, backup, help, theme, changeTheme }) {
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [sort, setSort] = useState('recent')
  const [list, setList] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const search = useRef(null)
  const drawerTrigger = useRef(null)
  const drawerClose = useRef(null)
  const index = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const active = useMemo(() => items.filter((item) => !isTrashed(item, index)), [items, index])
  const folder = index.get(folderId)
  const folders = active.filter((item) => item.type === 'folder' && !item.parent).sort(sorters.name)
  const normalized = searchable(query.trim())
  const title = folder?.title ?? navigation.find(({ key }) => key === section)?.title ?? 'Biblioteca'
  const candidates = section === 'trash' ? items.filter((item) => item.deleted && !isTrashed(index.get(item.parent), index))
    : section === 'favorites' ? active.filter((item) => item.favorite)
    : normalized ? active : active.filter((item) => item.parent === folderId)
  const visible = candidates.filter((item) => (!typeFilter || item.type === typeFilter) && matches(item, normalized)).sort(sorters[sort])
  const rootView = section === 'home' && !folder && !normalized && !typeFilter
  const documents = rootView ? visible.filter((item) => item.type !== 'folder') : visible
  const visibleFolders = rootView ? visible.filter((item) => item.type === 'folder') : []
  const back = folder ? index.get(folder.parent) : null

  useEffect(() => {
    function shortcuts(event) {
      if (sidebar) {
        if (event.key === 'Escape') closeSidebar()
        return
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        search.current?.focus()
      }
    }
    window.addEventListener('keydown', shortcuts)
    return () => window.removeEventListener('keydown', shortcuts)
  }, [sidebar])

  useEffect(() => {
    if (!sidebar) return
    drawerClose.current?.focus()
    const mobile = window.matchMedia('(max-width: 820px)')
    function closeOnDesktop(event) {
      if (!event.matches) setSidebar(false)
    }
    mobile.addEventListener('change', closeOnDesktop)
    return () => mobile.removeEventListener('change', closeOnDesktop)
  }, [sidebar])

  function closeSidebar() {
    setSidebar(false)
    requestAnimationFrame(() => drawerTrigger.current?.focus())
  }

  function go(key, id = null) {
    setQuery('')
    setTypeFilter('')
    setSidebar(false)
    select(key, id)
  }

  function openItem(item) {
    if (item.type === 'folder') go('home', item.id)
    else open(item)
  }

  function collection(entries, cssClass) {
    return <div className={list ? 'item-list' : 'item-grid ' + (cssClass || '')}>{entries.map((item) =>
      <ItemCard key={item.id} item={item} act={act} open={openItem} list={list} trashed={section === 'trash'} childCount={active.filter((child) => child.parent === item.id).length} />,
    )}</div>
  }

  return <div className="library-shell">
    {sidebar && <button className="sidebar-scrim" aria-label="Fechar navegação" tabIndex={-1} onClick={closeSidebar} />}
    <aside id="library-navigation" className={'sidebar' + (sidebar ? ' sidebar-open' : '')} aria-label="Navegação">
      <div className="sidebar-top"><button className="brand-button" onClick={() => go('home')}><Brand /></button><IconButton ref={drawerClose} label="Fechar navegação" className="mobile-only" onClick={closeSidebar}><X size={20} /></IconButton></div>
      <nav aria-label="Biblioteca">
        {navigation.map(({ key, title: label, icon: Icon }) => <button key={key} onClick={() => go(key)} aria-current={section === key && !folderId ? 'page' : undefined}>
          <Icon size={18} strokeWidth={1.75} />{label}
        </button>)}
      </nav>
      <div className="sidebar-folders">
        <div className="sidebar-label"><span>Pastas</span><IconButton label="Criar pasta" onClick={() => { setSidebar(false); create('folder', null) }}><Plus size={16} /></IconButton></div>
        <nav aria-label="Pastas">{folders.map((entry) => <button key={entry.id} onClick={() => go('home', entry.id)} aria-current={folderId === entry.id ? 'page' : undefined}>
          <Folder size={17} strokeWidth={1.65} /><span>{entry.title}</span>
        </button>)}</nav>
      </div>
      <button type="button" className="local-card" onClick={help}>
        <span className="local-icon"><CloudOff size={17} strokeWidth={1.7} /></span>
        <span><strong>Espaço local</strong><small>Salvo neste navegador</small></span><ChevronRight size={15} className="local-chevron" />
      </button>
    </aside>
    <div className="library-main" inert={sidebar}>
      <header className="topbar">
        <div className="topbar-leading">
          <IconButton ref={drawerTrigger} label="Abrir navegação" className="mobile-only" aria-controls="library-navigation" aria-expanded={sidebar} onClick={() => setSidebar(true)}><MenuIcon size={21} /></IconButton>
          <button className="topbar-space back-link" type="button" onClick={() => go('home')}><BookOpen size={16} /> Arquivos</button>
          <span className="topbar-brand"><Brand /></span>
        </div>
        <div className="topbar-actions">
          <label className="theme-control">
            {theme === 'light' ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
            <select aria-label="Tema da interface" value={theme} onChange={(event) => changeTheme(event.target.value)}>
              <option value="dark">Escuro</option><option value="light">Claro</option>
            </select>
            <ChevronDown size={13} aria-hidden="true" />
          </label>
          <Menu label="Opções do espaço" trigger={(props) => <button {...props} className="icon-button space-options" title="Opções do espaço"><MoreHorizontal size={20} /></button>}>
            <MenuOption icon={ArrowDownToLine} onClick={backup}>Baixar cópia da biblioteca</MenuOption>
            <MenuOption icon={Upload} onClick={() => create('import', null)}>Importar cópia ou arquivo</MenuOption>
            <MenuOption icon={CircleHelp} onClick={help}>Sobre o armazenamento</MenuOption>
          </Menu>
        </div>
      </header>
      <main className="workspace" id="main-content">
        {storageError && <div className="notice error" role="alert">{storageError}</div>}
        <div className="heading-row">
          <div>
            {folder && <button className="back-link" onClick={() => go('home', back?.id ?? null)}><ArrowLeft size={15} />{back?.title ?? 'Biblioteca'}</button>}
            <h1>{normalized ? 'Resultados da busca' : title}</h1>
            {normalized && <p>Resultados para “{query.trim()}”</p>}
          </div>
          {section === 'trash' ? visible.length > 0 && <button className="button secondary" onClick={() => act('emptyTrash')}><Trash2 size={17} />Esvaziar lixeira</button> : <NewMenu create={create} />}
        </div>
        <div className="library-controls">
          <div className="search-box">
            <Search size={17} aria-hidden="true" />
            <input ref={search} type="search" aria-label="Buscar na biblioteca" placeholder="Buscar na biblioteca" value={query} onChange={(event) => setQuery(event.target.value)} />
            {query ? <IconButton label="Limpar busca" onClick={() => { setQuery(''); search.current.focus() }}><X size={15} /></IconButton> : <kbd aria-hidden="true">Ctrl K</kbd>}
          </div>
            <div className="collection-controls">
              <label className="sort-control"><span className="sr-only">Tipo de arquivo</span><select aria-label="Filtrar por tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="">Todos os tipos</option><option value="notebook">Cadernos</option><option value="whiteboard">Quadros</option>
                <option value="text">Notas de texto</option><option value="pdf">PDFs</option><option value="folder">Pastas</option>
              </select><ChevronDown size={14} aria-hidden="true" /></label>
              <label className="sort-control"><span className="sr-only">Ordenação</span><select aria-label="Ordenação" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="recent">Mais recentes</option><option value="name">Nome</option><option value="oldest">Mais antigos</option>
              </select><ChevronDown size={14} /></label>
              <div className="view-switch" role="group" aria-label="Modo de exibição">
                <IconButton label="Visualização em grade" aria-pressed={!list} onClick={() => setList(false)}><Grid2X2 size={16} /></IconButton>
                <IconButton label="Visualização em lista" aria-pressed={list} onClick={() => setList(true)}><List size={17} /></IconButton>
              </div>
            </div>
        </div>
        <section className="collection" aria-labelledby="collection-title">
          <div className="section-heading">
            <h2 id="collection-title">{rootView ? 'Documentos' : 'Itens'} <span>{documents.length}</span></h2>
          </div>
          {busy ? <div className="empty-state" role="status">Carregando documentos…</div> : documents.length ? collection(documents) : <div className="empty-state">
            {normalized ? <Search size={24} /> : section === 'favorites' ? <Star size={24} /> : section === 'trash' ? <Trash2 size={24} /> : <BookOpen size={24} />}
            <strong>{normalized ? 'Nenhum resultado encontrado' : typeFilter ? 'Nenhum item deste tipo' : section === 'favorites' ? 'Nenhum favorito ainda' : section === 'trash' ? 'A lixeira está vazia' : 'Nenhum documento aqui'}</strong>
            <span>{typeFilter ? 'Escolha outro tipo de arquivo.' : normalized ? 'Busque por outro título ou trecho.' : section === 'favorites' ? 'Marque um item como favorito pelo menu de opções.' : section === 'trash' ? 'Itens excluídos poderão ser restaurados aqui.' : 'Crie um documento ou importe um arquivo.'}</span>
          </div>}
        </section>
        {rootView && <section className="collection folders-collection" aria-labelledby="folders-title">
          <div className="section-heading"><h2 id="folders-title">Pastas <span>{visibleFolders.length}</span></h2><button className="button link-button" onClick={() => create('folder')}><Plus size={16} />Nova pasta</button></div>
          {visibleFolders.length > 0 ? collection(visibleFolders, 'folder-grid') : <p className="folder-empty">Crie uma pasta para organizar seus documentos.</p>}
        </section>}
      </main>
    </div>
  </div>
}
