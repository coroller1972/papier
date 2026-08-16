import type { WorkspaceDocument } from '../types'

const MARKDOWN_EXTENSION = /\.(?:md|markdown)$/i

const normalizeSlashes = (path: string) => path.replaceAll('\\', '/')

function getImportedPath(file: File, rootName: string): string {
  const path = normalizeSlashes(file.webkitRelativePath || file.name)
  const prefix = rootName ? `${rootName}/` : ''
  return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : path
}

export interface ImportedWorkspace {
  name: string
  documents: WorkspaceDocument[]
  assets: Map<string, File>
}

export async function importLocalWorkspace(files: File[]): Promise<ImportedWorkspace> {
  const firstRelativePath = normalizeSlashes(files[0]?.webkitRelativePath || '')
  const rootName = firstRelativePath.includes('/') ? firstRelativePath.split('/')[0] : ''
  const entries = files.map((file) => ({
    file,
    path: getImportedPath(file, rootName),
  }))

  const markdownEntries = entries
    .filter(({ path }) => MARKDOWN_EXTENSION.test(path))
    .sort((left, right) => left.path.localeCompare(right.path, 'fr'))

  if (markdownEntries.length === 0) {
    throw new Error('Ce dossier ne contient aucun fichier Markdown (.md ou .markdown).')
  }

  const documents = await Promise.all(
    markdownEntries.map(async ({ file, path }) => ({
      path,
      name: path.split('/').at(-1) || path,
      content: await file.text(),
    })),
  )

  const assets = new Map<string, File>()
  for (const { file, path } of entries) {
    if (file.type.startsWith('image/')) assets.set(path, file)
  }

  return {
    name: rootName || 'Dossier importé',
    documents,
    assets,
  }
}

function resolveRelativePath(documentPath: string, source: string): string | null {
  if (!source || source.startsWith('#') || source.startsWith('//')) return null
  if (/^[a-z][a-z0-9+.-]*:/i.test(source)) return null

  const cleanSource = source.split(/[?#]/, 1)[0]
  let decodedSource: string
  try {
    decodedSource = decodeURIComponent(cleanSource)
  } catch {
    decodedSource = cleanSource
  }

  const segments = decodedSource.startsWith('/')
    ? []
    : normalizeSlashes(documentPath).split('/').slice(0, -1)

  for (const segment of normalizeSlashes(decodedSource).split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (segments.length === 0) return null
      segments.pop()
    } else {
      segments.push(segment)
    }
  }

  return segments.join('/')
}

function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  if (image.complete) return Promise.resolve()

  return new Promise((resolve) => {
    const finish = () => {
      image.removeEventListener('load', finish)
      image.removeEventListener('error', finish)
      signal.removeEventListener('abort', finish)
      resolve()
    }

    image.addEventListener('load', finish, { once: true })
    image.addEventListener('error', finish, { once: true })
    signal.addEventListener('abort', finish, { once: true })
  })
}

export async function resolveLocalImages(
  container: HTMLElement,
  documentPath: string | undefined,
  assetUrls: ReadonlyMap<string, string>,
  signal: AbortSignal,
): Promise<void> {
  if (!documentPath) return

  const caseInsensitiveUrls = new Map(
    Array.from(assetUrls, ([path, url]) => [path.toLocaleLowerCase(), url]),
  )
  const pendingImages: Promise<void>[] = []
  let hasMissingImage = false

  for (const image of container.querySelectorAll<HTMLImageElement>('img[src]')) {
    const source = image.getAttribute('src') || ''
    const resolvedPath = resolveRelativePath(documentPath, source)
    if (!resolvedPath) continue

    const assetUrl = assetUrls.get(resolvedPath)
      ?? caseInsensitiveUrls.get(resolvedPath.toLocaleLowerCase())

    if (!assetUrl) {
      hasMissingImage = true
      const error = document.createElement('span')
      error.className = 'local-image-error'
      error.setAttribute('role', 'img')
      error.textContent = `Image locale introuvable : ${source}`
      image.replaceWith(error)
      continue
    }

    image.src = assetUrl
    image.dataset.localAsset = resolvedPath
    pendingImages.push(waitForImage(image, signal))
  }

  await Promise.all(pendingImages)
  if (hasMissingImage) throw new Error('Au moins une image locale est introuvable.')
}
