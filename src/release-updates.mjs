const repository = 'RafaelADSdev/bloco-de-notas'
const releasesPage = 'https://github.com/' + repository + '/releases'
const releasesApi = 'https://api.github.com/repos/' + repository + '/releases?per_page=30'
const versionPattern = '(0|[1-9][0-9]{0,8})'
const tagPattern = new RegExp('^v(' + [versionPattern, versionPattern, versionPattern].join('\\.') + ')(?:-multiplataforma)?$')

export function updatePackage(android, desktop) {
  if (android) return 'android.apk'
  if (desktop?.platform === 'win32' && desktop.arch === 'x64') return 'windows-x64.exe'
  if (desktop?.platform === 'darwin' && desktop.arch === 'arm64') return 'macos-arm64.dmg'
  if (desktop?.platform === 'darwin' && desktop.arch === 'x64') return 'macos-x86_64.dmg'
  return null
}

function compareVersions(a, b) {
  const right = b.split('.').map(Number)
  return a.split('.').map(Number).reduce((order, part, index) => order || part - right[index], 0)
}

export function availableUpdate(releases, installed, installer) {
  if (!Array.isArray(releases)) throw new Error('Lista de versões inválida')
  let newest = null
  for (const release of releases) {
    if (release?.draft !== false || !release.published_at || !Array.isArray(release.assets)) continue
    const tag = release.tag_name
    const version = typeof tag === 'string' && tag.match(tagPattern)?.[1]
    if (!version || compareVersions(version, installed) <= 0) continue
    const order = newest ? compareVersions(version, newest.version) : 1
    if (order < 0 || (order === 0 && (!newest.preview || release.prerelease))) continue

    const name = 'Linha-Clara-' + version + '-' + installer
    const url = releasesPage + '/download/' + tag + '/' + name
    const asset = release.assets.find((asset) =>
      asset?.name === name && asset.state === 'uploaded' && asset.size > 0 && asset.browser_download_url === url
    )
    if (!asset) continue
    newest = {
      version, url, notes: releasesPage + '/tag/' + tag, preview: release.prerelease === true,
      digest: asset.digest ?? null, size: asset.size,
    }
  }
  return newest
}

export async function fetchUpdate(installed, installer, signal) {
  const response = await fetch(releasesApi, {
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-cache',
    credentials: 'omit',
    signal,
  })
  if (!response.ok) throw new Error('Erro ao consultar versões do Linha Clara')
  return availableUpdate(await response.json(), installed, installer)
}
