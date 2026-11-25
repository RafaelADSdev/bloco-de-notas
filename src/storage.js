let opening
function database() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('linha-clara', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('library')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      opening = undefined
      reject(request.error)
    }
  })
  return opening
}

async function read(key) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('library').objectStore('library').get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function write(key, value) {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('library', 'readwrite')
    transaction.objectStore('library').put(value, key)
    transaction.oncomplete = resolve
    transaction.onabort = () => reject(transaction.error)
  })
}

export const readLibrary = () => read('documents')
export const writeLibrary = (items) => write('documents', items)
export const readStudio = () => read('studio')
export const writeStudio = (studio) => write('studio', studio)
