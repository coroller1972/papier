import { useCallback, useDeferredValue, useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { AppHeader } from './components/AppHeader'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { SAMPLE_MARKDOWN } from './data/sample'
import { importLocalWorkspace } from './lib/localWorkspace'
import type { DocumentSettings, PreviewStatus, WorkspaceDocument } from './types'

const STORAGE_KEY = 'papier-document-v1'
const SETTINGS_KEY = 'papier-settings-v1'
const DIRECTORY_INPUT_PROPS = { webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string
}

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
  const [folderName, setFolderName] = useState<string>()
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([])
  const [activeDocumentPath, setActiveDocumentPath] = useState<string>()
  const [assetUrls, setAssetUrls] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [settings, setSettings] = useState(loadStoredSettings)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('rendering')
  const [exportPending, setExportPending] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'editor' | 'preview'>('editor')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const assetUrlsRef = useRef<ReadonlyMap<string, string>>(new Map())

  const replaceAssetUrls = (assets: ReadonlyMap<string, File>) => {
    for (const url of assetUrlsRef.current.values()) URL.revokeObjectURL(url)

    const nextUrls = new Map<string, string>()
    for (const [path, file] of assets) nextUrls.set(path, URL.createObjectURL(file))
    assetUrlsRef.current = nextUrls
    setAssetUrls(nextUrls)
  }

  const clearWorkspace = () => {
    replaceAssetUrls(new Map())
    setDocuments([])
    setActiveDocumentPath(undefined)
    setFolderName(undefined)
  }

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, markdown)
  }, [markdown])

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => () => {
    for (const url of assetUrlsRef.current.values()) URL.revokeObjectURL(url)
  }, [])

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
    clearWorkspace()
    setMarkdown(content)
    setFileName(file.name)
    setMobilePanel('editor')
  }

  const handleFolder = async (files: File[]) => {
    try {
      const workspace = await importLocalWorkspace(files)
      const firstDocument = workspace.documents[0]

      replaceAssetUrls(workspace.assets)
      setFolderName(workspace.name)
      setDocuments(workspace.documents)
      setActiveDocumentPath(firstDocument.path)
      setMarkdown(firstDocument.content)
      setFileName(firstDocument.path)
      setMobilePanel('editor')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’ouvrir ce dossier.'
      window.alert(message)
    }
  }

  const handleDocumentSelect = (path: string) => {
    const document = documents.find((candidate) => candidate.path === path)
    if (!document) return

    setActiveDocumentPath(document.path)
    setMarkdown(document.content)
    setFileName(document.path)
  }

  const handleMarkdownChange = (content: string) => {
    setMarkdown(content)
    if (!activeDocumentPath) return

    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.path === activeDocumentPath ? { ...document, content } : document
    )))
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
        folderName={folderName}
        documents={documents}
        activeDocumentPath={activeDocumentPath}
        onOpenFile={() => fileInputRef.current?.click()}
        onOpenFolder={() => folderInputRef.current?.click()}
        onDocumentSelect={handleDocumentSelect}
        onExample={() => {
          clearWorkspace()
          setMarkdown(SAMPLE_MARKDOWN)
          setFileName('processus-publication.md')
        }}
        onExport={() => {
          setMobilePanel('preview')
          setExportPending(true)
        }}
      />

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,text/markdown,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleFile(file)
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
          if (files.length > 0) void handleFolder(files)
          event.currentTarget.value = ''
        }}
      />

      <nav className="mobile-tabs" aria-label="Choix du panneau">
        <button type="button" className={mobilePanel === 'editor' ? 'active' : ''} onClick={() => setMobilePanel('editor')}>Markdown</button>
        <button type="button" className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Aperçu</button>
      </nav>

      <main className={`workspace mobile-${mobilePanel}`}>
        <EditorPanel markdown={markdown} onChange={handleMarkdownChange} />
        <PreviewPanel
          markdown={deferredMarkdown}
          settings={settings}
          documentPath={activeDocumentPath}
          assetUrls={assetUrls}
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
