import { useId } from 'react'
import { guideGeometry, guideLine, perspectiveLines, symmetryGeometry } from './sketch-guides'

export function SketchGuides({ frame, guide, symmetry, selection, settings = {} }) {
  const gridId = useId()
  if (guide === 'none' && symmetry === 'none' && !selection?.length) return null
  const { x, y, width, height } = frame
  const geometry = guideGeometry({ ...settings, guide }, frame)
  const axis = symmetryGeometry(settings, frame)
  const opacity = settings.guideOpacity == null ? 1 : settings.guideOpacity / 65
  const points = selection?.map((point) => [point.x, point.y].join(',')).join(' ')
  const vertical = symmetry === 'vertical' || symmetry === 'both'
  const horizontal = symmetry === 'horizontal' || symmetry === 'both'
  return <svg className="studio-guides" viewBox={`${x} ${y} ${width} ${height}`} aria-hidden="true">
    {guide === 'grid' && <>
      <defs>
        <pattern id={gridId} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
        </pattern>
      </defs>
      <rect x={x} y={y} width={width} height={height} fill={`url(#${gridId})`} />
    </>}
    {guide === 'ruler' && <line {...guideLine(geometry.origin, geometry.angle, geometry.span)} className="studio-guide-line" opacity={Math.min(1, opacity)} />}
    {guide === 'ellipse' && <ellipse cx={geometry.origin.x} cy={geometry.origin.y} rx={geometry.radiusX} ry={geometry.radiusY}
      transform={`rotate(${geometry.angle} ${geometry.origin.x} ${geometry.origin.y})`} className="studio-guide-line" opacity={Math.min(1, opacity)} />}
    {geometry.vanishing.length > 0 && <g className="studio-perspective" style={{ opacity: Math.min(1, opacity * .5) }}>
      {perspectiveLines(geometry, frame, settings.guideDensity).map(({ x1, y1, x2, y2 }, i) => <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} />)}
      <path d={`M${x} ${geometry.origin.y}H${x + width}`} />
      {geometry.vanishing.map((point, i) => <circle key={i} cx={point.x} cy={point.y} r="6" />)}
    </g>}
    {vertical && <line {...guideLine(axis.origin, 90, geometry.span)} className="studio-axis" />}
    {horizontal && <line {...guideLine(axis.origin, 0, geometry.span)} className="studio-axis" />}
    {symmetry === 'free' && <line {...guideLine(axis.origin, axis.angle, geometry.span)} className="studio-axis" />}
    {symmetry === 'radial' && Array.from({ length: axis.count }, (_, i) =>
      <line key={i} {...guideLine(axis.origin, axis.angle + i * 360 / axis.count, geometry.span, true)} className="studio-axis" />)}
    {points && <g><polygon points={points} className="studio-selection-halo" /><polygon points={points} className="studio-selection-line" /></g>}
  </svg>
}
