import { bounds, clamp } from './sketch-model'

export function bitmap(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function rgba(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [n >> 16, (n >> 8) & 255, n & 255]
}

export function flood(ctx, { point, color, opacity, tolerance, clip, lockAlpha }) {
  if (!opacity) return
  const { width, height } = ctx.canvas
  let mask
  if (clip) {
    const selection = bitmap(width, height).getContext('2d', { willReadFrequently: true })
    polygon(selection, clip)
    selection.fill()
    mask = selection.getImageData(0, 0, width, height).data
  }
  const frame = ctx.getImageData(0, 0, width, height)
  const pixels = frame.data
  const first = clamp(Math.floor(point.y), 0, height - 1) * width + clamp(Math.floor(point.x), 0, width - 1)
  const [r, g, b, a] = pixels.subarray(first * 4, first * 4 + 4)
  if (lockAlpha && !a) return
  const [red, green, blue] = rgba(color)
  if (a === 255 && r === red && g === green && b === blue) return
  const threshold = tolerance * 2.55
  const visited = new Uint8Array(width * height)
  const queue = new Uint32Array(visited.length)
  let head = 0, tail = 0

  function enqueue(position) {
    if (visited[position] || (mask && !mask[position * 4 + 3])) return
    visited[position] = 1
    const i = position * 4, alpha = pixels[i + 3]
    if (lockAlpha && !alpha) return
    const delta = Math.max(Math.abs(pixels[i] - r), Math.abs(pixels[i + 1] - g), Math.abs(pixels[i + 2] - b))
    if (Math.abs(alpha - a) > threshold || delta * Math.min(alpha, a) / 255 > threshold) return
    queue[tail++] = position
  }

  enqueue(first)
  while (head < tail) {
    const position = queue[head++], x = position % width, i = position * 4
    const oldAlpha = pixels[i + 3] / 255
    const keep = lockAlpha ? 1 - opacity : (1 - opacity) * oldAlpha
    const alpha = opacity + keep
    pixels[i] = (red * opacity + pixels[i] * keep) / alpha
    pixels[i + 1] = (green * opacity + pixels[i + 1] * keep) / alpha
    pixels[i + 2] = (blue * opacity + pixels[i + 2] * keep) / alpha
    if (!lockAlpha) pixels[i + 3] = alpha * 255
    if (x > 0) enqueue(position - 1)
    if (x < width - 1) enqueue(position + 1)
    if (position >= width) enqueue(position - width)
    if (position < visited.length - width) enqueue(position + width)
  }
  if (tail) ctx.putImageData(frame, 0, 0)
}

export function polygon(ctx, points) {
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.closePath()
}

export function captureRegion(source, points) {
  const box = bounds(points)
  const x = Math.max(0, Math.floor(box.left))
  const y = Math.max(0, Math.floor(box.top))
  const width = Math.min(source.width, Math.ceil(box.right)) - x
  const height = Math.min(source.height, Math.ceil(box.bottom)) - y
  if (width <= 0 || height <= 0) return null
  const image = bitmap(width, height)
  const ctx = image.getContext('2d')
  ctx.translate(-x, -y)
  polygon(ctx, points)
  ctx.clip()
  ctx.drawImage(source, 0, 0)
  return { image, x, y }
}

export function transformRegion(ctx, operation, captured = captureRegion(ctx.canvas, operation.points)) {
  const { points, transform } = operation
  ctx.save()
  polygon(ctx, points)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  ctx.fill()
  ctx.restore()
  if (!transform || !captured) return
  const { x = 0, y = 0, angle = 0, scaleX = 1, scaleY = 1 } = transform
  const center = bounds(points)
  ctx.save()
  ctx.translate(center.x + x, center.y + y)
  ctx.rotate(angle)
  ctx.scale(scaleX, scaleY)
  ctx.drawImage(captured.image, captured.x - center.x, captured.y - center.y)
  ctx.restore()
}

export function encode(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Não foi possível ler a imagem.')), type, quality)
  })
}

export async function imageLayer(file, width, height) {
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, width / image.width, height / image.height)
    const w = Math.max(1, Math.round(image.width * scale))
    const h = Math.max(1, Math.round(image.height * scale))
    const canvas = bitmap(w, h)
    canvas.getContext('2d').drawImage(image, 0, 0, w, h)
    return { kind: 'image', blob: await encode(canvas), x: (width - w) / 2, y: (height - h) / 2, w, h }
  } finally {
    image.close()
  }
}
