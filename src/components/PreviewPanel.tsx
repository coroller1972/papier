import type { DocumentSettings, PreviewStatus } from '../types'
import { DocumentPreview } from './DocumentPreview'
import { TypographyPanel } from './TypographyPanel'
import { SettingsBar } from './SettingsBar'

interface PreviewPanelProps {
  documentKey: string
  anchor?: { hash: string; sequence: number }
  onNavigateLink: (href: string) => boolean
  exportRequest: number
  markdown: string
  settings: DocumentSettings
  documentPath?: string
  assetUrls: ReadonlyMap<string, string>
  previewStatus: PreviewStatus
  isFullscreen: boolean
  onSettingsChange: (settings: DocumentSettings) => void
  onStatusChange: (status: PreviewStatus, request: number) => void
  onToggleFullscreen: () => void
}

export function PreviewPanel({
  documentKey, anchor, onNavigateLink,
  exportRequest,
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
    ? 'Mise en page…'
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
      <TypographyPanel value={settings.typography} onChange={typography => onSettingsChange({ ...settings, typography })} />
      <DocumentPreview
        documentKey={documentKey}
        anchor={anchor}
        onNavigateLink={onNavigateLink}
        exportRequest={exportRequest}
        markdown={markdown}
        settings={settings}
        documentPath={documentPath}
        assetUrls={assetUrls}
        onStatusChange={onStatusChange}
      />
    </section>
  )
}
