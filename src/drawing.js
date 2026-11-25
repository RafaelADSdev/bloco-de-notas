const images = new Map()

export function loadImage(source) {
  if (!images.has(source)) images.set(source, new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => { images.delete(source); reject(new Error('Não foi possível carregar uma imagem da página.')) }
    image.src = source
  }))
  return images.get(source)
}

export async function preload(items) {
  const result = new Map()
  await Promise.all(items.filter((item) => item.type === 'image').map(async (item) => {
    try { result.set(item.src, await loadImage(item.src)) } catch { /* Leave unreadable images out of the drawing. */ }
  }))
  return result
}

export function paintPaper(context, page, transparent = false) {
  if (!transparent) {
    context.fillStyle = '#fffefa'
    context.fillRect(0, 0, page.width, page.height)
  }
  if (page.paper === 'plain') return
  context.strokeStyle = '#e2e7df'
  context.fillStyle = '#d2d9d1'
  context.lineWidth = 1
  const startX = page.paper === 'lined' ? 28 : 0
  for (let y = (page.paper === 'lined' ? 57 : 24); y < page.height; y += 28) {
    if (page.paper === 'dots') {
      for (let x = 24; x < page.width; x += 28) {
        context.beginPath()
        context.arc(x, y, 1.15, 0, 2 * Math.PI)
        context.fill()
      }
    } else {
      context.beginPath()
      context.moveTo(startX, y)
      context.lineTo(page.width - startX, y)
      context.stroke()
    }
  }
  if (page.paper === 'grid') for (let x = 24; x < page.width; x += 28) {
    context.beginPath()
    context.moveTo(x, 0)
    context.lineTo(x, page.height)
    context.stroke()
  }
}

export function itemBounds(item) {
  if (item.points?.length) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const { x, y } of item.points) {
      minX = Math.min(minX, x); minY = Math.min(minY, y)
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
    const pad = (item.size || 1) / 2
    return { x: minX - pad, y: minY - pad, width: maxX - minX + pad * 2, height: maxY - minY + pad * 2 }
  }
  const lines = (item.value || '').split('\n')
  const longest = Math.max(...lines.map((line) => line.length), 1)
  return { x: item.x, y: item.y, width: item.width ?? (item.type === 'sticky' ? 310 : longest * item.size * .57), height: item.height ?? (item.type === 'sticky' ? 165 : lines.length * item.size * 1.27) }
}

export function paintObject(context, item, resources) {
  context.save()
  context.fillStyle = item.color || '#24342b'
  context.strokeStyle = context.fillStyle
  context.lineWidth = item.size
  context.lineCap = 'round'
  context.lineJoin = 'round'
  const points = item.points
  if (points?.length) {
    const first = points[0], last = points.at(-1)
    if (item.type === 'marker') {
      context.globalAlpha = .35
      context.globalCompositeOperation = 'multiply'
    }
    context.beginPath()
    if (item.type === 'rect') context.rect(first.x, first.y, last.x - first.x, last.y - first.y)
    else if (item.type === 'ellipse') {
      context.ellipse((first.x + last.x) / 2, (first.y + last.y) / 2, Math.max(.5, Math.abs(last.x - first.x) / 2), Math.max(.5, Math.abs(last.y - first.y) / 2), 0, 0, Math.PI * 2)
    } else if (points.length === 1) {
      context.arc(first.x, first.y, item.size / 2, 0, Math.PI * 2)
      context.fill()
      context.restore()
      return
    } else {
      context.moveTo(first.x, first.y)
      for (let i = 1; i < points.length; i++) context.lineTo(points[i].x, points[i].y)
    }
    context.stroke()
  } else if (item.type === 'image') {
    const image = resources.get(item.src)
    if (image) context.drawImage(image, item.x, item.y, item.width, item.height)
  } else if (item.type === 'text' || item.type === 'sticky') {
    const sticky = item.type === 'sticky'
    const bounds = itemBounds(item)
    if (sticky) {
      context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height)
      context.fillStyle = '#2c342b'
    }
    context.font = item.size + 'px "DM Sans Variable", Arial, sans-serif'
    context.textBaseline = 'top'
    let y = item.y + (sticky ? 18 : 0)
    const padding = sticky ? 18 : 0
    const limit = sticky ? bounds.width - padding * 2 : Infinity
    if (sticky) {
      context.beginPath()
      context.rect(bounds.x + 5, bounds.y + 4, bounds.width - 10, bounds.height - 8)
      context.clip()
    }
    for (const line of item.value.split('\n')) {
      for (const part of wrapLine(context, line, limit)) {
        context.fillText(part, item.x + padding, y)
        y += item.size * 1.27
      }
    }
  }
  context.restore()
}

export function wrapLine(context, line, limit) {
  if (!line || limit === Infinity) return [line]
  let current = ''
  const lines = []
  for (const word of line.split(' ')) {
    const combined = current ? current + ' ' + word : word
    if (context.measureText(combined).width <= limit) {
      current = combined
    } else {
      if (current) lines.push(current)
      current = ''
      for (const character of word) {
        if (current && context.measureText(current + character).width > limit) {
          lines.push(current)
          current = ''
        }
        current += character
      }
    }
  }
  return [...lines, current]
}

function segmentDistance(point, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const ratio = dx || dy ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(point.x - (a.x + dx * ratio), point.y - (a.y + dy * ratio))
}

export function hits(item, point, margin = 8) {
  const bounds = itemBounds(item)
  if (point.x < bounds.x - margin || point.y < bounds.y - margin || point.x > bounds.x + bounds.width + margin || point.y > bounds.y + bounds.height + margin) return false
  if (!item.points || item.type === 'rect' || item.type === 'ellipse') return true
  return item.points.some((end, index) => segmentDistance(point, item.points[index - 1] ?? end, end) <= margin + item.size / 2)
}

export function moveObject(item, x, y) {
  return item.points ? { ...item, points: item.points.map((point) => ({ x: point.x + x, y: point.y + y })) }
    : { ...item, x: item.x + x, y: item.y + y }
}

export const itemsInside = (items, outline) => {
  if (outline.length < 3) return []
  return items.filter((item) => {
    const bounds = itemBounds(item)
    const x = bounds.x + bounds.width / 2
    const y = bounds.y + bounds.height / 2
    let inside = false
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i], b = outline[j]
      if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) inside = !inside
    }
    return inside
  }).map((item) => item.id)
}
