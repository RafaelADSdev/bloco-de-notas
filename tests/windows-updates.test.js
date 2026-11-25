import { equal, rejects } from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, rmdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { downloadVerifiedInstaller } from '../desktop/windows-updates.cjs'

const contents = 'Linha Clara installer fixture'
const artifact = {
  url: 'https://github.com/RafaelADSdev/bloco-de-notas/releases/download/v1.0.7/Linha-Clara-1.0.7-windows-x64.exe',
  size: Buffer.byteLength(contents),
  digest: 'sha256:' + createHash('sha256').update(contents).digest('hex'),
}

async function destination(ctx) {
  const directory = await mkdtemp(join(tmpdir(), 'linha-clara-update-test-'))
  const file = join(directory, 'fixture.exe')
  ctx.after(async () => {
    await rm(file, { force: true })
    await rmdir(directory)
  })
  return file
}

test('streams a verified installer to disk', async (ctx) => {
  const file = await destination(ctx)
  await downloadVerifiedInstaller(artifact, file, undefined, async (url) => {
    equal(url, artifact.url)
    return new Response(contents)
  })
  equal(await readFile(file, 'utf8'), contents)
})

test('discards a download with mismatched content', async (ctx) => {
  const file = await destination(ctx)
  await rejects(downloadVerifiedInstaller(artifact, file, undefined, async () => new Response('x'.repeat(artifact.size))), /integridade/)
  await rejects(readFile(file), { code: 'ENOENT' })
})

test('discards a download larger than the official asset', async (ctx) => {
  const file = await destination(ctx)
  await rejects(downloadVerifiedInstaller(artifact, file, undefined, async () => new Response(contents + '!')), /Tamanho/)
  await rejects(readFile(file), { code: 'ENOENT' })
})

test('requires a SHA-256 digest before making a request', async (ctx) => {
  const file = await destination(ctx)
  let requested = false
  await rejects(downloadVerifiedInstaller({ ...artifact, digest: null }, file, undefined, async () => {
    requested = true
    return new Response(contents)
  }), /Metadados/)
  equal(requested, false)
})

test('cleans up an interrupted download', async (ctx) => {
  const file = await destination(ctx)
  const controller = new AbortController()
  const request = async () => new Response(new ReadableStream({
    start(stream) {
      stream.enqueue(new TextEncoder().encode(contents.slice(0, 4)))
      setImmediate(() => controller.abort())
    },
  }))
  await rejects(downloadVerifiedInstaller(artifact, file, controller.signal, request), { name: 'AbortError' })
  await rejects(readFile(file), { code: 'ENOENT' })
})
