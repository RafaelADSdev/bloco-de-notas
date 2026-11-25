import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, X } from 'lucide-react'
import { version as installedVersion } from '../package.json'
import { isAndroidApp } from './android-platform'
import { fetchUpdate, updatePackage } from './release-updates.mjs'
import { flushStorage } from './storage'
import { Dialog, IconButton } from './ui'

const installer = updatePackage(isAndroidApp, window.linhaClaraDesktop)
const windowsUpdates = window.linhaClaraDesktop?.updates
const dismissalKey = 'linha-clara:update-dismissed'
const checkInterval = 6 * 60 * 60 * 1000

export const supportsUpdates = Boolean(installer)

export function useAppUpdates() {
  const [status, setStatus] = useState('idle')
  const [release, setRelease] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissalKey) } catch { return null }
  })
  const lastCheck = useRef(0)
  const pending = useRef(null)

  const check = useCallback(async (manual = false) => {
    if (!installer || pending.current) return
    if (!manual && (document.hidden || !navigator.onLine || document.querySelector('.update-dialog[open]')
      || Date.now() - lastCheck.current < checkInterval)) return
    const request = new AbortController()
    pending.current = request
    lastCheck.current = Date.now()
    setStatus('checking')
    const timeout = setTimeout(() => request.abort(), 8000)
    try {
      const next = await fetchUpdate(installedVersion, installer, request.signal)
      if (pending.current !== request) return
      setRelease(next)
      setStatus(next ? 'available' : 'current')
    } catch {
      if (pending.current !== request) return
      setStatus('error')
    } finally {
      clearTimeout(timeout)
      if (pending.current === request) pending.current = null
    }
  }, [])

  useEffect(() => {
    if (!installer) return
    const checkWhenVisible = () => { void check() }
    checkWhenVisible()
    const interval = setInterval(checkWhenVisible, checkInterval)
    document.addEventListener('visibilitychange', checkWhenVisible)
    window.addEventListener('online', checkWhenVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', checkWhenVisible)
      window.removeEventListener('online', checkWhenVisible)
      const request = pending.current
      pending.current = null
      request?.abort()
    }
  }, [check])

  function dismiss() {
    if (!release) return
    setDismissed(release.version)
    try { localStorage.setItem(dismissalKey, release.version) } catch {}
  }

  return { release, status, check, dismiss, showNotice: status === 'available' && release.version !== dismissed }
}

export function UpdateNotice({ release, open, dismiss }) {
  return <section className="update-notice" aria-label="Atualização do Linha Clara">
    <div className="update-notice-copy">
      <ArrowDownToLine size={19} aria-hidden="true" />
      <span role="status"><strong>Atualização disponível</strong><small>Linha Clara {release.version}</small></span>
    </div>
    <div className="update-notice-actions">
      <button type="button" className="button secondary" onClick={open}>Ver atualização</button>
      <IconButton label="Dispensar aviso de atualização" onClick={dismiss}><X size={18} /></IconButton>
    </div>
  </section>
}

export function UpdateDialog({ release, status, check, dismiss, close, canInstall }) {
  const [installation, setInstallation] = useState('idle')
  const attempt = useRef(null)
  const available = status === 'available' && release
  const automatic = windowsUpdates && /^sha256:[a-f0-9]{64}$/i.test(release?.digest ?? '')
  const busy = ['downloading', 'canceling', 'installing'].includes(installation)
  const target = isAndroidApp ? undefined : '_blank'
  const information = {
    idle: 'Consultando as versões publicadas no GitHub…',
    checking: 'Consultando as versões publicadas no GitHub…',
    current: 'Você já tem a versão mais recente disponível para este dispositivo.',
    error: 'Não foi possível consultar o GitHub. Confira sua conexão e tente novamente.',
  }

  function later() {
    dismiss()
    close()
  }

  async function install() {
    if (!canInstall || attempt.current) return
    const request = { installing: false }
    attempt.current = request
    setInstallation('downloading')
    try {
      const downloaded = await windowsUpdates.download(release.version)
      if (attempt.current !== request) return
      if (!downloaded) throw new Error('Download failed')
      request.installing = true
      setInstallation('installing')
      await flushStorage()
      if (!await windowsUpdates.install()) throw new Error('Install failed')
    } catch {
      if (attempt.current !== request) return
      await windowsUpdates.cancel().catch(() => {})
      setInstallation('error')
    } finally {
      if (attempt.current === request) attempt.current = null
    }
  }

  async function cancelDownload() {
    if (!attempt.current || attempt.current.installing) return
    attempt.current = null
    setInstallation('canceling')
    await windowsUpdates.cancel().catch(() => {})
    setInstallation('idle')
  }

  const installMessages = {
    downloading: 'Baixando e verificando o instalador…',
    canceling: 'Cancelando o download…',
    installing: 'Instalando. O Linha Clara será reaberto em seguida.',
    error: 'Não foi possível instalar pelo app. Tente novamente ou use o instalador no navegador.',
  }

  return <Dialog title={available ? 'Atualização disponível' : 'Atualizações'} close={close} busy={busy} className="update-dialog">
    <p className="dialog-copy">Versão instalada {installedVersion}</p>
    {available ? <>
      <div className="update-release">
        <span className="update-release-icon"><ArrowDownToLine size={22} aria-hidden="true" /></span>
        <div><strong>Linha Clara {release.version}</strong><small>{release.preview ? 'Versão de prévia' : 'Versão publicada'}</small></div>
      </div>
      <p className="dialog-copy">{automatic
        ? 'O Linha Clara baixa a atualização e reabre após instalar.'
        : 'O download abre no navegador. Abra o arquivo baixado para instalar a atualização.'}</p>
      {installMessages[installation] && <p className="dialog-copy" role="status">{installMessages[installation]}</p>}
      {!busy && <a className="update-notes" href={release.notes} target={target} rel="noopener noreferrer">Ver notas da versão no GitHub</a>}
      <footer className="dialog-actions">
        {installation === 'downloading' && <button type="button" className="button secondary" onClick={cancelDownload}>Cancelar download</button>}
        {!busy && <>
          <button type="button" className="button secondary" onClick={later}>Agora não</button>
          {automatic && <button type="button" className="button primary" disabled={!canInstall} onClick={install}>
            <ArrowDownToLine size={17} aria-hidden="true" />Baixar e instalar
          </button>}
          {(!automatic || installation === 'error') && <a className={automatic ? 'button secondary' : 'button primary'} href={release.url}
            target={target} rel="noopener noreferrer"><ArrowDownToLine size={17} aria-hidden="true" />Baixar atualização</a>}
        </>}
      </footer>
    </> : <>
      <p className="dialog-copy" role="status">{information[status]}</p>
      <footer className="dialog-actions">
        <button type="button" className="button secondary" onClick={close}>Fechar</button>
        {status !== 'checking' && <button type="button" className="button primary" onClick={() => check(true)}>Verificar novamente</button>}
      </footer>
    </>}
  </Dialog>
}
