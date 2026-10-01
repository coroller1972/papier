import { useEffect, useRef, useState } from 'react'
import { SAMPLE_MARKDOWN } from '../data/sample'
import { loadStoredDocument } from '../lib/initialState'
import { importLocalWorkspace, resolveRelativePath } from '../lib/localWorkspace'
import { loadSession, saveSession } from '../lib/session'
import { restoreSettings } from '../lib/typography'
import type { DocumentSettings, WorkspaceDocument } from '../types'

const EXAMPLE_FILE_NAME = 'processus-publication.md'

interface WorkspaceOptions {
  settings: DocumentSettings
  onSettingsRestored: (settings: DocumentSettings) => void
  onDocumentOpened: () => void
}

// Documents, folder, local images and navigation between them, persisted in the browser.
export function useWorkspace({ settings, onSettingsRestored, onDocumentOpened }: WorkspaceOptions) {
  const [markdown, setMarkdown] = useState(loadStoredDocument)
  const [fileName, setFileName] = useState(EXAMPLE_FILE_NAME)
  const [folderName, setFolderName] = useState<string>()
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([])
  const [activeDocumentPath, setActiveDocumentPath] = useState<string>()
  const [assets, setAssets] = useState<ReadonlyMap<string, File>>(new Map())
  const [assetUrls, setAssetUrls] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [anchor, setAnchor] = useState<{ hash: string; sequence: number }>()
  const [navigationError, setNavigationError] = useState('')
  const [restored, setRestored] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [saveStatus, setSaveStatus] = useState('Chargement…')
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
        onSettingsRestored(restoreSettings(session.settings))
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openFile = async (file: File) => {
    if (!/\.(md|markdown)$/i.test(file.name) && file.type !== 'text/markdown') {
      window.alert('Veuillez sélectionner un fichier Markdown (.md).')
      return
    }

    try {
      const content = await file.text()
      clearWorkspace()
      setMarkdown(content)
      setFileName(file.name)
      onDocumentOpened()
    } catch { window.alert('Impossible de lire ce fichier.') }
  }

  const openFolder = async (files: File[]) => {
    try {
      const workspace = await importLocalWorkspace(files)
      const firstDocument = workspace.documents[0]

      replaceAssetUrls(workspace.assets)
      setFolderName(workspace.name)
      setDocuments(workspace.documents)
      setActiveDocumentPath(firstDocument.path)
      setMarkdown(firstDocument.content)
      setFileName(firstDocument.path)
      onDocumentOpened()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible d’ouvrir ce dossier.'
      window.alert(message)
    }
  }

  const openExample = () => {
    clearWorkspace()
    setMarkdown(SAMPLE_MARKDOWN)
    setFileName(EXAMPLE_FILE_NAME)
  }

  const selectDocument = (path: string) => {
    const document = documents.find((candidate) => candidate.path === path)
    if (!document) return

    setAnchor(undefined)
    setNavigationError('')
    setActiveDocumentPath(document.path)
    setMarkdown(document.content)
    setFileName(document.path)
  }

  // Returns true when the link was handled in the app (anchor or workspace document).
  const navigateLink = (href: string): boolean => {
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
    selectDocument(target.path)
    setAnchor(current => ({ hash: href.includes('#') ? href.slice(href.indexOf('#')) : '', sequence: (current?.sequence || 0) + 1 }))
    return true
  }

  const changeMarkdown = (content: string) => {
    setMarkdown(content)
    if (!activeDocumentPath) return

    setDocuments((currentDocuments) => currentDocuments.map((document) => (
      document.path === activeDocumentPath ? { ...document, content } : document
    )))
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([markdown], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = fileName.split('/').at(-1) || 'document.md'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return {
    restored, saveStatus, markdown, fileName, folderName, documents, activeDocumentPath, assetUrls, anchor,
    navigationError, dismissNavigationError: () => setNavigationError(''),
    openFile, openFolder, openExample, selectDocument, navigateLink, changeMarkdown, download,
  }
}
