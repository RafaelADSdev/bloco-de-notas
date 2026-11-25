import { useEffect, useRef, useState } from 'react'
import { Bold, ImagePlus, Italic, Link, List, ListOrdered, Quote, Redo2, Table, Underline, Undo2 } from 'lucide-react'
import { cleanHtml, fileData, isLocalImage } from './model'
import { Dialog, IconButton } from './ui'

export default function RichEditor({ item, patch, readOnly, notify }) {
  const editable = useRef(null)
  const imageInput = useRef(null)
  const selection = useRef(null)
  const [link, setLink] = useState(false)

  useEffect(() => {
    editable.current.innerHTML = cleanHtml(item.html)
  }, [])

  function apply(command, value) {
    editable.current.focus({ preventScroll: true })
    if (selection.current) {
      const current = window.getSelection()
      current.removeAllRanges()
      current.addRange(selection.current)
      selection.current = null
    }
    document.execCommand(command, false, value)
    save()
  }

  function save() {
    patch({ html: cleanHtml(editable.current.innerHTML) })
  }

  function remember() {
    const current = window.getSelection()
    if (current?.rangeCount && editable.current.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange()
  }

  async function addImage(event) {
    const file = event.target.files[0]
    event.target.value = ''
    if (!file) return
    try {
      const source = await fileData(file)
      if (!isLocalImage(source)) throw new Error()
      const image = document.createElement('img')
      image.src = source
      image.alt = file.name
      apply('insertHTML', image.outerHTML + '<p><br></p>')
    } catch {
      notify('Escolha uma imagem PNG, JPEG, GIF, WebP ou AVIF válida.', true)
    }
  }

  const controls = [
    ['Desfazer', Undo2, 'undo'], ['Refazer', Redo2, 'redo'], ['Negrito', Bold, 'bold'], ['Itálico', Italic, 'italic'],
    ['Sublinhado', Underline, 'underline'], ['Lista com marcadores', List, 'insertUnorderedList'], ['Lista numerada', ListOrdered, 'insertOrderedList'],
    ['Citação', Quote, 'formatBlock', 'blockquote'],
  ]
  return <>
    <div className="editor-tools text-tools" aria-label="Ferramentas de texto">
      {controls.map(([label, Icon, command, value]) => <IconButton key={label} label={label} disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()} onClick={() => apply(command, value)}><Icon size={18} /></IconButton>)}
      <select aria-label="Estilo do texto" disabled={readOnly} value="" onPointerDown={remember} onChange={(event) => apply('formatBlock', event.target.value)}>
        <option value="" disabled>Estilo de texto</option>
        <option value="p">Parágrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="pre">Código</option>
      </select>
      <IconButton label="Inserir link" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => { remember(); setLink(true) }}><Link size={17} /></IconButton>
      <IconButton label="Inserir imagem" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => { remember(); imageInput.current.click() }}><ImagePlus size={18} /></IconButton>
      <IconButton label="Inserir tabela" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => apply('insertHTML', '<table><tbody><tr><th>Coluna 1</th><th>Coluna 2</th></tr><tr><td> </td><td> </td></tr></tbody></table><p><br></p>')}><Table size={18} /></IconButton>
      <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,image/avif" onChange={addImage} />
    </div>
    <div className="text-workspace">
      <article className="text-paper">
        <div className="prose" role="textbox" aria-label="Conteúdo do documento" aria-multiline="true" aria-readonly={readOnly} ref={editable}
          contentEditable={!readOnly} suppressContentEditableWarning data-placeholder="Comece a escrever…" onInput={save}
          onClick={(event) => { if (!readOnly && event.target.closest('a')) event.preventDefault() }}
          onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onPaste={(event) => {
            event.preventDefault()
            apply('insertText', event.clipboardData.getData('text/plain'))
          }} />
      </article>
    </div>
    {link && <Dialog title="Inserir link" close={() => { selection.current = null; setLink(false) }}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const url = new FormData(event.currentTarget).get('address').trim()
        if (!/^(https?:\/\/|mailto:)/i.test(url)) { notify('Use um endereço que comece com https://, http:// ou mailto:.', true); return }
        if (selection.current?.collapsed ?? true) {
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.textContent = url
          apply('insertHTML', anchor.outerHTML)
        } else apply('createLink', url)
        setLink(false)
      }}>
        <label className="form-label">Endereço<input name="address" placeholder="https://exemplo.com" data-autofocus required /></label>
        <footer className="dialog-actions"><button className="button primary">Inserir</button></footer>
      </form>
    </Dialog>}
  </>
}
