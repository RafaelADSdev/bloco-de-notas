import { useEffect, useRef, useState } from 'react'
import { Bold, ImagePlus, Italic, Link, List, ListOrdered, MoreHorizontal, Quote, Redo2, Table, Underline, Undo2 } from 'lucide-react'
import { cleanHtml, fileData, isLocalImage } from './model'
import { Dialog, IconButton } from './ui'
import { isAndroidApp } from './android-platform'

export default function RichEditor({ item, patch, readOnly, notify }) {
  const editable = useRef(null)
  const imageInput = useRef(null)
  const selection = useRef(null)
  const [link, setLink] = useState(false)
  const [more, setMore] = useState(false)

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
  function commandButton([label, Icon, command, value], inSheet = false) {
    return <IconButton key={label} label={label} disabled={readOnly}
      onMouseDown={(event) => event.preventDefault()} onClick={() => inSheet ? applyExtra(command, value) : apply(command, value)}><Icon size={19} /></IconButton>
  }
  function runExtra(action) {
    if (isAndroidApp) setMore(false)
    action()
  }
  function applyExtra(command, value) {
    if (!isAndroidApp) return apply(command, value)
    setMore(false)
    requestAnimationFrame(() => apply(command, value))
  }
  const extras = <>
      <select aria-label="Estilo do texto" disabled={readOnly} value="" onPointerDown={remember} onChange={(event) => applyExtra('formatBlock', event.target.value)}>
        <option value="" disabled>Estilo de texto</option>
        <option value="p">Parágrafo</option><option value="h2">Título</option><option value="h3">Subtítulo</option><option value="pre">Código</option>
      </select>
      <IconButton label="Inserir link" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => { remember(); runExtra(() => setLink(true)) }}><Link size={17} /></IconButton>
      <IconButton label="Inserir imagem" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => { remember(); runExtra(() => imageInput.current.click()) }}><ImagePlus size={18} /></IconButton>
      <IconButton label="Inserir tabela" disabled={readOnly} onMouseDown={(event) => event.preventDefault()} onClick={() => applyExtra('insertHTML', '<table><tbody><tr><th>Coluna 1</th><th>Coluna 2</th></tr><tr><td> </td><td> </td></tr></tbody></table><p><br></p>')}><Table size={18} /></IconButton>
  </>
  return <>
    <input ref={imageInput} type="file" hidden accept="image/png,image/jpeg,image/gif,image/webp,image/avif" onChange={addImage} />
    <div className={'editor-tools text-tools' + (isAndroidApp ? ' android-editor-dock' : '')} aria-label="Ferramentas de texto">
      {(isAndroidApp ? controls.slice(0, 5) : controls).map((control) => commandButton(control))}
      {isAndroidApp ? <IconButton label="Mais ferramentas de texto" aria-haspopup="dialog" disabled={readOnly}
        onMouseDown={(event) => event.preventDefault()} onClick={() => { remember(); setMore(true) }}><MoreHorizontal size={22} /></IconButton> : extras}
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
    {more && <Dialog title="Ferramentas de texto" close={() => { setMore(false); selection.current = null }}>
      <div className="android-text-extra">{controls.slice(5).map((control) => commandButton(control, true))}{extras}</div>
    </Dialog>}
    {link && <Dialog title="Inserir link" close={() => { selection.current = null; setLink(false) }}>
      <form onSubmit={(event) => {
        event.preventDefault()
        const url = new FormData(event.currentTarget).get('address').trim()
        if (!/^(https?:\/\/|mailto:)/i.test(url)) { notify('Use um endereço que comece com https://, http:// ou mailto:.', true); return }
        const insertLink = () => {
          if (!(selection.current?.collapsed ?? true)) return apply('createLink', url)
          const anchor = document.createElement('a')
          anchor.href = url
          anchor.textContent = url
          apply('insertHTML', anchor.outerHTML)
        }
        setLink(false)
        requestAnimationFrame(insertLink)
      }}>
        <label className="form-label">Endereço<input name="address" placeholder="https://exemplo.com" data-autofocus required /></label>
        <footer className="dialog-actions"><button className="button primary">Inserir</button></footer>
      </form>
    </Dialog>}
  </>
}
