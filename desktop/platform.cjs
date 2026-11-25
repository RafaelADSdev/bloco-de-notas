const { contextBridge, ipcRenderer } = require('electron')

const updates = process.platform === 'win32' && process.argv.includes('--linha-clara-installer') ? {
  download: (version) => ipcRenderer.invoke('linha-clara:download-update', version),
  cancel: () => ipcRenderer.invoke('linha-clara:cancel-update'),
  install: () => ipcRenderer.invoke('linha-clara:install-update'),
} : null

contextBridge.exposeInMainWorld('linhaClaraDesktop', { platform: process.platform, arch: process.arch, updates })
