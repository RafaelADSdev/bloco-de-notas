import {
  ALargeSmall, Circle, Eraser, Hand, Highlighter, ImagePlus, LassoSelect, Minus, MousePointer2,
  PenLine, Redo2, Square, StickyNote, Undo2,
} from 'lucide-react'
import { IconButton } from './ui'

export const tools = [
  ['hand', 'Mover página', Hand], ['pen', 'Caneta', PenLine], ['marker', 'Marca-texto', Highlighter],
  ['eraser', 'Borracha', Eraser], ['lasso', 'Selecionar com laço', LassoSelect], ['text', 'Adicionar texto', ALargeSmall],
  ['sticky', 'Nota adesiva', StickyNote], ['image', 'Inserir imagem', ImagePlus], ['rect', 'Retângulo', Square],
  ['ellipse', 'Elipse', Circle], ['line', 'Linha', Minus], ['laser', 'Apontador laser', MousePointer2],
]

const palette = ['#28372d', '#397152', '#a05240', '#e7b853', '#456ca5']

export default function DrawingTools({ tool, change, color, setColor, size, setSize, undo, redo, canUndo, canRedo, readOnly }) {
  return <div className="editor-tools drawing-tools" aria-label="Ferramentas de anotação">
    <div className="tool-group">
      <IconButton label="Desfazer" onClick={undo} disabled={readOnly || !canUndo}><Undo2 size={19} /></IconButton>
      <IconButton label="Refazer" onClick={redo} disabled={readOnly || !canRedo}><Redo2 size={19} /></IconButton>
    </div>
    <div className="tool-group draw-main">
      {tools.map(([key, label, Icon]) => <IconButton key={key} label={label} aria-pressed={tool === key || (readOnly && key === 'hand')}
        disabled={readOnly && key !== 'hand'} onClick={() => change(key)}><Icon size={19} strokeWidth={1.8} /></IconButton>)}
    </div>
    <div className="tool-group style-tools">
      <div className="ink-options" aria-label="Cores da caneta" role="group">
        {palette.map((ink) => <button type="button" key={ink} style={{ '--ink-choice': ink }} className="ink-option"
          aria-label={'Cor ' + ink} aria-pressed={ink === color} disabled={readOnly} onClick={() => setColor(ink)} />)}
        <label className="ink-custom" title="Cor personalizada" style={{ '--ink-choice': color }}><span className="sr-only">Cor personalizada</span>
          <input type="color" aria-label="Cor personalizada" value={color} onChange={(event) => setColor(event.target.value)} disabled={readOnly} />
        </label>
      </div>
      <select aria-label="Espessura" value={size} onChange={(event) => setSize(Number(event.target.value))} disabled={readOnly} title="Espessura">
        <option value="2">Fina</option><option value="4">Média</option><option value="8">Grossa</option><option value="14">Larga</option><option value="24">Extra</option>
      </select>
    </div>
  </div>
}
