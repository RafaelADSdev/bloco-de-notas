import { useState } from 'react'
import { ArrowRight, BookOpen, CircleHelp, Download, FilePlus2, Plus, Upload } from 'lucide-react'
import { Brand, Dialog } from './ui'

const information = {
  terms: {
    title: 'Termos e condições',
    text: 'Você pode criar cadernos e importar arquivos neste navegador. Para levar suas anotações para outro dispositivo, baixe uma cópia na biblioteca e importe o arquivo no outro dispositivo.',
  },
  privacy: {
    title: 'Política de privacidade',
    text: 'O Linha Clara guarda suas anotações e os arquivos importados no armazenamento deste navegador. Limpar os dados do site remove a biblioteca deste dispositivo.',
  },
  cookies: {
    title: 'Política de cookies',
    text: 'O Linha Clara usa o armazenamento local do navegador para guardar a biblioteca. O aplicativo funciona sem cookies de sessão.',
  },
  help: {
    title: 'Ajuda e suporte',
    text: 'Use “Baixar cópia” para guardar seus documentos em um arquivo. Para recuperar a biblioteca, abra esse arquivo em “Importar”.',
  },
}

export function Welcome({ create, ready, busyImport, storageError, backup }) {
  const [info, setInfo] = useState(null)
  const details = information[info]

  return <div className="welcome">
    <header className="welcome-header">
      <a className="welcome-brand" href="/" aria-label="Início do Linha Clara"><Brand /></a>
      <button type="button" className="button secondary welcome-help" aria-haspopup="dialog" onClick={() => setInfo('help')}><CircleHelp size={18} aria-hidden="true" /> Ajuda</button>
    </header>
    <main className="welcome-main">
      <section className="welcome-workspace" aria-labelledby="welcome-title">
        <h1 id="welcome-title">Seu espaço<br className="welcome-title-break" /> para <em>anotar.</em></h1>
        <p className="welcome-description">Escreva em cadernos, faça anotações em PDFs ou abra uma tela para desenhar.</p>
        <a href="/home/" className="button primary welcome-open">
          <BookOpen size={18} aria-hidden="true" /> Abrir biblioteca <ArrowRight size={18} aria-hidden="true" />
        </a>
        <div className="welcome-actions" role="group" aria-label="Criar documentos">
          <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => create('notebook')} disabled={!ready}><Plus size={18} aria-hidden="true" /> Criar caderno</button>
          <button type="button" className="button secondary" aria-haspopup="dialog" onClick={() => create('text')} disabled={!ready}><FilePlus2 size={18} aria-hidden="true" /> Criar nota</button>
        </div>
        <section className="welcome-storage" aria-labelledby="welcome-storage-title">
          <h2 id="welcome-storage-title">Arquivos e cópias</h2>
          <p>Suas notas ficam neste navegador. Você pode importar arquivos PDF, TXT ou JSON.</p>
          <div className="welcome-transfer">
            <button type="button" className="button link-button" aria-haspopup="dialog" aria-label={busyImport ? undefined : 'Importar arquivos'} onClick={() => create('import')} disabled={!ready || busyImport}>
              <Upload size={16} aria-hidden="true" /> {busyImport ? 'Importando…' : 'Importar'}
            </button>
            <button type="button" className="button link-button" aria-label="Baixar cópia da biblioteca" onClick={backup} disabled={!ready || busyImport}>
              <Download size={16} aria-hidden="true" /> Baixar cópia
            </button>
          </div>
          {storageError && <p className="welcome-storage-error" role="alert">{storageError}</p>}
        </section>
      </section>
      <div className="welcome-visual" aria-hidden="true">
        <img src="/linha-clara-estudio.webp" width="1122" height="1402" alt="" fetchPriority="high" />
      </div>
    </main>
    <footer className="welcome-footer" aria-label="Informações da página">
      <nav aria-label="Termos e políticas">
        {['terms', 'privacy', 'cookies'].map((key) => <button key={key} type="button" aria-haspopup="dialog" onClick={() => setInfo(key)}>{information[key].title}</button>)}
      </nav>
    </footer>
    {details && <Dialog title={details.title} close={() => setInfo(null)}>
      <p className="dialog-copy">{details.text}</p>
      <footer className="dialog-actions">
        <button type="button" className="button secondary" onClick={() => setInfo(null)}>Fechar</button>
      </footer>
    </Dialog>}
  </div>
}
