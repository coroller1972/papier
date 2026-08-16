import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown, renderMermaidDiagrams } from '../lib/markdown'
import { resolveLocalImages } from '../lib/localWorkspace'
import type { DocumentSettings, PreviewStatus } from '../types'

interface DocumentPreviewProps {
  markdown: string
  settings: DocumentSettings
  documentPath?: string
  assetUrls: ReadonlyMap<string, string>
  onStatusChange: (status: PreviewStatus) => void
}

export const DocumentPreview = memo(function DocumentPreview({
  markdown,
  settings,
  documentPath,
  assetUrls,
  onStatusChange,
}: DocumentPreviewProps) {
  const articleRef = useRef<HTMLElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [availableWidth, setAvailableWidth] = useState(0)
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  const pageWidth = settings.format === 'A4' ? 794 : 816
  const requestedScale = settings.zoom / 100
  const effectiveScale = availableWidth > 0
    ? Math.min(requestedScale, Math.max(0.35, availableWidth / pageWidth))
    : requestedScale

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const observer = new ResizeObserver(([entry]) => {
      setAvailableWidth(entry.contentRect.width)
    })
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const article = articleRef.current
    if (!article) return

    const controller = new AbortController()
    article.innerHTML = html
    onStatusChange('rendering')

    Promise.all([
      renderMermaidDiagrams(article, controller.signal),
      resolveLocalImages(article, documentPath, assetUrls, controller.signal),
    ])
      .then(() => {
        if (!controller.signal.aborted) onStatusChange('ready')
      })
      .catch(() => {
        if (!controller.signal.aborted) onStatusChange('error')
      })

    return () => controller.abort()
  }, [assetUrls, documentPath, html, onStatusChange])

  return (
    <div className="preview-scroller" ref={scrollerRef}>
      <div
        className={`page-scale format-${settings.format.toLowerCase()}`}
        style={{ '--preview-scale': effectiveScale } as React.CSSProperties}
      >
        <article
          ref={articleRef}
          id="print-document"
          className={`document-page margin-${settings.margins} theme-${settings.theme}`}
        />
      </div>
    </div>
  )
})
