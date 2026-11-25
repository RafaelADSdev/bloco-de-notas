import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)
const stage = new URL('.native-build/desktop/', root)
const { name, productName, version, main, description } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

await rm(new URL('dist/', stage), { recursive: true, force: true })
await mkdir(new URL('desktop/', stage), { recursive: true })
await cp(new URL('dist/', root), new URL('dist/', stage), { recursive: true })
await cp(new URL(main, root), new URL(main, stage))
await writeFile(new URL('package.json', stage), JSON.stringify({ name, productName, version, main, description }))
