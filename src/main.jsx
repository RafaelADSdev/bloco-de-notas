import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource/instrument-serif/latin-400.css'
import '@fontsource/instrument-serif/latin-400-italic.css'
import App from './App'
import { isAndroidApp } from './android-platform'
import './style.css'
import './android.css'

if (isAndroidApp) {
  const root = document.documentElement
  root.dataset.platform = 'android'
  root.dataset.theme ||= 'light'
  if (location.pathname === '/' || location.pathname === '/login/') {
    history.replaceState(null, '', '/home/')
  }
}

createRoot(document.getElementById('root')).render(<App />)
