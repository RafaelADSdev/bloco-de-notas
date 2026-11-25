import { bounds, clamp, rectangle, transformPoints } from './sketch-model'

export function hasLayerColor(adjustments) {
  if (!adjustments) return false
  const { hue = 0, saturation, lightness, red, green, blue } = adjustments
  return Boolean(hue % 360 || saturation || lightness || red || green || blue)
}

const unit = (value) => Math.max(0, Math.min(1, value))
const moveChannel = (channel, change) => channel + change * (change < 0 ? channel : 1 - channel)

export function adjustLayerImage(image, adjustments) {
  const {
    hue = 0, saturation = 0, lightness = 0,
    red = 0, green = 0, blue = 0,
  } = adjustments
  const hueShift = ((hue % 360) + 360) % 360 / 60
  const saturationScale = 1 + saturation / 100
  const lightnessShift = lightness / 100
  const redShift = red / 100, greenShift = green / 100, blueShift = blue / 100
  const changeHsl = hueShift || saturation || lightness
  const pixels = image.data

  for (let i = 0; i < pixels.length; i += 4) {
    if (!pixels[i + 3]) continue
    let r = pixels[i] / 255, g = pixels[i + 1] / 255, b = pixels[i + 2] / 255
    if (changeHsl) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const delta = max - min
      const oldLight = (max + min) / 2
      const light = moveChannel(oldLight, lightnessShift)
      if (delta && saturationScale) {
        let sector
        if (max === r) sector = (g - b) / delta
        else if (max === g) sector = 2 + (b - r) / delta
        else sector = 4 + (r - g) / delta
        sector = (sector + hueShift + 6) % 6

        const oldSat = delta / (1 - Math.abs(2 * oldLight - 1))
        const chroma = (1 - Math.abs(2 * light - 1)) * unit(oldSat * saturationScale)
        const minor = chroma * (1 - Math.abs(sector % 2 - 1))
        const back = light - chroma / 2
        switch (Math.floor(sector)) {
          case 0: r = chroma; g = minor; b = 0; break
          case 1: r = minor; g = chroma; b = 0; break
          case 2: r = 0; g = chroma; b = minor; break
          case 3: r = 0; g = minor; b = chroma; break
          case 4: r = minor; g = 0; b = chroma; break
          default: r = chroma; g = 0; b = minor; break
        }
        r += back
        g += back
        b += back
      } else {
        r = g = b = light
      }
    }
    pixels[i] = moveChannel(r, redShift) * 255
    pixels[i + 1] = moveChannel(g, greenShift) * 255
    pixels[i + 2] = moveChannel(b, blueShift) * 255
  }
  return image
}
function operationBounds(operation) {
  const { kind, points, clip, transform, matrices, size } = operation
  if (kind === 'gradient' || kind === 'fill') return clip?.length ? bounds(clip) : null
  if (kind === 'image') {
    const { x, y, w, h } = operation
    return { left: x, top: y, right: x + w, bottom: y + h }
  }
  if (!points?.length) return null
  if (kind === 'region') {
    if (!transform) return bounds(points)
    const { left, top, right, bottom } = bounds(points)
    // The captured layer rectangle can exceed the selection by one pixel before scaling.
    const corners = rectangle({ x: left - 1, y: top - 1 }, { x: right + 1, y: bottom + 1 })
    return bounds([...corners, ...transformPoints(corners, transform)])
  }
  const box = bounds(points)
  const pad = size ?? 0
  const corners = rectangle({ x: box.left - pad, y: box.top - pad }, { x: box.right + pad, y: box.bottom + pad })
  if (!matrices?.length) return bounds(corners)
  return bounds(matrices.flatMap(([a, b, c, d, e, f]) =>
    corners.map(({ x, y }) => ({ x: a * x + c * y + e, y: b * x + d * y + f })),
  ))
}

export function layerColorArea(operations, width, height) {
  let left = width, top = height, right = 0, bottom = 0
  for (const operation of operations) {
    const box = operationBounds(operation)
    if (!box) return { x: 0, y: 0, width, height }
    left = Math.min(left, box.left)
    top = Math.min(top, box.top)
    right = Math.max(right, box.right)
    bottom = Math.max(bottom, box.bottom)
  }
  // Include antialiasing and resampling at the edges of a stroke or selection.
  const x = clamp(Math.floor(left) - 2, 0, width), y = clamp(Math.floor(top) - 2, 0, height)
  return {
    x, y,
    width: Math.max(0, clamp(Math.ceil(right) + 2, 0, width) - x),
    height: Math.max(0, clamp(Math.ceil(bottom) + 2, 0, height) - y),
  }
}
