import { BookOpen, Images, Settings, Star } from 'lucide-react'

const destinations = [
  ['home', 'Biblioteca', BookOpen],
  ['drawings', 'Desenhos', Images],
  ['favorites', 'Favoritos', Star],
  ['settings', 'Ajustes', Settings],
]

export function MobileNavigation({ active, go }) {
  return <nav className="android-navigation" aria-label="Navegação principal">
    {destinations.map(([key, label, Icon]) => <button key={key} type="button" onClick={() => go(key)}
      aria-current={key === active ? 'page' : undefined}>
      <span><Icon size={21} strokeWidth={1.8} /></span>{label}
    </button>)}
  </nav>
}
