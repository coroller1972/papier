import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import { AppHeader } from './components/AppHeader'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { SAMPLE_MARKDOWN } from './data/sample'
import type { DocumentSettings, PreviewStatus } from './types'

const STORAGE_KEY = 'papier-document-v1'
const SETTINGS_KEY = 'papier-settings-v1'

const DEFAULT_SETTINGS: DocumentSettings = {
  format: 'A4',
  margins: 'normal',
  theme: 'editorial',
  zoom: 80,
}

function loadStoredDocument() {
  return window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE_MARKDOWN
}

function loadStoredSettings(): DocumentSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY)
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [markdown, setMarkdown] = useState(loadStoredDocument)
  const deferredMarkdown = useDeferredValue(markdown)
  const [fileName, setFileName] = useState('processus-publication.md')
  const [settings, setSettings] = useState(loadStoredSettings)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('rendering')
  const [exportPending, setExportPending] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, markdown)
  }, [markdown])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    if (!exportPending || previewStatus === 'rendering') return

    const frame = window.requestAnimationFrame(() => {
      window.print()
      setExportPending(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [exportPending, previewStatus])

  const handleStatusChange = useCallback((status: PreviewStatus) => {
    setPreviewStatus(status)
  }, [])

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.md') && file.type !== 'text/markdown') {
      window.alert('Veuillez sélectionner un fichier Markdown (.md).')
      return
    }

    const content = await file.text()
    setMarkdown(content)
    setFileName(file.name)
    setMobilePanel('editor')
  }

  return (
    <div
      className="app-shell"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        const file = event.dataTransfer.files[0]
        if (file) void handleFile(file)
      }}
    >
      <AppHeader
        fileName={fileName}
        exportPending={exportPending}
        onOpen={() => inputRef.current?.click()}
        onExample={() => {
          setMarkdown(SAMPLE_MARKDOWN)
          setFileName('processus-publication.md')
        }}
        onExport={() => {
          setMobilePanel('preview')
          setExportPending(true)
        }}
      />

      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".md,text/markdown,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
          event.currentTarget.value = ''
        }}
      />

      <nav className="mobile-tabs" aria-label="Choix du panneau">
        <button type="button" className={mobilePanel === 'editor' ? 'active' : ''} onClick={() => setMobilePanel('editor')}>Markdown</button>
        <button type="button" className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Aperçu</button>
      </nav>

      <main className={`workspace mobile-${mobilePanel}`}>
        <EditorPanel markdown={markdown} onChange={setMarkdown} />
        <PreviewPanel
          markdown={deferredMarkdown}
          settings={settings}
          previewStatus={previewStatus}
          isFullscreen={isFullscreen}
          onSettingsChange={setSettings}
          onStatusChange={handleStatusChange}
          onToggleFullscreen={() => setIsFullscreen((value) => !value)}
        />
      </main>
    </div>
  )
}
