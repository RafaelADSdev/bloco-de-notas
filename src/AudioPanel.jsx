import { useEffect, useRef, useState } from 'react'
import { CircleStop, Mic, Trash2 } from 'lucide-react'
import { dateLabel, fileData, uid } from './model'
import { Dialog, IconButton } from './ui'

export default function AudioPanel({ item, patch, close, notify, readOnly }) {
  const [recording, setRecording] = useState(false)
  const [starting, setStarting] = useState(false)
  const recorder = useRef(null)
  const active = useRef(true)
  const clips = useRef(item.audio ?? [])
  useEffect(() => () => {
    active.current = false
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current?.stream.getTracks().forEach((track) => track.stop())
  }, [])

  async function start() {
    setStarting(true)
    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!active.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      const media = new MediaRecorder(stream)
      const chunks = []
      media.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data) }
      media.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        if (!active.current) return
        try {
          if (chunks.length) {
            const src = await fileData(new Blob(chunks, { type: media.mimeType }))
            if (!active.current) return
            clips.current = [...clips.current, { id: uid(), created: Date.now(), src }]
            patch({ audio: clips.current })
            notify('Gravação salva.')
          }
        } catch {
          notify('Não foi possível salvar a gravação.', true)
        } finally { if (active.current) setRecording(false) }
      }
      media.start()
      recorder.current = media
      setRecording(true)
    } catch {
      stream?.getTracks().forEach((track) => track.stop())
      if (active.current) notify('O microfone está indisponível ou sem permissão de acesso.', true)
    } finally {
      if (active.current) setStarting(false)
    }
  }

  function stop() {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  return <Dialog title="Gravações de áudio" close={() => { if (!recording) close(); else notify('Encerre a gravação antes de fechar.') }}>
    {!item.audio?.length && <p className="dialog-copy">Nenhuma gravação neste documento.</p>}
    {item.audio?.map((clip, index) => <div key={clip.id} className="audio-clip">
      <div><strong>Gravação {index + 1}</strong><small>{dateLabel(clip.created)}</small></div>
      <audio controls src={clip.src} preload="metadata" />
      {!readOnly && <IconButton label={'Remover gravação ' + (index + 1)} onClick={() => {
        clips.current = clips.current.filter((entry) => entry.id !== clip.id)
        patch({ audio: clips.current })
      }}><Trash2 size={17} /></IconButton>}
    </div>)}
    <footer className="dialog-actions">
      <button className="button secondary" onClick={close} disabled={recording}>Fechar</button>
      {!readOnly && <button className={'button ' + (recording ? 'destructive' : 'primary')} disabled={starting} onClick={recording ? stop : start}>
        {recording ? <CircleStop size={17} /> : <Mic size={17} />}{recording ? 'Parar gravação' : starting ? 'Aguardando microfone…' : 'Gravar'}
      </button>}
    </footer>
  </Dialog>
}
