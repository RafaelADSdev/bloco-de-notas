import { useState } from 'react'
import { Dialog } from './ui'
import { canvasSizes, clamp } from './sketch-model'

export function DrawingNameForm({ title, initial = '', create, submit, close }) {
  const [name, setName] = useState(initial)
  const [format, setFormat] = useState(canvasSizes[0][0])
  return <Dialog title={title} close={close}>
    <form onSubmit={(event) => {
      event.preventDefault()
      submit(name.trim(), ...format.split('×').map(Number))
    }}>
      <label className="form-label">Nome<input data-autofocus value={name} onChange={(event) => setName(event.target.value)} maxLength={90} placeholder="Desenho sem título" required={!create} /></label>
      {create && <label className="form-label">Formato <select className="studio-dialog-select" value={format} onChange={(event) => setFormat(event.target.value)}>
        {canvasSizes.map(([size, label]) => <option key={size} value={size}>{label} · {size.replace('×', ' × ')} px</option>)}
      </select></label>}
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary">{create ? 'Criar desenho' : 'Salvar'}</button></div>
    </form>
  </Dialog>
}

export function DrawingTextForm({ operation, change, close }) {
  const [text, setText] = useState(operation.text ?? '')
  const [size, setSize] = useState(operation.size ?? 48)
  const [color, setColor] = useState(operation.color)
  const [font, setFont] = useState(operation.font ?? 'sans-serif')
  return <Dialog title={operation.text == null ? 'Inserir texto' : 'Editar texto'} close={close}>
    <form onSubmit={(event) => {
      event.preventDefault()
      if (text.trim()) change({ ...operation, kind: 'text', text: text.trimEnd(), size: clamp(Number(size), 8, 240), color, font })
    }}>
      <label className="form-label">Texto<textarea rows={3} data-autofocus value={text} onChange={(event) => setText(event.target.value)} maxLength={500} required /></label>
      <div className="studio-text-options">
        <label className="form-label">Fonte<select className="studio-dialog-select" value={font} onChange={(event) => setFont(event.target.value)}>
          <option value="sans-serif">Sem serifa</option><option value="serif">Serifada</option><option value="monospace">Monoespaçada</option>
        </select></label>
        <label className="form-label">Tamanho<input type="number" min="8" max="240" required value={size} onChange={(event) => setSize(event.target.value)} /></label>
        <label className="form-label">Cor<input className="studio-dialog-color" type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
      </div>
      <div className="dialog-actions"><button type="button" className="button secondary" onClick={close}>Cancelar</button><button className="button primary" disabled={!text.trim()}>Aplicar texto</button></div>
    </form>
  </Dialog>
}

export function DrawingHelp({ close }) {
  return <Dialog title="Atalhos e gestos" close={close}>
    <dl className="studio-shortcuts">
      <div><dt>Pincel / borracha</dt><dd><kbd>B</kbd> <kbd>E</kbd></dd></div>
      <div><dt>Balde / conta-gotas</dt><dd><kbd>G</kbd> <kbd>I</kbd></dd></div>
      <div><dt>Seleção / laço / texto</dt><dd><kbd>M</kbd> <kbd>L</kbd> <kbd>T</kbd></dd></div>
      <div><dt>Mover a tela</dt><dd><kbd>H</kbd> ou segure <kbd>Espaço</kbd></dd></div>
      <div><dt>Desfazer / refazer</dt><dd><kbd>Ctrl+Z</kbd> <kbd>Ctrl+Shift+Z</kbd></dd></div>
      <div><dt>Salvar desenho</dt><dd><kbd>Ctrl+S</kbd> ou <kbd>⌘+S</kbd></dd></div>
      <div><dt>Zoom</dt><dd>Roda do mouse ou pinça</dd></div>
      <div><dt>Girar e mover a tela ao toque</dt><dd>Use dois dedos</dd></div>
      <div><dt>Mover uma seleção</dt><dd>Arraste de dentro dela</dd></div>
      <div><dt>Copiar, cortar e colar</dt><dd><kbd>Ctrl+C</kbd> <kbd>Ctrl+X</kbd> <kbd>Ctrl+V</kbd></dd></div>
    </dl>
  </Dialog>
}
