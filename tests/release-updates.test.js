import { deepEqual, equal, throws } from 'node:assert/strict'
import { test } from 'node:test'
import { availableUpdate, updatePackage } from '../src/release-updates.mjs'

const releasesPage = 'https://github.com/RafaelADSdev/bloco-de-notas/releases'

function release(version, installer = 'android.apk', options = {}) {
  const tag = options.prerelease === false ? 'v' + version : 'v' + version + '-multiplataforma'
  const name = 'Linha-Clara-' + version + '-' + installer
  return {
    tag_name: tag,
    draft: false,
    published_at: '2026-11-25T00:00:00Z',
    prerelease: true,
    assets: [{ name, browser_download_url: releasesPage + '/download/' + tag + '/' + name, state: 'uploaded', size: 100 }],
    ...options,
  }
}

test('matches the native platform and architecture', () => {
  equal(updatePackage(true), 'android.apk')
  equal(updatePackage(false, { platform: 'win32', arch: 'x64' }), 'windows-x64.exe')
  equal(updatePackage(false, { platform: 'darwin', arch: 'arm64' }), 'macos-arm64.dmg')
  equal(updatePackage(false, { platform: 'darwin', arch: 'x64' }), 'macos-x86_64.dmg')
  equal(updatePackage(false, { platform: 'linux', arch: 'x64' }), null)
  equal(updatePackage(false), null)
})

test('chooses the highest compatible version by numeric order', () => {
  const update = availableUpdate([release('1.11.1', 'macos-arm64.dmg'), release('1.10.0'), release('1.9.9')], '1.8.0', 'android.apk')
  deepEqual(update, {
    version: '1.10.0',
    url: releasesPage + '/download/v1.10.0-multiplataforma/Linha-Clara-1.10.0-android.apk',
    notes: releasesPage + '/tag/v1.10.0-multiplataforma',
    preview: true,
    digest: null,
    size: 100,
  })
})

test('prefers a stable release at the same version', () => {
  const update = availableUpdate([release('1.9.0'), release('1.9.0', 'android.apk', { prerelease: false })], '1.8.0', 'android.apk')
  equal(update.notes, releasesPage + '/tag/v1.9.0')
  equal(update.preview, false)
})

test('skips installed and older versions, drafts and unrecognized tags', () => {
  equal(availableUpdate([
    release('1.7.0'),
    release('1.8.0'),
    release('1.9.0', 'android.apk', { draft: true }),
    release('1.10.0', 'android.apk', { tag_name: 'ci-build' }),
  ], '1.8.0', 'android.apk'), null)
})

test('requires an uploaded asset at the canonical GitHub URL', () => {
  const wrongLink = release('1.9.0')
  wrongLink.assets[0].browser_download_url = 'https://example.com/update.apk'
  const unfinished = release('1.10.0')
  unfinished.assets[0].state = 'new'
  equal(availableUpdate([wrongLink, unfinished], '1.8.0', 'android.apk'), null)
  throws(() => availableUpdate({ message: 'rate limited' }, '1.8.0', 'android.apk'))
})
