import worker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import { fileData, newItem, newPage } from './model'

GlobalWorkerOptions.workerSrc = worker

export async function loadPdf(source) {
  const response = await fetch(source)
  const data = new Uint8Array(await response.arrayBuffer())
  return getDocument({ data, useSystemFonts: true })
}

export async function importPdf(file, parent) {
  const data = await fileData(new Blob([file], { type: 'application/pdf' }))
  let loading
  try {
    loading = await loadPdf(data)
    const document = await loading.promise
    const item = newItem({ type: 'pdf', title: file.name.replace(/\.pdf$/i, ''), color: 'blue', parent })
    const text = []
    item.pdf = data
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number)
      const { width, height } = page.getViewport({ scale: 1 })
      const scale = 800 / width
      item.pages.push(newPage({ paper: 'plain', width: 800, height: height * scale, pdfPage: number - 1 }))
      try {
        const contents = await page.getTextContent()
        text.push(contents.items.map((entry) => entry.str ?? '').join(' '))
      } catch { /* Image-only or unusual pages can still be viewed and annotated. */ }
    }
    item.pdfText = text.join(' ')
    return item
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('O PDF está protegido por senha.')
    throw new Error('Não foi possível abrir este PDF.')
  } finally {
    if (loading) await loading.destroy()
  }
}
