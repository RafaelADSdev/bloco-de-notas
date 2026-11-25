import { Capacitor, registerPlugin } from '@capacitor/core'

export const isAndroidApp = Capacitor.getPlatform() === 'android'
const systemBars = registerPlugin('SystemBars')

export function styleAndroidBars(theme, drawing) {
  if (!isAndroidApp) return
  const style = theme === 'light' ? 'LIGHT' : 'DARK'
  Promise.all([
    systemBars.setStyle({ style, bar: 'StatusBar' }),
    systemBars.setStyle({ style: drawing ? 'LIGHT' : style, bar: 'NavigationBar' }),
  ]).catch(() => {})
}
