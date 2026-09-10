import type { DocumentSettings, WorkspaceDocument } from '../types'

export interface SavedSession {
  markdown: string
  fileName: string
  folderName?: string
  documents: WorkspaceDocument[]
  activeDocumentPath?: string
  assets: ReadonlyMap<string, File>
  settings: DocumentSettings
}

interface SessionMetadata extends Omit<SavedSession, 'documents' | 'assets'> {
  version: 2
  documentPaths: string[]
}

let previous: SavedSession | undefined

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('papier', 2)
    request.onupgradeneeded = () => {
      for (const store of ['session', 'documents', 'assets']) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Stockage indisponible'))
  })
}

function read<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadSession(): Promise<SavedSession | undefined> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction(['session', 'documents', 'assets'])
    const [metadata, documents, assets] = await Promise.all([
      read<SessionMetadata | SavedSession | undefined>(transaction.objectStore('session').get('current')),
      read<WorkspaceDocument[]>(transaction.objectStore('documents').getAll()),
      read<Array<{ path: string; file: File }>>(transaction.objectStore('assets').getAll()),
    ])
    if (!metadata) return undefined
    if (!('version' in metadata)) return metadata // Migrate the previous single-record session on the next successful save.
    const byPath = new Map(documents.map(document => [document.path, document]))
    const ordered = metadata.documentPaths.flatMap(path => byPath.has(path) ? [byPath.get(path)!] : [])
    const session: SavedSession = {
      ...metadata,
      markdown: ordered.find(document => document.path === metadata.activeDocumentPath)?.content ?? metadata.markdown,
      documents: ordered,
      assets: new Map(assets.map(({ path, file }) => [path, file])),
    }
    previous = session
    return session
  } finally {
    database.close()
  }
}

async function writeSession(session: SavedSession): Promise<void> {
  const database = await openDatabase()
  try {
    const oldDocuments = new Map(previous?.documents.map(document => [document.path, document]))
    const changed = session.documents.filter(document => oldDocuments.get(document.path) !== document)
    const currentPaths = new Set(session.documents.map(document => document.path))
    const deleted = [...oldDocuments.keys()].filter(path => !currentPaths.has(path))
    const assetsChanged = previous?.assets !== session.assets
    const stores = ['session', ...(changed.length || deleted.length ? ['documents'] : []), ...(assetsChanged ? ['assets'] : [])]
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(stores, 'readwrite')
      const metadata: SessionMetadata = {
        version: 2, markdown: session.documents.length ? '' : session.markdown,
        fileName: session.fileName, folderName: session.folderName, activeDocumentPath: session.activeDocumentPath,
        settings: session.settings, documentPaths: session.documents.map(document => document.path),
      }
      transaction.objectStore('session').put(metadata, 'current')
      for (const document of changed) transaction.objectStore('documents').put(document, document.path)
      for (const path of deleted) transaction.objectStore('documents').delete(path)
      if (assetsChanged) {
        transaction.objectStore('assets').clear()
        for (const [path, file] of session.assets) transaction.objectStore('assets').put({ path, file }, path)
      }
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
    previous = session
  } finally {
    database.close()
  }
}

type Waiter = { resolve: () => void; reject: (reason: unknown) => void }
let pending: { session: SavedSession; waiters: Waiter[]; since: number } | undefined
let timer: ReturnType<typeof setTimeout> | undefined
let writing = false

export async function flushSession(): Promise<void> {
  if (writing || !pending) return
  clearTimeout(timer)
  const batch = pending
  pending = undefined
  writing = true
  try {
    await writeSession(batch.session)
    batch.waiters.forEach(waiter => waiter.resolve())
  } catch (error) {
    batch.waiters.forEach(waiter => waiter.reject(error))
  } finally {
    writing = false
    if (pending) void flushSession()
  }
}

// Coalesce bursts of edits while preserving transaction order and truthful save status.
export function saveSession(session: SavedSession): Promise<void> {
  const promise = new Promise<void>((resolve, reject) => {
    if (pending) { pending.session = session; pending.waiters.push({ resolve, reject }) }
    else pending = { session, waiters: [{ resolve, reject }], since: Date.now() }
  })
  clearTimeout(timer)
  timer = setTimeout(() => void flushSession(), Math.max(0, Math.min(350, 1500 - (Date.now() - pending!.since))))
  return promise
}

window.addEventListener('pagehide', () => void flushSession())
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushSession()
})
