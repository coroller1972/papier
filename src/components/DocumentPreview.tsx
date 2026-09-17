import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { renderMarkdown, renderMermaidDiagrams } from '../lib/markdown'
import { resolveLocalImages } from '../lib/localWorkspace'
import { paginate, pageMetrics } from '../lib/pagination'
import '../paper.css'
import { applyTypography, loadTypography } from '../lib/typography'
import type { DocumentSettings, PreviewStatus } from '../types'

interface DocumentPreviewProps {
  documentKey: string
  anchor?: { hash: string; sequence: number }
  onNavigateLink: (href: string) => boolean
  exportRequest: number
  markdown: string
  settings: DocumentSettings
  documentPath?: string
  assetUrls: ReadonlyMap<string, string>
  onStatusChange: (status: PreviewStatus, request: number) => void
}

export const DocumentPreview = memo(function DocumentPreview({
  documentKey, anchor, onNavigateLink, exportRequest, markdown, settings, documentPath, assetUrls, onStatusChange,
}: DocumentPreviewProps) {
  const pagesRef = useRef<HTMLDivElement>(null)
  const scaleRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const handledAnchor = useRef<typeof anchor>(undefined)
  const committedDocument = useRef<string | undefined>(undefined)
  const [availableWidth, setAvailableWidth] = useState(0)
  const [pagesSize, setPagesSize] = useState({ width: 0, height: 0 })
  const [pageCount, setPageCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const html = useMemo(() => renderMarkdown(markdown), [markdown])
  const { format, margins, theme, typography } = settings
  const pageWidth = pagesSize.width || pageMetrics(settings).width * 96 / 25.4
  const scale = Math.min(settings.zoom / 100, availableWidth > 0 ? availableWidth / pageWidth : 1)

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && !window.matchMedia('print').matches) {
        setAvailableWidth(entry.contentRect.width)
      }
    })
    observer.observe(scroller)
    const pagesObserver = new ResizeObserver(([entry]) => {
      if (!window.matchMedia('print').matches) {
        setPagesSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    if (pagesRef.current) pagesObserver.observe(pagesRef.current)
    let printPosition = 0
    const beforePrint = () => { printPosition = scroller.scrollTop; scroller.scrollTo({ top: 0, left: 0 }) }
    const afterPrint = () => scroller.scrollTo({ top: printPosition })
    window.addEventListener('beforeprint', beforePrint)
    window.addEventListener('afterprint', afterPrint)
    return () => { observer.disconnect(); pagesObserver.disconnect(); window.removeEventListener('beforeprint', beforePrint); window.removeEventListener('afterprint', afterPrint) }
  }, [])

  useEffect(() => {
    const target = pagesRef.current
    if (!target) return
    const controller = new AbortController()
    setBusy(true)
    setError('')
    onStatusChange('rendering', exportRequest)
    const source = document.createElement('article')
    source.className = `paper-content theme-${theme}`
    source.innerHTML = html
    applyTypography(source, typography)
    source.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(link => {
      if (/^(https?:)?\/\//i.test(link.getAttribute('href') || '')) {
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
      }
    })
    const metrics = pageMetrics({ format, margins, theme, typography, zoom: 100 })
    const measurement = document.createElement('div')
    measurement.className = 'pagination-staging'
    measurement.style.width = `${metrics.width - 2 * metrics.horizontal}mm`
    measurement.setAttribute('aria-hidden', 'true')
    measurement.append(source)
    document.body.append(measurement)

    // Debounce typing; an explicit export always checks the current content.
    const timer = window.setTimeout(async () => {
      try {
        const results = await Promise.allSettled([
          loadTypography(typography),
          renderMermaidDiagrams(source, controller.signal),
          resolveLocalImages(source, documentPath, assetUrls, controller.signal),
        ])
        if (controller.signal.aborted) return
        const hasError = results.some((result) => result.status === 'rejected')
        const maxHeight = (metrics.height - 2 * metrics.vertical) * 96 / 25.4 - 2
        for (const media of source.querySelectorAll<HTMLElement>('img, svg')) {
          media.style.maxHeight = `${maxHeight}px`
          media.style.objectFit = 'contain'
          // Paged.js treats inline-styled media without an explicit display as hidden.
          media.style.display = 'block'
        }
        const count = await paginate(source, target, { format, margins, theme, typography, zoom: 100 }, controller.signal, () => {
          const scroller = scrollerRef.current
          const oldPages = Array.from(target.querySelectorAll<HTMLElement>('.pagedjs_page'))
          const top = scroller?.getBoundingClientRect().top || 0
          const index = committedDocument.current === documentKey
            ? Math.max(0, oldPages.findIndex(page => page.getBoundingClientRect().bottom > top + 40)) : 0
          const rectangle = oldPages[index]?.getBoundingClientRect()
          const offset = committedDocument.current === documentKey && rectangle
            ? (top - rectangle.top) / rectangle.height : 0
          return () => {
            // Update the scroll extent before restoring the position. The visual
            // transform must never change the layout already measured by Paged.js.
            if (scaleRef.current) {
              const visualScale = target.offsetWidth ? target.getBoundingClientRect().width / target.offsetWidth : 1
              scaleRef.current.style.height = `${target.offsetHeight * visualScale}px`
            }
            const pages = target.querySelectorAll<HTMLElement>('.pagedjs_page')
            const nextIndex = Math.min(index, Math.max(0, pages.length - 1))
            const page = pages[nextIndex]
            if (scroller && page) {
              const box = page.getBoundingClientRect()
              scroller.scrollTop += box.top - scroller.getBoundingClientRect().top + offset * box.height
            }
            committedDocument.current = documentKey
            setCurrentPage(nextIndex + 1)
          }
        })
        if (controller.signal.aborted) return
        setPageCount(count)
        if (hasError) setError('Une police, une image ou un diagramme ne peut pas être rendu. Corrigez le document avant l’export.')
        setBusy(false)
        onStatusChange(hasError ? 'error' : 'ready', exportRequest)
      } catch {
        if (!controller.signal.aborted) {
          setError('Impossible de paginer ce document. Modifiez le contenu pour réessayer.')
          setBusy(false)
          onStatusChange('error', exportRequest)
        }
      } finally {
        measurement.remove()
      }
    }, 180)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
      measurement.remove()
    }
  }, [assetUrls, documentPath, documentKey, html, onStatusChange, exportRequest, format, margins, theme, typography])

  useEffect(() => {
    if (busy || !anchor?.hash || handledAnchor.current === anchor || committedDocument.current !== documentKey) return
    handledAnchor.current = anchor
    let id = anchor.hash.replace(/^#/, '')
    try { id = decodeURIComponent(id) } catch { /* Keep malformed fragments literal. */ }
    const element = pagesRef.current?.querySelector<HTMLElement>(`.paper-content [id="${CSS.escape(id)}"], .paper-content [data-id="${CSS.escape(id)}"]`)
    const scroller = scrollerRef.current
    if (element && scroller) scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20
  }, [anchor, busy, documentKey])

  const goTo = (page: number) => {
    const scroller = scrollerRef.current
    const element = pagesRef.current?.querySelectorAll<HTMLElement>('.pagedjs_page')[page - 1]
    if (!scroller || !element) return
    scroller.scrollTo({ top: scroller.scrollTop + element.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20 })
    setCurrentPage(page)
  }

  return (
    <div className="paginated-preview">
      <nav className="page-navigation" aria-label="Navigation des pages">
        <button type="button" disabled={busy || currentPage <= 1} onClick={() => goTo(currentPage - 1)} aria-label="Page précédente">←</button>
        <label>Page <select aria-label="Page à afficher" disabled={busy || !pageCount} value={currentPage} onChange={event => goTo(Number(event.target.value))}>
          {Array.from({ length: Math.max(1, pageCount) }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
        </select> sur {pageCount || '…'}</label>
        <button type="button" disabled={busy || currentPage >= pageCount} onClick={() => goTo(currentPage + 1)} aria-label="Page suivante">→</button>
        <span role="status">{busy ? 'Pagination…' : `${pageCount} page${pageCount > 1 ? 's' : ''}`}</span>
      </nav>
      {error && <p className="pagination-error" role="alert">{error}</p>}
      <div className="preview-scroller" ref={scrollerRef} onScroll={() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        const top = scroller.getBoundingClientRect().top
        const pages = Array.from(pagesRef.current?.querySelectorAll('.pagedjs_page') || [])
        const index = pages.findIndex(page => page.getBoundingClientRect().bottom > top + 40)
        if (index >= 0) setCurrentPage(index + 1)
      }}>
        <div ref={scaleRef} className="paginated-scale" style={{ width: pageWidth * scale, height: pagesSize.height * scale }}>
          <div ref={pagesRef} id="print-document" className="paginated-pages" onClick={event => {
            const link = (event.target as Element).closest('a[href]')
            if (link && onNavigateLink(link.getAttribute('href') || '')) event.preventDefault()
          }} aria-busy={busy} style={{ transform: `scale(${scale})` }} />
        </div>
      </div>
    </div>
  )
})
