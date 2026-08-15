import { DownloadIcon, FileIcon, FolderIcon } from './Icons'

interface AppHeaderProps {
  fileName: string
  exportPending: boolean
  onOpen: () => void
  onExample: () => void
  onExport: () => void
}

export function AppHeader({
  fileName,
  exportPending,
  onOpen,
  onExample,
  onExport,
}: AppHeaderProps) {
  return (
    <header className="app-header">
      <div className="brand-group">
        <div className="wordmark">Papier</div>
        <span className="current-file" title={fileName}>{fileName}</span>
      </div>
      <div className="header-actions">
        <button className="button button-quiet" type="button" onClick={onOpen}>
          <FolderIcon />
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
