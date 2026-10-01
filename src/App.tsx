import { useCallback, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { AppHeader } from './components/AppHeader'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { useAppearance } from './hooks/useAppearance'
import { usePdfExport } from './hooks/usePdfExport'
import { useWorkspace } from './hooks/useWorkspace'
import { loadStoredSettings } from './lib/initialState'

const DIRECTORY_INPUT_PROPS = { webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string
}

export default function App() {
  const { appearance, toggleAppearance } = useAppearance()
  const [settings, setSettings] = useState(loadStoredSettings)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor')
  const [goToLine, setGoToLine] = useState<{ line: number; sequence: number }>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const showEditor = useCallback(() => setMobilePanel('editor'), [])
  const showPreview = useCallback(() => setMobilePanel('preview'), [])
  const workspace = useWorkspace({ settings, onSettingsRestored: setSettings, onDocumentOpened: showEditor })
  const pdf = usePdfExport(workspace.fileName, showPreview)

  const handleGoToLine = useCallback((line: number) => {
    setMobilePanel('editor')
    setGoToLine(previous => ({ line, sequence: (previous?.sequence ?? 0) + 1 }))
  }, [])

  if (!workspace.restored) return <p role="status">Restauration de votre espace de travail…</p>

  const documentKey = workspace.activeDocumentPath ?? workspace.fileName

  return (
    <div
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) void workspace.openFile(file)
      }}
    >
      <AppHeader
        appearance={appearance}
        onToggleAppearance={toggleAppearance}
        fileName={workspace.fileName}
        exportPending={pdf.exportPending}
        folderName={workspace.folderName}
        documents={workspace.documents}
        activeDocumentPath={workspace.activeDocumentPath}
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenFolder={() => folderInputRef.current?.click()}
        onDocumentSelect={workspace.selectDocument}
        onExample={workspace.openExample}
        onDownload={workspace.download}
        onExport={pdf.startExport}
      />

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void workspace.openFile(file)
          event.currentTarget.value = ''
        }}
      />

      <input
        {...DIRECTORY_INPUT_PROPS}
        ref={folderInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,text/markdown,image/*"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files || [])
          if (files.length > 0) void workspace.openFolder(files)
          event.currentTarget.value = ''
        }}
      />

      {workspace.navigationError && <div className="navigation-error" role="alert">{workspace.navigationError}<button type="button" onClick={workspace.dismissNavigationError}>Fermer</button></div>}
      {pdf.exportError && <div className="export-error" role="alert">{pdf.exportError}</div>}
      <nav className="mobile-tabs" aria-label="Choix du panneau">
        <button type="button" className={mobilePanel === 'editor' ? 'active' : ''} onClick={showEditor}>Markdown</button>
        <button type="button" className={mobilePanel === 'preview' ? 'active' : ''} onClick={showPreview}>Aperçu</button>
      </nav>

      <main className={`workspace mobile-${mobilePanel}`}>
        <EditorPanel
          goToLine={goToLine}
          documentKey={documentKey}
          saveStatus={workspace.saveStatus}
          markdown={workspace.markdown}
          onChange={content => { pdf.clearExportError(); workspace.changeMarkdown(content) }}
        />
        <PreviewPanel
          documentKey={documentKey}
          anchor={workspace.anchor}
          onNavigateLink={workspace.navigateLink}
          onGoToLine={handleGoToLine}
          markdown={workspace.markdown}
          exportRequest={pdf.exportRequest}
          settings={settings}
          documentPath={workspace.activeDocumentPath}
          assetUrls={workspace.assetUrls}
          previewStatus={pdf.previewStatus}
          isFullscreen={isFullscreen}
          onSettingsChange={setSettings}
          onStatusChange={pdf.handleStatusChange}
          onToggleFullscreen={() => setIsFullscreen((value) => !value)}
        />
      </main>
    </div>
  )
}
