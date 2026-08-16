import type { WorkspaceDocument } from '../types'
import { ChevronDownIcon, DownloadIcon, FileIcon, FolderIcon } from './Icons'

interface AppHeaderProps {
  fileName: string
  folderName?: string
  documents: WorkspaceDocument[]
  activeDocumentPath?: string
  exportPending: boolean
  onOpenFile: () => void
  onOpenFolder: () => void
  onDocumentSelect: (path: string) => void
  onExample: () => void
  onExport: () => void
}

export function AppHeader({
  fileName,
  folderName,
  documents,
  activeDocumentPath,
  exportPending,
  onOpenFile,
  onOpenFolder,
  onDocumentSelect,
  onExample,
  onExport,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="wordmark">Papier</div>
        {documents.length > 0 && activeDocumentPath ? (
          <label className="document-picker">
            <span className="visually-hidden">Document Markdown à afficher</span>
            <select
              aria-label="Document Markdown à afficher"
              value={activeDocumentPath}
              onChange={(event) => onDocumentSelect(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.path} value={document.path}>{document.path}</option>
              ))}
            </select>
            <ChevronDownIcon />
          </label>
        ) : (
          <span className="current-file" title={fileName}>{fileName}</span>
        )}
        {folderName ? <span className="folder-name" title={folderName}>{folderName}</span> : null}
      </div>
      <div className="header-actions">
        <button className="button button-quiet button-open-folder" type="button" onClick={onOpenFolder}>
          <FolderIcon />
          <span>Ouvrir un dossier</span>
        </button>
        <button className="button button-quiet button-open-file" type="button" onClick={onOpenFile}>
          <FileIcon />
          <span>Ouvrir .md</span>
        </button>
        <button className="button button-quiet button-example" type="button" onClick={onExample}>
          <FileIcon />
          <span>Exemple</span>
        </button>
        <button className="button button-primary" type="button" onClick={onExport}>
          <DownloadIcon />
          <span>{exportPending ? 'Préparation…' : 'Exporter en PDF'}</span>
        </button>
      </div>
    </header>
  )
}
