import { copyFile, mkdir } from 'node:fs/promises'

for (const route of ['home', 'login', 'editor']) {
  const directory = new URL(`../dist/${route}/`, import.meta.url)
  await mkdir(directory, { recursive: true })
  await copyFile(new URL('../dist/index.html', import.meta.url), new URL('index.html', directory))
}
