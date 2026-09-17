import type { DocumentSettings } from '../types'
import paperStyles from '../paper.css?raw'

const paginationStats = { started: 0, completed: 0, cancelled: 0, pages: 0 }
export function getPaginationStats() { return { ...paginationStats } }

let queue: Promise<unknown> = Promise.resolve()
let disposePrevious: (() => void) | undefined

export function pageMetrics(settings: DocumentSettings) {
  const [width, height] = settings.format === 'A4' ? [210, 297] : [215.9, 279.4]
  const [vertical, horizontal] = settings.margins === 'compact' ? [14, 15]
    : settings.margins === 'wide' ? [23, 25] : [18, 19]
  return { width, height, vertical, horizontal }
}

function stabilizeTableColumns(source: HTMLElement) {
  for (const table of source.querySelectorAll('table')) {
    const header = table.tHead?.rows[0]
    if (!header) continue
    // Measure the complete table once. If each page recalculates its own widths
    // after rows are removed, text can reflow and push the last row off-page.
    const cells = Array.from(header.cells)
    const wrapping = cells.map(cell => cell.style.overflowWrap)
    // Keep short headings readable when their natural minimum widths fit.
    cells.forEach(cell => { cell.style.overflowWrap = 'normal' })
    let widths = cells.map(cell => cell.getBoundingClientRect().width)
    const fits = table.getBoundingClientRect().width <= source.getBoundingClientRect().width + 1
    cells.forEach((cell, index) => { cell.style.overflowWrap = wrapping[index] })
    if (!fits) widths = cells.map(cell => cell.getBoundingClientRect().width)
    const total = widths.reduce((sum, width) => sum + width, 0)
    if (!total) continue
    cells.forEach((cell, index) => {
      cell.style.width = `${widths[index] / total * 100}%`
      cell.style.display = 'table-cell'
    })
    table.style.tableLayout = 'fixed'
    table.style.display = 'table'
  }
}

// Paged.js inserts shared styles. Serialize renders and discard obsolete work
// before allowing a newer render to replace those styles and the visible pages.
export function paginate(source: HTMLElement, target: HTMLElement, settings: DocumentSettings, signal: AbortSignal, beforeCommit?: () => (() => void)): Promise<number> {
  const task = queue.then(async () => {
    if (signal.aborted) return 0
    const { Previewer } = await import('pagedjs')
    if (signal.aborted) return 0
    paginationStats.started++
    stabilizeTableColumns(source)
    const engine = new Previewer()
    // Throw at a page boundary: stop() alone restarts automatically in Paged.js.
    engine.chunker.hooks.beforePageLayout.register(() => signal.throwIfAborted())
    engine.chunker.hooks.afterPageLayout.register(() => { paginationStats.pages++; signal.throwIfAborted() })
    // Continuation tables are rebuilt without their header by Paged.js.
    // Insert it during layout, before measuring overflow, so its height counts.
    engine.chunker.hooks.renderNode.register((clone, original) => {
      const element = clone instanceof Element ? clone : clone.parentElement
      const table = element?.closest('table[data-split-from]')
      if (!table || table.querySelector('thead')) return
      const origin = original instanceof Element ? original : original.parentElement
      const header = origin?.closest('table')?.querySelector('thead')
      if (!header) return
      const repeated = header.cloneNode(true) as HTMLElement
      repeated.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'))
      repeated.removeAttribute('id')
      table.prepend(repeated)
    })
    const staging = document.createElement('div')
    staging.className = 'pagination-staging'
    staging.setAttribute('aria-hidden', 'true')
    document.body.append(staging)
    const { width, height, vertical, horizontal } = pageMetrics(settings)
    const css = `@page { size: ${width}mm ${height}mm; margin: ${vertical}mm ${horizontal}mm;
      @bottom-center { content: counter(page); font: 10px system-ui; color: #697386; }
    }\n${paperStyles}`
    let retained = false
    try {
      const flow = await engine.preview(source.outerHTML, [{ [location.href]: css }], staging)
      if (signal.aborted) return 0
      const finishCommit = beforeCommit?.()
      target.replaceChildren(...Array.from(staging.childNodes))
      disposePrevious?.()
      finishCommit?.()
      disposePrevious = () => { engine.polisher.destroy(); engine.chunker.destroy() }
      retained = true
      paginationStats.completed++
      return flow.total
    } finally {
      if (signal.aborted) paginationStats.cancelled++
      staging.remove()
      if (!retained) { engine.polisher.destroy(); engine.chunker.destroy() }
    }
  })
  queue = task.catch(() => {})
  return task
}
