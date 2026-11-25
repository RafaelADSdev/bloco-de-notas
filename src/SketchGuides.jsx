export function SketchGuides({ frame, guide, symmetry, selection }) {
  if (guide === 'none' && symmetry === 'none' && !selection?.length) return null
  const { x: left, y: top, width, height } = frame
  const right = left + width, bottom = top + height
  const x = left + width / 2, y = top + height / 2
  const points = selection?.map((p) => [p.x, p.y].join(',')).join(' ')
  return <svg className="studio-guides" viewBox={`${left} ${top} ${width} ${height}`} aria-hidden="true">
    <defs>
      <pattern id="studio-guide-grid" width="60" height="60" patternUnits="userSpaceOnUse">
        <path d="M60 0H0V60" fill="none" stroke="currentColor" strokeWidth="1" opacity=".45" />
      </pattern>
    </defs>
    {guide === 'grid' && <rect x={left} y={top} width={width} height={height} fill="url(#studio-guide-grid)" />}
    {guide === 'ruler' && <line x1={left} y1={y} x2={right} y2={y} className="studio-guide-line" />}
    {guide === 'perspective' && <g className="studio-perspective">
      {Array.from({ length: 13 }, (_, i) => {
        const end = (i - 6) * width / 3
        return <path key={i} d={`M${x + end} ${top}L${x} ${y}L${x - end} ${bottom}`} />
      })}
      <path d={`M${left} ${y}H${right}`} /><circle cx={x} cy={y} r="6" />
    </g>}
    {(symmetry === 'vertical' || symmetry === 'both') && <line x1={x} y1={top} x2={x} y2={bottom} className="studio-axis" />}
    {(symmetry === 'horizontal' || symmetry === 'both') && <line x1={left} y1={y} x2={right} y2={y} className="studio-axis" />}
    {symmetry === 'radial' && [0, 60, 120].map((angle) => <line key={angle} x1={x - Math.hypot(width, height)} y1={y} x2={x + Math.hypot(width, height)} y2={y}
      transform={`rotate(${angle} ${x} ${y})`} className="studio-axis" />)}
    {points && <g><polygon points={points} className="studio-selection-halo" /><polygon points={points} className="studio-selection-line" /></g>}
  </svg>
}
