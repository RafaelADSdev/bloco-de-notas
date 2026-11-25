const { spawn } = require('node:child_process')
const { createHash } = require('node:crypto')
const { once } = require('node:events')
const { createWriteStream } = require('node:fs')
const { mkdir, rm } = require('node:fs/promises')
const path = require('node:path')
const { Readable, Transform } = require('node:stream')
const { pipeline } = require('node:stream/promises')

async function downloadVerifiedInstaller(update, file, signal, request = fetch) {
  if (!/^sha256:[a-f0-9]{64}$/i.test(update.digest) || !Number.isSafeInteger(update.size)
    || update.size < 1 || update.size > 1024 ** 3) throw new Error('Metadados do instalador inválidos.')

  const response = await request(update.url, { signal, credentials: 'omit' })
  if (!response.ok || !response.body) throw new Error('O GitHub não entregou o instalador.')
  const hash = createHash('sha256')
  let received = 0
  const verify = new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > update.size) return callback(new Error('Tamanho do instalador divergente.'))
      hash.update(chunk)
      callback(null, chunk)
    },
  })

  try {
    await pipeline(Readable.fromWeb(response.body), verify, createWriteStream(file, { flags: 'wx' }), { signal })
    if (received !== update.size || 'sha256:' + hash.digest('hex') !== update.digest.toLowerCase()) {
      throw new Error('O instalador não passou na verificação de integridade.')
    }
  } catch (error) {
    await rm(file, { force: true }).catch(() => {})
    throw error
  }
}

function registerWindowsUpdates(app, ipc, isLocal) {
  const directory = path.join(app.getPath('userData'), 'update-cache')
  const file = path.join(directory, 'update.exe')
  const cleanup = rm(file, { force: true }).catch(() => {})
  let pending = null

  function validSender(event) {
    return event.senderFrame && event.senderFrame === event.sender.mainFrame && isLocal(event.senderFrame.url)
  }

  async function release(job) {
    job.sender.removeListener('destroyed', job.abort)
    try { await rm(file, { force: true }) } finally {
      if (pending === job) pending = null
    }
  }

  ipc.handle('linha-clara:download-update', async (event, version) => {
    if (!validSender(event) || pending || typeof version !== 'string' || version.length > 29) return false
    const sender = event.sender
    const controller = new AbortController()
    const { promise: finished, resolve: finish } = Promise.withResolvers()
    const job = { sender, ready: false, installing: false, abort: () => controller.abort(), finished }
    pending = job
    sender.once('destroyed', job.abort)
    try {
      await cleanup
      const { fetchUpdate } = await import('../src/release-updates.mjs')
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12 * 60 * 1000)])
      const metadataSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)])
      const update = await fetchUpdate(app.getVersion(), 'windows-x64.exe', metadataSignal)
      if (!update || update.version !== version) throw new Error('A versão disponível mudou.')
      await mkdir(directory, { recursive: true })
      await rm(file, { force: true })
      await downloadVerifiedInstaller(update, file, signal)
      signal.throwIfAborted()
      job.ready = true
      return true
    } catch (error) {
      if (!controller.signal.aborted) console.error('Linha Clara update:', error)
      await release(job).catch(() => {})
      return false
    } finally {
      finish()
    }
  })

  ipc.handle('linha-clara:cancel-update', async (event) => {
    const job = pending
    if (!validSender(event) || job?.sender !== event.sender || job.installing) return false
    job.abort()
    if (job.ready) await release(job).catch(() => {})
    else await job.finished
    return true
  })

  ipc.handle('linha-clara:install-update', async (event) => {
    const job = pending
    if (!validSender(event) || job?.sender !== event.sender || !job.ready || job.installing) return false
    job.installing = true
    try {
      const installer = spawn(file, ['/S', '--updated', '--force-run'], {
        detached: true, stdio: 'ignore', cwd: directory,
      })
      await once(installer, 'spawn')
      installer.unref()
      app.quit()
      return true
    } catch (error) {
      console.error('Linha Clara update:', error)
      await release(job).catch(() => {})
      return false
    }
  })
}

module.exports = { downloadVerifiedInstaller, registerWindowsUpdates }
