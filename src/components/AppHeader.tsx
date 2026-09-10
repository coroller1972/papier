import { useEffect, useRef, useState } from 'react'
import { DocumentBrowser } from './DocumentBrowser'
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
  onDownload: () => void
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
  onDownload,
}: AppHeaderProps) {
  const [browserOpen, setBrowserOpen] = useState(false)
  const browserRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!browserOpen) return
    const close = (event: PointerEvent) => {
      if (!browserRef.current?.contains(event.target as Node) && !toggleRef.current?.contains(event.target as Node)) setBrowserOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setBrowserOpen(false); toggleRef.current?.focus() }
    }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', escape)
    browserRef.current?.querySelector('input')?.focus()
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape) }
  }, [browserOpen])
  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="wordmark">Papier</div>
        {documents.length > 0 && <button ref={toggleRef} className="browser-toggle" type="button" aria-label="Parcourir les documents" title="Parcourir les documents" aria-expanded={browserOpen} aria-controls="document-browser-panel" onClick={() => setBrowserOpen(value => !value)}><FolderIcon /></button>}
        {documents.length > 0 && activeDocumentPath ? (
          <label className="document-picker">
            <span className="visually-hidden">Document Markdown à afficher</span>
            <select
              aria-label="Document Markdown à afficher"
              value={activeDocumentPath}
              onChange={(event) => onDocumentSelect(event.target.value)}
            >
              {documents.map((document) => (
                <option key={document.path} value={document.path}>{document.path}{document.originalContent !== undefined && document.content !== document.originalContent ? ' •' : ''}</option>
              ))}
            </select>
            <ChevronDownIcon />
          </label>
        ) : (
          <span className="current-file" title={fileName}>{fileName}</span>
        )}
        {folderName ? <span className="folder-name" title={folderName}>{folderName}</span> : null}
      </div>
      {browserOpen && documents.length > 0 && <div id="document-browser-panel" ref={browserRef} className="browser-popover">
        <DocumentBrowser documents={documents} activePath={activeDocumentPath} folderName={folderName} onSelect={path => { onDocumentSelect(path); setBrowserOpen(false); toggleRef.current?.focus() }} />
      </div>}
      <div className="header-actions">
        <button aria-label="Ouvrir un dossier" title="Ouvrir un dossier" className="button button-quiet button-open-folder" type="button" onClick={onOpenFolder}>
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
        <button className="button button-quiet" aria-label="Télécharger .md" title="Télécharger .md" type="button" onClick={onDownload}><DownloadIcon /><span>Télécharger .md</span></button>
        <button aria-label={exportPending ? 'Préparation…' : 'Exporter en PDF'} title="Exporter en PDF" disabled={exportPending} className="button button-primary" type="button" onClick={onExport}>
          <DownloadIcon />
          <span>{exportPending ? 'Préparation…' : 'Exporter en PDF'}</span>
        </button>
      </div>
    </header>
  )
}
