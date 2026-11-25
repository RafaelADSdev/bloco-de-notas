const degrees = Math.PI / 180

function bounded(value, fallback, min, max) {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback
}

function anchor(frame, x, y) {
  return {
    x: frame.x + frame.width * bounded(x, 50, 0, 100) / 100,
    y: frame.y + frame.height * bounded(y, 50, 0, 100) / 100,
  }
}

export function guideGeometry(settings, frame) {
  const origin = anchor(frame, settings.guideX, settings.guideY)
  const { width, height } = frame
  const span = Math.hypot(width, height) * 2
  const angle = bounded(settings.guideAngle, 0, -180, 180)
  const radiusX = width * bounded(settings.ellipseWidth, 65, 5, 100) / 200
  const radiusY = height * bounded(settings.ellipseHeight, 40, 5, 100) / 200
  const vanishing = []
  if (settings.guide === 'perspective') vanishing.push(origin)
  if (settings.guide === 'perspective2' || settings.guide === 'perspective3') {
    vanishing.push({ x: origin.x - width * .7, y: origin.y }, { x: origin.x + width * .7, y: origin.y })
  }
  if (settings.guide === 'perspective3') vanishing.push({ x: origin.x, y: origin.y - height * .9 })
  return { origin, span, angle, radiusX, radiusY, vanishing }
}

export function symmetryGeometry(settings, frame) {
  return {
    origin: anchor(frame, settings.symmetryX, settings.symmetryY),
    angle: bounded(settings.symmetryAngle, 0, -180, 180),
    count: Math.round(bounded(settings.symmetryCount, 6, 2, 16)),
  }
}

export function isDrawingGuide(guide) {
  return guide === 'ruler' || guide === 'ellipse' || guide === 'perspective' || guide === 'perspective2' || guide === 'perspective3'
}

function project(point, first, dx, dy) {
  const length = dx * dx + dy * dy
  if (length < .0001) return { ...point, y: first.y }
  const ratio = ((point.x - first.x) * dx + (point.y - first.y) * dy) / length
  return { ...point, x: first.x + ratio * dx, y: first.y + ratio * dy }
}

function projectEllipse(point, { origin, angle, radiusX, radiusY }) {
  const cos = Math.cos(angle * degrees), sin = Math.sin(angle * degrees)
  const dx = point.x - origin.x, dy = point.y - origin.y
  const x = (dx * cos + dy * sin) / radiusX
  const y = (-dx * sin + dy * cos) / radiusY
  const theta = Math.atan2(y, x)
  const ex = Math.cos(theta) * radiusX, ey = Math.sin(theta) * radiusY
  return { ...point, x: origin.x + ex * cos - ey * sin, y: origin.y + ex * sin + ey * cos }
}

export function constrainedPoint(point, first, settings, frame) {
  if (!isDrawingGuide(settings.guide)) return point
  const geometry = guideGeometry(settings, frame)
  if (settings.guide === 'ellipse') return projectEllipse(point, geometry)
  if (settings.guide === 'ruler') {
    return project(point, first, Math.cos(geometry.angle * degrees), Math.sin(geometry.angle * degrees))
  }

  const directions = geometry.vanishing.map((target) => [target.x - first.x, target.y - first.y])
  if (settings.guide === 'perspective2') directions.push([0, 1])
  let best, distance = Infinity
  for (const [dx, dy] of directions) {
    const candidate = project(point, first, dx, dy)
    const nextDistance = (candidate.x - point.x) ** 2 + (candidate.y - point.y) ** 2
    if (nextDistance < distance) {
      best = candidate
      distance = nextDistance
    }
  }
  return best
}

export function guideLine(origin, angle, span, fromCenter = false) {
  const dx = span * Math.cos(angle * degrees), dy = span * Math.sin(angle * degrees)
  return {
    x1: fromCenter ? origin.x : origin.x - dx,
    y1: fromCenter ? origin.y : origin.y - dy,
    x2: origin.x + dx,
    y2: origin.y + dy,
  }
}

export function perspectiveLines(geometry, frame, density = 11) {
  const samples = Math.round(bounded(density, 11, 4, 24))
  const centerX = frame.x + frame.width / 2
  const farRight = frame.x + frame.width
  const bottom = frame.y + frame.height
  return geometry.vanishing.flatMap((origin, index) => Array.from({ length: samples }, (_, step) => {
    const ratio = step / (samples - 1)
    const side = geometry.vanishing.length > 1 && index < 2
    const targetX = side ? (origin.x < centerX ? farRight : frame.x) : frame.x + ratio * frame.width
    const targetY = side ? frame.y + ratio * frame.height : bottom
    const angle = Math.atan2(targetY - origin.y, targetX - origin.x) / degrees
    return guideLine(origin, angle, geometry.span)
  }))
}
