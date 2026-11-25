import { useEffect, useRef, useState } from 'react'
import { fileData, isLocalImage, uid } from './model'
import { hits, itemBounds, itemsInside, moveObject, paintObject, paintPaper, preload } from './drawing'

function PdfLayer({ source, index, canvasRef, notify }) {
  useEffect(() => {
    let active = true, loading, task
    const canvas = canvasRef.current
    async function render() {
      try {
        loading = await (await import('./pdf')).loadPdf(source)
        const content = await loading.promise
        if (!active) return
        const page = await content.getPage(index + 1)
        if (!active) return
        const first = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: 1400 / Math.max(first.width, first.height) })
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        task = page.render({ canvas, viewport })
        await task.promise
      } catch {
        if (active) notify('Não foi possível exibir esta página do PDF.', true)
      } finally {
        if (loading) await loading.destroy()
      }
    }
    render()
    return () => { active = false; task?.cancel() }
  }, [source, index])
  return <canvas className="pdf-page" ref={canvasRef} aria-hidden="true" />
}

export default function DrawingSurface({ page, item, tool, color, size, zoom, readOnly, selection, select, update, addText, scrollRef, notify }) {
  const canvas = useRef(null)
  const pdfCanvas = useRef(null)
  const gesture = useRef(null)
  const [preview, setPreview] = useState(null)
  const [resources, setResources] = useState(new Map())
  const imageTool = useRef(null)
  const dropPoint = useRef(null)
  const pdf = page.pdfPage !== undefined
  const scale = Math.min(1.85, 1900 / Math.max(page.width, page.height))
  const width = Math.ceil(page.width * scale)
  const height = Math.ceil(page.height * scale)

  useEffect(() => {
    let active = true
    preload(page.items).then((results) => { if (active) setResources(results) })
    return () => { active = false }
  }, [page.items])

  useEffect(() => {
    const context = canvas.current.getContext('2d')
    context.setTransform(width / page.width, 0, 0, height / page.height, 0, 0)
    context.clearRect(0, 0, page.width, page.height)
    paintPaper(context, page, pdf)
    const erased = new Set(preview?.erased ?? [])
    for (const object of page.items) {
      if (erased.has(object.id)) continue
      const moving = preview?.move && selection.includes(object.id)
      const displayed = moving ? moveObject(object, preview.move.x, preview.move.y) : object
      paintObject(context, displayed, resources)
      if (selection.includes(object.id)) {
        const bounds = itemBounds(displayed)
        context.save()
        context.strokeStyle = '#397154'
        context.lineWidth = 1.8
        context.setLineDash([7, 4])
        context.strokeRect(bounds.x - 5, bounds.y - 5, bounds.width + 10, bounds.height + 10)
        context.restore()
      }
    }
    if (preview?.object) paintObject(context, preview.object, resources)
    if (preview?.lasso?.length) {
      context.save()
      context.strokeStyle = '#397154'
      context.lineWidth = 2
      context.setLineDash([7, 5])
      context.beginPath()
      for (const [index, point] of preview.lasso.entries()) {
        if (index === 0) context.moveTo(point.x, point.y)
        else context.lineTo(point.x, point.y)
      }
      context.stroke()
      context.restore()
    }
  }, [page, pdf, preview, resources, selection, width, height])

  function point(event) {
    const bounds = canvas.current.getBoundingClientRect()
    return {
      x: (event.clientX - bounds.left) / bounds.width * page.width,
      y: (event.clientY - bounds.top) / bounds.height * page.height,
    }
  }

  function pointerDown(event) {
    if (!event.isPrimary || event.button !== 0) return
    const start = point(event)
    if (readOnly || tool === 'hand') {
      if (event.pointerType === 'touch') return
      event.currentTarget.setPointerCapture(event.pointerId)
      gesture.current = { tool: 'hand', x: event.clientX, y: event.clientY, left: scrollRef.current.scrollLeft, top: scrollRef.current.scrollTop }
      return
    }
    event.preventDefault()
    if (tool === 'text' || tool === 'sticky') {
      select([])
      addText({ x: start.x, y: start.y, type: tool })
      return
    }
    if (tool === 'image') {
      select([])
      dropPoint.current = start
      imageTool.current.click()
      return
    }
    const object = { id: uid(), type: tool === 'laser' ? 'pen' : tool, color: tool === 'laser' ? '#e04a3f' : color, size, points: [start] }
    const active = { tool, start, object, erased: new Set(), lasso: [start] }
    if (tool === 'lasso') {
      const target = [...page.items].reverse().find((entry) => hits(entry, start))
      if (target) {
        active.tool = 'move'
        active.ids = selection.includes(target.id) ? selection : [target.id]
        select(active.ids)
      } else select([])
    } else select([])
    event.currentTarget.setPointerCapture(event.pointerId)
    gesture.current = active
    if (tool === 'eraser') erase(active, start)
    show(active)
  }

  function erase(active, position) {
    for (const entry of page.items) if (hits(entry, position, size / 2 + 7)) active.erased.add(entry.id)
  }

  function show(active) {
    if (active.tool === 'move') setPreview({ move: active.delta })
    else if (active.tool === 'lasso') setPreview({ lasso: [...active.lasso] })
    else if (active.tool === 'eraser') setPreview({ erased: [...active.erased] })
    else setPreview({ object: { ...active.object, points: [...active.object.points] } })
  }

  function follow(event) {
    const active = gesture.current
    if (!active || !event.isPrimary) return
    if (active.tool === 'hand') {
      scrollRef.current.scrollLeft = active.left - (event.clientX - active.x)
      scrollRef.current.scrollTop = active.top - (event.clientY - active.y)
      return
    }
    const now = point(event)
    if (active.tool === 'move') active.delta = { x: now.x - active.start.x, y: now.y - active.start.y }
    else if (active.tool === 'lasso') active.lasso.push(now)
    else if (active.tool === 'eraser') erase(active, now)
    else if (['line', 'rect', 'ellipse'].includes(active.tool)) active.object.points = [active.start, now]
    else active.object.points.push(now)
    show(active)
  }

  function finish(event, cancelled = false) {
    const active = gesture.current
    if (!active || !event.isPrimary) return
    gesture.current = null
    setPreview(null)
    if (cancelled || active.tool === 'hand' || active.tool === 'laser') return
    if (active.tool === 'lasso') select(itemsInside(page.items, active.lasso))
    else if (active.tool === 'eraser') {
      if (active.erased.size) update(page.items.filter((entry) => !active.erased.has(entry.id)))
    } else if (active.tool === 'move') {
      if (active.delta && (Math.abs(active.delta.x) > 1 || Math.abs(active.delta.y) > 1)) {
        update(page.items.map((entry) => active.ids.includes(entry.id) ? moveObject(entry, active.delta.x, active.delta.y) : entry))
      }
    } else update([...page.items, active.object])
  }

  async function insertImage(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      const src = await fileData(file)
      if (!isLocalImage(src)) throw new Error()
      const bitmap = await createImageBitmap(file)
      const ratio = Math.min(1, page.width * .55 / bitmap.width, page.height * .55 / bitmap.height)
      const width = bitmap.width * ratio, height = bitmap.height * ratio
      bitmap.close()
      const position = dropPoint.current
      update([...page.items, { id: uid(), type: 'image', src, x: Math.max(0, Math.min(position.x, page.width - width)),
        y: Math.max(0, Math.min(position.y, page.height - height)), width, height }])
    } catch {
      notify('Escolha uma imagem PNG, JPEG, GIF, WebP ou AVIF válida.', true)
    }
  }

  return <div className={'page-surface ' + (item.type === 'whiteboard' ? 'board-surface' : '')} style={{
    '--sheet-width': Math.round(page.width * zoom / 100) + 'px', '--zoom': zoom / 100,
    aspectRatio: page.width + '/' + page.height,
  }}>
    {pdf && <PdfLayer source={item.pdf} index={page.pdfPage} canvasRef={pdfCanvas} notify={notify} />}
    <canvas aria-label={item.type === 'whiteboard' ? 'Área de desenho do quadro' : 'Área de anotação da página'} role="img" ref={canvas} className={'annotation-canvas tool-' + (readOnly ? 'hand' : tool)}
      width={width} height={height} onPointerDown={pointerDown} onPointerMove={follow} onPointerUp={finish}
      onPointerCancel={(event) => finish(event, true)} onDoubleClick={(event) => {
        if (readOnly || tool !== 'lasso') return
        const target = [...page.items].reverse().find((entry) => ['text', 'sticky'].includes(entry.type) && hits(entry, point(event)))
        if (target) addText(target)
      }} />
    <input ref={imageTool} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/avif" hidden onChange={insertImage} />
  </div>
}
