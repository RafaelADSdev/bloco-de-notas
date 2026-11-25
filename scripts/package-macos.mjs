import { spawnSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packager } from '@electron/packager'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, '.native-build', 'macos')
const { version, productName, devDependencies } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const icon = join(root, 'desktop', 'icon.icns')

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} terminou com código ${result.status}.`)
}

await mkdir(output, { recursive: true })
const bundles = await packager({
  dir: join(root, '.native-build', 'desktop'),
  out: output,
  overwrite: true,
  platform: 'darwin',
  arch: ['arm64', 'x64'],
  name: productName,
  electronVersion: devDependencies.electron,
  electronZipDir: process.env.LINHA_CLARA_ELECTRON_ZIPS,
  appBundleId: 'com.rafaeladsdev.linhaclara',
  appVersion: version,
  asar: true,
  icon,
  extendInfo: join(root, 'desktop', 'Info.plist'),
})
if (bundles.length !== 2) throw new Error('O empacotador precisa gerar as duas arquiteturas macOS.')

for (const bundle of bundles) {
  const app = join(bundle, productName + '.app')
  const arch = bundle.endsWith('-arm64') ? 'arm64' : 'x86_64'
  if (process.platform === 'darwin') {
    run('codesign', ['--force', '--deep', '--sign', '-', app])
    run('codesign', ['--verify', '--deep', '--strict', app])
  } else {
    run(process.env.LINHA_CLARA_RCODESIGN || 'rcodesign', ['sign', app])
  }
  const dmg = join(output, `Linha-Clara-${version}-macos-${arch}.dmg`)
  run(process.env.LINHA_CLARA_ZAPP || 'zapp', [
    'dmg', '--no-config', '--no-sign', '--no-notarize', '--app', app,
    '--icon', icon, '--title', productName, '--out', dmg,
  ])
  if (process.platform === 'darwin') run('hdiutil', ['verify', dmg])
}
