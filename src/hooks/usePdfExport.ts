import { useCallback, useEffect, useState } from 'react'
import type { PreviewStatus } from '../types'

// Printing waits for the preview to finish rendering the current content and is blocked on errors.
export function usePdfExport(fileName: string, onStart: () => void) {
  const [exportRequest, setExportRequest] = useState(0)
  const [renderedRequest, setRenderedRequest] = useState(-1)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('rendering')
  const [exportPending, setExportPending] = useState(false)
  const [exportError, setExportError] = useState('')

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

  const startExport = useCallback(() => {
    setExportError('')
    setExportRequest((request) => request + 1)
    onStart()
    setExportPending(true)
  }, [onStart])

  // Ctrl/Cmd+P must go through the same readiness checks as the export button.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'p') {
        event.preventDefault()
        if (!exportPending) startExport()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exportPending, startExport])

  const handleStatusChange = useCallback((status: PreviewStatus, request: number) => {
    setRenderedRequest(request)
    setPreviewStatus(status)
  }, [])

  const clearExportError = useCallback(() => setExportError(''), [])

  return { exportRequest, previewStatus, exportPending, exportError, startExport, handleStatusChange, clearExportError }
}
