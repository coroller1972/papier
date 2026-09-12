import { useCallback, useEffect, useRef, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { AppHeader } from './components/AppHeader'
import { EditorPanel } from './components/EditorPanel'
import { PreviewPanel } from './components/PreviewPanel'
import { defaultTypography, restoreSettings } from './lib/typography'
import { loadAppearance, saveAppearance } from './lib/appearance'
import { SAMPLE_MARKDOWN } from './data/sample'
import { loadSession, saveSession } from './lib/session'
import { importLocalWorkspace, resolveRelativePath } from './lib/localWorkspace'
import type { DocumentSettings, PreviewStatus, WorkspaceDocument } from './types'

const STORAGE_KEY = 'papier-document-v1'
const SETTINGS_KEY = 'papier-settings-v1'
const DIRECTORY_INPUT_PROPS = { webkitdirectory: '' } as InputHTMLAttributes<HTMLInputElement> & {
  webkitdirectory: string
}

const DEFAULT_SETTINGS: DocumentSettings = {
  typography: defaultTypography,
  format: 'A4',
  margins: 'normal',
  theme: 'editorial',
  zoom: 80,
}

function loadStoredDocument() {
  try { return window.localStorage.getItem(STORAGE_KEY) ?? SAMPLE_MARKDOWN } catch { return SAMPLE_MARKDOWN }
}

function loadStoredSettings(): DocumentSettings {
  try {
    const stored = window.localStorage.getItem(SETTINGS_KEY)
    return stored ? restoreSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) }) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

export default function App() {
  const [appearance, setAppearance] = useState(loadAppearance)
  const toggleAppearance = () => {
    const next = appearance === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.appearance = next
    saveAppearance(next)
    setAppearance(next)
  }
  const [markdown, setMarkdown] = useState(loadStoredDocument)
  const [restored, setRestored] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [saveStatus, setSaveStatus] = useState('Chargement…')
  const [assets, setAssets] = useState<ReadonlyMap<string, File>>(new Map())
  const [exportRequest, setExportRequest] = useState(0)
  const [renderedRequest, setRenderedRequest] = useState(-1)
  const [anchor, setAnchor] = useState<{ hash: string; sequence: number }>()
  const [navigationError, setNavigationError] = useState('')
  const [exportError, setExportError] = useState('')
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
    setAssets(assets)
  }

  const clearWorkspace = () => {
    replaceAssetUrls(new Map())
    setDocuments([])
    setAnchor(undefined)
    setNavigationError('')
    setActiveDocumentPath(undefined)
    setFolderName(undefined)
  }

  useEffect(() => {
    let cancelled = false
    loadSession().then((session) => {
      if (cancelled) return
      if (session) {
        setMarkdown(session.markdown)
        setFileName(session.fileName)
        setFolderName(session.folderName)
        setDocuments(session.documents.map(document => document.originalContent === undefined ? { ...document, originalContent: document.content } : document))
        setActiveDocumentPath(session.activeDocumentPath)
        setSettings(restoreSettings(session.settings))
        replaceAssetUrls(session.assets)
      }
      setRestored(true)
    }).catch(() => {
      if (cancelled) return
      setStorageAvailable(false)
      setSaveStatus('Sauvegarde indisponible — téléchargez votre Markdown')
      setRestored(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!restored || !storageAvailable) return
    let cancelled = false
    setSaveStatus('Enregistrement…')
    saveSession({ markdown, fileName, folderName, documents, activeDocumentPath,
      assets, settings }).then(() => {
      if (!cancelled) setSaveStatus('Enregistré dans ce navigateur')
    }).catch(() => {
      if (!cancelled) setSaveStatus('Échec de sauvegarde — téléchargez votre Markdown')
    })
    return () => { cancelled = true }
  }, [restored, storageAvailable, markdown, fileName, folderName, documents, activeDocumentPath, assets, settings])

  useEffect(() => () => {
    for (const url of assetUrlsRef.current.values()) URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    if (!exportPending || renderedRequest !== exportRequest || previewStatus === 'rendering') return
    if (previewStatus === 'error') {
      setExportError('Export interrompu : corrigez les erreurs signalées dans l’aperçu, puis réessayez.')
      setExportPending(false)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const title = document.title
      document.title = fileName.split('/').at(-1)?.replace(/\.(md|markdown)$/i, '') || 'Papier'
      try { window.print() } finally { document.title = title; setExportPending(false) }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [exportPending, previewStatus, renderedRequest, exportRequest, fileName])

  const handleStatusChange = useCallback((status: PreviewStatus, request: number) => {
    setRenderedRequest(request)
    setPreviewStatus(status)
  }, [])

  const handleFile = async (file: File) => {
    if (!/\.(md|markdown)$/i.test(file.name) && file.type !== 'text/markdown') {
      window.alert('Veuillez sélectionner un fichier Markdown (.md).')
      return
    }

    try {
      const content = await file.text()
      clearWorkspace()
      setMarkdown(content)
      setFileName(file.name)
      setMobilePanel('editor')
    } catch { window.alert('Impossible de lire ce fichier.') }
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

    setAnchor(undefined)
    setNavigationError('')
    setActiveDocumentPath(document.path)
    setMarkdown(document.content)
    setFileName(document.path)
  }

  const handleNavigateLink = (href: string): boolean => {
    if (href.startsWith('#')) {
      setAnchor(current => ({ hash: href, sequence: (current?.sequence || 0) + 1 }))
      return true
    }
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)) return false
    const path = resolveRelativePath(activeDocumentPath || fileName, href)
    let linkPath = href.split(/[?#]/, 1)[0]
    try { linkPath = decodeURIComponent(linkPath) } catch { /* Keep malformed paths literal. */ }
    if (!/\.(md|markdown)$/i.test(path || linkPath)) return false
    const exact = documents.find(document => document.path === path)
    const matches = documents.filter(document => document.path.toLowerCase() === path?.toLowerCase())
    const target = exact || (matches.length === 1 ? matches[0] : undefined)
    if (!target) {
      setNavigationError(`Document introuvable dans le dossier : ${path || href}`)
      return true
    }
    handleDocumentSelect(target.path)
    setAnchor(current => ({ hash: href.includes('#') ? href.slice(href.indexOf('#')) : '', sequence: (current?.sequence || 0) + 1 }))
    return true
  }

  const handleMarkdownChange = (content: string) => {
    setExportError('')
    setMarkdown(content)
    if (!activeDocumentPath) return

    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.path === activeDocumentPath ? { ...document, content } : document
    )))
  }

  if (!restored) return <p role="status">Restauration de votre espace de travail…</p>

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
        appearance={appearance}
        onToggleAppearance={toggleAppearance}
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
        onDownload={() => {
          const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
          const link = document.createElement('a')
          link.href = url
          link.download = fileName.split('/').at(-1) || 'document.md'
          link.click()
          window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        }}
        onExport={() => {
          setExportError('')
          setExportRequest((request) => request + 1)
          setMobilePanel('preview')
          setExportPending(true)
        }}
      />

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,text/markdown,text/plain"
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

      {navigationError && <div className="navigation-error" role="alert">{navigationError}<button type="button" onClick={() => setNavigationError('')}>Fermer</button></div>}
      {exportError && <div className="export-error" role="alert">{exportError}</div>}
      <nav className="mobile-tabs" aria-label="Choix du panneau">
        <button type="button" className={mobilePanel === 'editor' ? 'active' : ''} onClick={() => setMobilePanel('editor')}>Markdown</button>
        <button type="button" className={mobilePanel === 'preview' ? 'active' : ''} onClick={() => setMobilePanel('preview')}>Aperçu</button>
      </nav>

      <main className={`workspace mobile-${mobilePanel}`}>
        <EditorPanel documentKey={activeDocumentPath ?? fileName} saveStatus={saveStatus} markdown={markdown} onChange={handleMarkdownChange} />
        <PreviewPanel
          documentKey={activeDocumentPath ?? fileName}
          anchor={anchor}
          onNavigateLink={handleNavigateLink}
          markdown={markdown}
          exportRequest={exportRequest}
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
