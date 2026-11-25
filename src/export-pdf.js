import { PDFDocument } from 'pdf-lib'
import { paintObject, paintPaper, preload, loadImage, wrapLine } from './drawing'
import { fileName, saveFile } from './model'

function canvasFor(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

async function pageImage(target, canvas) {
  return target.embedPng(canvas.toDataURL('image/png'))
}

async function renderNotes(page, transparent) {
  const scale = Math.min(1.7, 1600 / Math.max(page.width, page.height))
  const canvas = canvasFor(Math.ceil(page.width * scale), Math.ceil(page.height * scale))
  const context = canvas.getContext('2d')
  context.scale(scale, scale)
  paintPaper(context, page, transparent)
  const resources = await preload(page.items)
  for (const object of page.items) paintObject(context, object, resources)
  return canvas
}

async function textPages(target, html) {
  const body = new DOMParser().parseFromString(html || '<p></p>', 'text/html').body
  let canvas, ctx, y
  function start() {
    canvas = canvasFor(840, 1188)
    ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fffefa'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    y = 82
  }
  async function flush() {
    const image = await pageImage(target, canvas)
    const page = target.addPage([595, 842])
    page.drawImage(image, { x: 0, y: 0, width: 595, height: 842 })
  }
  async function reserve(height) {
    if (y + height < 1120) return
    await flush()
    start()
  }
  async function line(text, x, size, style) {
    const font = (style || 'normal') + ' ' + size + 'px "DM Sans Variable", Arial, sans-serif'
    ctx.font = font
    const lines = wrapLine(ctx, text, 765 - x)
    for (const part of lines) {
      await reserve(size * 1.45)
      ctx.font = font
      ctx.textBaseline = 'top'
      ctx.fillStyle = '#26372b'
      ctx.fillText(part, x, y)
      y += size * 1.45
    }
  }
  async function block(node, level = 0, prefix = '') {
    const x = 75 + Math.min(level, 4) * 22
    if (node.nodeName === 'IMG') {
      const image = await loadImage(node.getAttribute('src'))
      const ratio = Math.min(1, (760 - x) / image.naturalWidth, 850 / image.naturalHeight)
      await reserve(image.naturalHeight * ratio + 20)
      ctx.drawImage(image, x, y, image.naturalWidth * ratio, image.naturalHeight * ratio)
      y += image.naturalHeight * ratio + 20
      return
    }
    const children = [...node.childNodes]
    const name = node.nodeName
    if (name === 'UL' || name === 'OL') {
      const entries = [...node.children]
      for (const [index, child] of entries.entries()) await block(child, level + 1, name === 'OL' ? (index + 1) + '. ' : '• ')
      y += 10
      return
    }
    if (['BODY', 'TABLE', 'TBODY', 'THEAD'].includes(name)
      || (name === 'DIV' && children.some((child) => ['DIV', 'P', 'UL', 'OL', 'IMG', 'TABLE'].includes(child.nodeName)))) {
      for (const child of children) await block(child, level)
      return
    }
    const text = name === 'TR' ? [...node.children].map((entry) => entry.textContent).join('     |     ')
      : children.map((child) => child.nodeName === 'BR' ? '\n' : child.textContent).join('') || (node.nodeType === 3 ? node.textContent : '')
    if (text.trim() || name === 'BR') {
      const size = name === 'H2' ? 38 : name === 'H3' ? 29 : 22
      const style = name === 'BLOCKQUOTE' ? 'italic' : /^H[23]$/.test(name) ? 'bold' : ''
      const paragraphs = text.split('\n')
      for (const [index, paragraph] of paragraphs.entries()) await line((index === 0 ? prefix : '') + paragraph, x, size, style)
      if (name !== 'LI') y += 12
    }
    for (const child of children.filter((entry) => entry.nodeName === 'IMG')) await block(child, level)
  }
  start()
  await block(body)
  await flush()
}

export async function exportPdf(item) {
  const target = await PDFDocument.create()
  target.setTitle(item.title)
  if (item.type === 'text') {
    await textPages(target, item.html)
  } else {
    const original = item.pdf ? await PDFDocument.load(item.pdf).catch(() => null) : null
    let source, loading
    try {
      for (const page of item.pages) {
        const sourcePage = page.pdfPage === undefined ? null : original?.getPage(page.pdfPage)
        if (sourcePage && sourcePage.getRotation().angle === 0) {
          const [copy] = await target.copyPages(original, [page.pdfPage])
          target.addPage(copy)
          if (page.items.length || page.paper !== 'plain') {
            const overlay = await pageImage(target, await renderNotes(page, true))
            copy.drawImage(overlay, copy.getCropBox())
          }
          continue
        }
        const notes = await renderNotes(page, page.pdfPage !== undefined)
        const context = notes.getContext('2d')
        if (page.pdfPage !== undefined) {
          if (!source) {
            loading = await (await import('./pdf')).loadPdf(item.pdf)
            source = await loading.promise
          }
          const base = await source.getPage(page.pdfPage + 1)
          const viewport = base.getViewport({ scale: notes.width / base.getViewport({ scale: 1 }).width })
          const background = canvasFor(notes.width, notes.height)
          await base.render({ canvas: background, viewport }).promise
          context.save()
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.globalCompositeOperation = 'destination-over'
          context.drawImage(background, 0, 0)
          context.restore()
        }
        const ratio = 842 / Math.max(page.width, page.height)
        const width = page.width * ratio, height = page.height * ratio
        const output = target.addPage([width, height])
        output.drawImage(await pageImage(target, notes), { x: 0, y: 0, width, height })
      }
    } finally {
      if (loading) await loading.destroy()
    }
  }
  saveFile(await target.save(), 'application/pdf', fileName(item.title) + '.pdf')
}
