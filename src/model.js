import { Capacitor, registerPlugin } from '@capacitor/core'

const saveDocument = registerPlugin('SaveDocument')

export const colors = {
  sage: ['#dce7d8', '#43634a', 'Sálvia'],
  clay: ['#f1ddd3', '#9b5242', 'Argila'],
  lilac: ['#e7e0ef', '#685080', 'Lavanda'],
  sand: ['#f0e4c9', '#806338', 'Areia'],
  blue: ['#dce7ed', '#3f6274', 'Azul'],
}

export const labels = { notebook: 'Caderno', whiteboard: 'Quadro branco', text: 'Documento de texto', folder: 'Pasta', pdf: 'PDF' }
export const papers = { plain: 'Em branco', lined: 'Pautado', grid: 'Quadriculado', dots: 'Pontilhado' }
export const uid = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2)

export function newPage({ paper = 'lined', width = 750, height = 1000, pdfPage } = {}) {
  return { id: uid(), paper, width, height, pdfPage, items: [], bookmarked: false }
}

export function newItem({ type, title, color = 'sage', paper = 'lined', landscape = false, size = 'a4', parent = null }) {
  const dimensions = { a4: [750, 1060], letter: [750, 970], a5: [590, 835] }[size]
  const [width, height] = landscape ? [...dimensions].reverse() : dimensions
  return {
    id: uid(), type, title, color, parent, updated: Date.now(), favorite: false, deleted: false,
    pages: type === 'whiteboard' ? [newPage({ paper: 'dots', width: 2200, height: 1600 })]
      : type === 'notebook' ? [newPage({ paper, width, height })] : [],
    html: '',
  }
}

export function starterItems() {
  const examples = [
    { type: 'notebook', title: 'Planejamento semanal', color: 'sage', paper: 'lined' },
    { type: 'whiteboard', title: 'Mapa de ideias', color: 'clay' },
    { type: 'text', title: 'Notas de leitura', color: 'lilac' },
    { type: 'folder', title: 'Projetos', color: 'sand' },
    { type: 'folder', title: 'Pessoal', color: 'blue' },
  ]
  return examples.map((entry, index) => {
    const item = { ...newItem(entry), updated: Date.now() - index * 86400000, example: true, favorite: index === 0 }
    if (index === 0) {
      item.pages[0].items = [
        { id: uid(), type: 'text', x: 63, y: 72, value: 'Esta semana', size: 42, color: '#283d32' },
        { id: uid(), type: 'text', x: 68, y: 158, value: '• Definir as prioridades\n• Reservar tempo para ler\n• Revisar as ideias de sexta', size: 24, color: '#405746' },
      ]
    }
    if (index === 1) {
      item.pages[0].items = [
        { id: uid(), type: 'text', x: 120, y: 100, value: 'Ideias para explorar', size: 75, color: '#964a3c' },
        { id: uid(), type: 'sticky', x: 125, y: 300, value: 'Rascunhos', size: 52, color: '#f8df9d' },
        { id: uid(), type: 'sticky', x: 660, y: 340, value: 'Referências', size: 52, color: '#ded6f2' },
        { id: uid(), type: 'line', points: [{ x: 490, y: 330 }, { x: 642, y: 365 }], size: 8, color: '#964a3c' },
      ]
    }
    if (index === 2) item.html = '<h2>Notas de leitura</h2><p>Um lugar para guardar citações, perguntas e ideias de livros.</p><h3>Para lembrar</h3><ul><li>Que ideia ficou comigo?</li><li>Como posso colocar essa ideia em prática?</li></ul>'
    return item
  })
}

export function isTrashed(item, byId) {
  const visited = new Set()
  let node = item
  while (node && !visited.has(node.id)) {
    if (node.deleted) return true
    visited.add(node.id)
    node = byId.get(node.parent)
  }
  return false
}

export function descendants(items, id) {
  const ids = new Set([id])
  for (const current of ids) {
    for (const item of items) if (item.parent === current) ids.add(item.id)
  }
  return ids
}

const storedTags = new Set(['P', 'DIV', 'BR', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'A', 'TABLE', 'TBODY', 'THEAD', 'TR', 'TH', 'TD', 'IMG', 'FONT'])
export function cleanHtml(contents) {
  const template = document.createElement('template')
  template.innerHTML = String(contents ?? '')
  for (const node of [...template.content.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'].includes(node.tagName)) {
      node.remove()
      continue
    }
    if (!storedTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes)
      continue
    }
    for (const attr of [...node.attributes]) {
      if (attr.name === 'href' && node.tagName === 'A' && /^(https?:\/\/|mailto:)/i.test(attr.value)) continue
      if (attr.name === 'src' && node.tagName === 'IMG' && isLocalImage(attr.value)) continue
      if (attr.name === 'alt' && node.tagName === 'IMG') continue
      if (attr.name === 'color' && node.tagName === 'FONT' && /^#[\da-f]{6}$/i.test(attr.value)) continue
      node.removeAttribute(attr.name)
    }
    if (node.tagName === 'A') {
      node.target = '_blank'
      node.rel = 'noopener noreferrer'
    }
    if (node.tagName === 'IMG' && !node.getAttribute('src')) node.remove()
  }
  return template.innerHTML
}

export const isLocalImage = (value) => typeof value === 'string' && /^data:image\/(?:png|jpe?g|webp|gif|avif);base64,[\w+/=]+$/i.test(value)
export const isLocalAudio = (value) => typeof value === 'string' && /^data:audio\/(?:webm|ogg|mp4|wav|x-wav|mpeg)(?:;codecs=[\w.,-]+)?;base64,[\w+/=]+$/i.test(value)
const objectTypes = new Set(['pen', 'marker', 'line', 'rect', 'ellipse', 'text', 'sticky', 'image'])

export function readBackup(contents, destination) {
  const source = JSON.parse(contents)
  if (source?.format !== 'linha-clara' || source.version !== 1 || !Array.isArray(source.items) || !source.items.length) {
    throw new Error('Este arquivo não é uma cópia do Linha Clara.')
  }
  const ids = new Map(source.items.map((item) => [item?.id, uid()]))
  const folders = new Map(source.items.filter((item) => item?.type === 'folder').map((item) => [item.id, item]))
  if (ids.size !== source.items.length || source.items.some((item) => !item?.id || !Object.hasOwn(labels, item.type))) throw new Error('A cópia tem documentos inválidos.')
  return source.items.map((item) => {
    const seen = new Set([item.id])
    for (let parent = folders.get(item.parent); parent; parent = folders.get(parent.parent)) {
      if (seen.has(parent.id)) throw new Error('A cópia tem uma estrutura de pastas inválida.')
      seen.add(parent.id)
    }
    const title = String(item.title ?? '').trim().slice(0, 120) || labels[item.type]
    const pages = Array.isArray(item.pages) ? item.pages.map((page) => ({
      id: uid(), paper: Object.hasOwn(papers, page.paper) ? page.paper : 'plain',
      width: Math.min(20000, Math.max(1, Number(page.width) || 750)), height: Math.min(20000, Math.max(1, Number(page.height) || 1000)),
      pdfPage: Number.isInteger(page.pdfPage) && page.pdfPage >= 0 ? page.pdfPage : undefined, bookmarked: Boolean(page.bookmarked),
      items: Array.isArray(page.items) ? page.items.filter((object) =>
        object && objectTypes.has(object.type) && (object.type !== 'image' || isLocalImage(object.src))
      ).map((object) => ({ ...object, id: uid() })) : [],
    })) : []
    const pdf = typeof item.pdf === 'string' && /^data:application\/pdf;base64,[\w+/=]+$/i.test(item.pdf) ? item.pdf : undefined
    if (item.type === 'pdf' && !pdf) throw new Error('A cópia não contém o arquivo de um dos PDFs.')
    return {
      id: ids.get(item.id), parent: folders.has(item.parent) ? ids.get(item.parent) : destination, title, type: item.type,
      updated: Number(item.updated) || Date.now(), color: Object.hasOwn(colors, item.color) ? item.color : 'sage',
      favorite: Boolean(item.favorite), deleted: Boolean(item.deleted), example: Boolean(item.example),
      html: cleanHtml(item.html), pages: pages.length || ['text', 'folder'].includes(item.type) ? pages : [newPage()],
      pdf, pdfText: String(item.pdfText ?? ''), audio: Array.isArray(item.audio)
        ? item.audio.filter((clip) => isLocalAudio(clip?.src)).map((clip) => ({ id: uid(), src: clip.src, created: Number(clip.created) || Date.now() })) : [],
    }
  })
}

export async function saveFile(contents, type, name) {
  const blob = new Blob([contents], { type })
  if (Capacitor.getPlatform() === 'android') {
    const dataUrl = await fileData(blob)
    const result = await saveDocument.save({ name, type, data: dataUrl.slice(dataUrl.indexOf(',') + 1) })
    return result.saved
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  return true
}

export const fileName = (title) => title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').trim() || 'documento'

export function downloadBackup(items, title = 'Biblioteca Linha Clara') {
  return saveFile(JSON.stringify({ format: 'linha-clara', version: 1, items }), 'application/json', fileName(title) + '.linha.json')
}

export const fileData = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'))
  reader.readAsDataURL(file)
})

export const searchable = (value) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR')
export function matches(item, query) {
  if (!query) return true
  const notes = item.pages.flatMap((page) => page.items.map((object) => object.value ?? '')).join(' ')
  const text = item.html ? new DOMParser().parseFromString(item.html, 'text/html').body.textContent : ''
  return searchable([item.title, notes, text, item.pdfText].join(' ')).includes(query)
}

export function dateLabel(date) {
  const sameDay = (left, right) => left.toDateString() === right.toDateString()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (sameDay(new Date(date), new Date())) return 'Hoje'
  if (sameDay(new Date(date), yesterday)) return 'Ontem'
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).format(date).replace('.', '')
}
