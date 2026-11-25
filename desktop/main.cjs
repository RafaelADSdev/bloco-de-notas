const { app, BrowserWindow, ipcMain, Menu, net, protocol, session, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const scheme = 'linhaclara'
const appUrl = scheme + '://app'
const isLocal = (value) => {
  const url = URL.parse(value)
  return url?.protocol === scheme + ':' && url.host === 'app'
}

const canInstallUpdates = process.platform === 'win32' && process.arch === 'x64' && app.isPackaged

if (canInstallUpdates) {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window?.isMinimized()) window.restore()
    window?.focus()
  })
}

protocol.registerSchemesAsPrivileged([{
  scheme,
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
}])

function serveAsset(request) {
  if (!isLocal(request.url)) return new Response(null, { status: 404 })

  const root = path.join(app.getAppPath(), 'dist')
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname)
  } catch {
    return new Response(null, { status: 400 })
  }
  if (pathname.includes('\0')) return new Response(null, { status: 400 })
  const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''))
  const relativePath = path.relative(root, file)
  if (relativePath === '..' || relativePath.startsWith('..' + path.sep) || path.isAbsolute(relativePath)) {
    return new Response(null, { status: 403 })
  }
  return net.fetch(pathToFileURL(file).href)
}

function openWindow() {
  const window = new BrowserWindow({
    title: 'Linha Clara',
    width: 1360,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: '#181715',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'platform.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: canInstallUpdates ? ['--linha-clara-installer'] : [],
    },
  })

  window.webContents.on('will-navigate', (event, url) => {
    if (!isLocal(url)) event.preventDefault()
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) {
      void shell.openExternal(url).catch(console.error)
    }
    return { action: 'deny' }
  })
  window.once('ready-to-show', () => window.show())
  void window.loadURL(appUrl + '/')
}

app.whenReady().then(() => {
  protocol.handle(scheme, (request) => serveAsset(request))
  if (canInstallUpdates) require('./windows-updates.cjs').registerWindowsUpdates(app, ipcMain, isLocal)
  session.defaultSession.setPermissionCheckHandler((_contents, name, origin, details) =>
    name === 'media' && isLocal(origin) && details.mediaType === 'audio')
  session.defaultSession.setPermissionRequestHandler((_contents, name, callback, details) =>
    callback(name === 'media' && isLocal(details.requestingUrl)
      && details.mediaTypes?.length === 1 && details.mediaTypes[0] === 'audio'))

  Menu.setApplicationMenu(process.platform === 'darwin'
    ? Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }, { role: 'windowMenu' }])
    : null)
  openWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) openWindow()
  })
}).catch(console.error)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
