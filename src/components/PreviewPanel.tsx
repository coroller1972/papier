import type { DocumentSettings, PreviewStatus } from '../types'
import { DocumentPreview } from './DocumentPreview'
import { SettingsBar } from './SettingsBar'

interface PreviewPanelProps {
  markdown: string
  settings: DocumentSettings
  documentPath?: string
  assetUrls: ReadonlyMap<string, string>
  previewStatus: PreviewStatus
  isFullscreen: boolean
  onSettingsChange: (settings: DocumentSettings) => void
  onStatusChange: (status: PreviewStatus) => void
  onToggleFullscreen: () => void
}

export function PreviewPanel({
  markdown,
  settings,
  documentPath,
  assetUrls,
  previewStatus,
  isFullscreen,
  onSettingsChange,
  onStatusChange,
  onToggleFullscreen,
}: PreviewPanelProps) {
  const statusLabel = previewStatus === 'rendering'
    ? 'Rendu des diagrammes…'
    : previewStatus === 'error'
      ? 'Erreur de rendu'
      : 'Aperçu à jour'

  return (
    <section className={`preview-panel${isFullscreen ? ' is-fullscreen' : ''}`} aria-label="Aperçu du document">
      <div className="preview-heading">
        <span>Aperçu</span>
        <span className={`render-status status-${previewStatus}`}><i /> {statusLabel}</span>
      </div>
      <SettingsBar
        settings={settings}
        isFullscreen={isFullscreen}
        onChange={onSettingsChange}
        onToggleFullscreen={onToggleFullscreen}
      />
      <DocumentPreview
        markdown={markdown}
        settings={settings}
        documentPath={documentPath}
        assetUrls={assetUrls}
        onStatusChange={onStatusChange}
      />
    </section>
  )
}
