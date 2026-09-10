import { useMemo, useState } from 'react'
import type { WorkspaceDocument } from '../types'

interface Folder {
  folders: Map<string, Folder>
  documents: WorkspaceDocument[]
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

export function DocumentBrowser({ documents, activePath, folderName, onSelect }: {
  documents: WorkspaceDocument[]
  activePath?: string
  folderName?: string
  onSelect: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => documents.filter(document => normalize(document.path).includes(normalize(query))), [documents, query])
  const tree = useMemo(() => {
    const root: Folder = { folders: new Map(), documents: [] }
    for (const document of filtered) {
      let folder = root
      for (const segment of document.path.split('/').slice(0, -1)) {
        if (!folder.folders.has(segment)) folder.folders.set(segment, { folders: new Map(), documents: [] })
        folder = folder.folders.get(segment)!
      }
      folder.documents.push(document)
    }
    return root
  }, [filtered])

  const renderFolder = (folder: Folder, path = '') => (
    <ul>
      {[...folder.folders].sort(([a], [b]) => a.localeCompare(b, 'fr')).map(([name, child]) => (
        <li key={`${path}/${name}`}><details open><summary>{name}</summary>{renderFolder(child, `${path}/${name}`)}</details></li>
      ))}
      {folder.documents.map(document => {
        const modified = document.originalContent !== undefined && document.content !== document.originalContent
        return <li key={document.path}>
          <button type="button" className="document-entry" aria-current={document.path === activePath ? 'page' : undefined}
            aria-label={`${document.path}${modified ? ' — modifié depuis l’import' : ''}`} title={document.path} onClick={() => onSelect(document.path)}>
            <span>{document.name}</span>{modified && <span className="modified-badge" title="Modifié depuis l’import">Modifié</span>}
          </button>
        </li>
      })}
    </ul>
  )

  return <nav className="document-browser" aria-label="Documents du dossier">
    <strong>{folderName || 'Documents'}</strong>
    <input type="search" aria-label="Rechercher un document" placeholder="Rechercher par nom ou chemin…" value={query} onChange={event => setQuery(event.target.value)} />
    <span className="document-count" role="status">{filtered.length} document{filtered.length > 1 ? 's' : ''}</span>
    <div className="document-tree" key={query}>{filtered.length ? renderFolder(tree) : <p>Aucun document trouvé.</p>}</div>
    <small>« Modifié » compare le texte au fichier importé. La sauvegarde reste dans ce navigateur.</small>
  </nav>
}
