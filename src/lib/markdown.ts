import DOMPurify from 'dompurify'
import { Marked, Renderer } from 'marked'

// Top-level tokens carry their 1-based source line so the preview can be linked to the editor.
type LineToken = { line?: number }
const lineAttribute = (token: object) => {
  const line = (token as LineToken).line
  return line ? ` data-source-line="${line}"` : ''
}

const renderer = new Renderer()
const defaults = new Renderer()
const headingCounts = new Map<string, number>()
renderer.heading = function (token) {
  const { tokens, text, depth } = token
  const slug = text.replace(/<[^>]*>/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
  const count = headingCounts.get(slug) || 0
  headingCounts.set(slug, count + 1)
  const id = count ? `${slug}-${count}` : slug
  return `<h${depth} id="${id}"${lineAttribute(token)}>${this.parser.parseInline(tokens)}</h${depth}>`
}
renderer.html = ({ text }) => text.trim() === '<!-- pagebreak -->'
  ? '<div class="manual-page-break"></div>'
  : text

renderer.code = token => {
  const { text, lang } = token
  if (lang?.trim().toLowerCase() === 'mermaid') {
    const source = encodeURIComponent(text)
    return `<div class="mermaid-diagram"${lineAttribute(token)} data-mermaid-source="${source}"><div class="diagram-loading">Construction du diagramme…</div></div>`
  }

  const languageClass = lang ? ` class="language-${lang.replace(/[^a-z0-9_-]/gi, '')}"` : ''
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

  return `<pre${lineAttribute(token)}><code${languageClass}>${escaped}</code></pre>`
}

for (const name of ['paragraph', 'blockquote', 'list', 'table', 'hr'] as const) {
  const base = defaults[name] as (this: Renderer, token: LineToken) => string
  renderer[name] = function (this: Renderer, token: never) {
    return base.call(this, token).replace(/^<(\w+)/, `<$1${lineAttribute(token)}`)
  } as never
}

const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer,
})

export function renderMarkdown(markdown: string): string {
  headingCounts.clear()
  const tokens = parser.lexer(markdown)
  let line = 1
  for (const token of tokens) {
    ;(token as LineToken).line = line
    line += token.raw.split('\n').length - 1
  }
  const rawHtml = parser.parser(tokens)

  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-mermaid-source', 'data-source-line'],
  })
}

let renderSequence = 0
const svgCache = new Map<string, string>()
const inFlight = new Map<string, Promise<string>>()
let cachedBytes = 0
let engineInitialized = false
const cacheStats = { hits: 0, renders: 0 }
export function getMermaidCacheStats() { return { ...cacheStats, entries: svgCache.size, bytes: cachedBytes } }

function rememberSvg(source: string, svg: string) {
  if (svg.length > 2_000_000) return
  svgCache.set(source, svg)
  cachedBytes += source.length + svg.length
  while (svgCache.size > 40 || cachedBytes > 4_000_000) {
    const oldest = svgCache.keys().next().value!
    cachedBytes -= oldest.length + svgCache.get(oldest)!.length
    svgCache.delete(oldest)
  }
}

// Every placement receives distinct SVG ids, including two identical diagrams.
function placeSvg(container: HTMLElement, svg: string, prefix: string) {
  // A span is cloned atomically by Paged.js; raw SVG children must not be split.
  container.innerHTML = `<span class="diagram-vector">${svg}</span>`
  const ids = new Map<string, string>()
  container.querySelectorAll('[id]').forEach((element, index) => {
    ids.set(element.id, `${prefix}-${index}`)
  })
  for (const element of container.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      let value = attribute.value
      if (attribute.name === 'id') value = ids.get(value) || value
      else if (attribute.name === 'aria-labelledby' || attribute.name === 'aria-describedby') value = value.split(' ').map(id => ids.get(id) || id).join(' ')
      else {
        value = value.replace(/url\(#([^)]*)\)/g, (match, id) => ids.has(id) ? `url(#${ids.get(id)})` : match)
        if ((attribute.name === 'href' || attribute.name === 'xlink:href') && value.startsWith('#')) value = `#${ids.get(value.slice(1)) || value.slice(1)}`
      }
      element.setAttribute(attribute.name, value)
    }
    if (element.tagName.toLowerCase() === 'style') {
      element.textContent = element.textContent?.replace(/#([\w-]+)/g, (match, id) => ids.has(id) ? `#${ids.get(id)}` : match) || ''
    }
  }
}

export async function renderMermaidDiagrams(
  container: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const diagrams = Array.from(
    container.querySelectorAll<HTMLElement>('[data-mermaid-source]'),
  )

  if (diagrams.length === 0) return

  const { default: mermaid } = await import('mermaid')

  if (!engineInitialized) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: 'base',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    flowchart: {
      curve: 'basis',
      htmlLabels: true,
      useMaxWidth: false,
    },
    themeVariables: {
      primaryColor: '#edf4ff',
      primaryTextColor: '#182234',
      primaryBorderColor: '#2563d9',
      lineColor: '#2563d9',
      secondaryColor: '#f6f8fb',
      tertiaryColor: '#ffffff',
      edgeLabelBackground: '#ffffff',
      fontSize: '14px',
    },
  })

  engineInitialized = true
  }

  const failures: string[] = []

  for (const [index, diagram] of diagrams.entries()) {
    if (signal.aborted) return

    const encodedSource = diagram.dataset.mermaidSource
    if (!encodedSource) continue

    const source = decodeURIComponent(encodedSource)
    const id = `papier-diagram-${renderSequence++}-${index}`

    try {
      let svg = svgCache.get(source)
      if (svg) {
        cacheStats.hits++
        svgCache.delete(source)
        svgCache.set(source, svg)
      } else {
        let rendering = inFlight.get(source)
        if (!rendering) {
          cacheStats.renders++
          rendering = mermaid.render(id, source).then(result => {
            rememberSvg(source, result.svg)
            return result.svg
          }).finally(() => inFlight.delete(source))
          inFlight.set(source, rendering)
        }
        svg = await rendering
      }
      if (signal.aborted || !diagram.isConnected) return

      // Mermaid's strict security level sanitizes label content before returning
      // the SVG. Keeping its foreignObject labels intact avoids stripping the
      // readable node names during a second SVG-only sanitization pass.
      placeSvg(diagram, svg, id)
      diagram.removeAttribute('data-mermaid-source')

      const svgElement = diagram.querySelector('svg')
      const viewBox = svgElement?.getAttribute('viewBox')?.split(/\s+/).map(Number)
      if (svgElement && viewBox?.length === 4) {
        const [, , viewWidth, viewHeight] = viewBox
        // A mobile tab may render while its panel is hidden, in which case its
        // measured width is zero. Use the printable content width as fallback.
        const availableWidth = diagram.clientWidth || 650
        const scale = Math.min(1, availableWidth / viewWidth, 650 / viewHeight)
        svgElement.setAttribute('width', `${Math.round(viewWidth * scale)}`)
        svgElement.setAttribute('height', `${Math.round(viewHeight * scale)}`)
        svgElement.style.removeProperty('max-width')
      }

    } catch (error) {
      document.getElementById(`d${id}`)?.remove()
      if (signal.aborted || !diagram.isConnected) return

      const message = error instanceof Error ? error.message.trim() : 'Syntaxe invalide'
      diagram.innerHTML = ''
      diagram.classList.add('diagram-error')

      const title = document.createElement('strong')
      title.textContent = 'Le diagramme Mermaid contient une erreur.'
      // Keep Mermaid's full message: the lines after "Parse error on line N:" show the
      // offending excerpt and what the parser expected.
      const detail = document.createElement('span')
      detail.textContent = message
      diagram.append(title, detail)
      const fenceLine = Number(diagram.dataset.sourceLine)
      // Mermaid reports "line N" relative to the diagram; the fence opens on fenceLine.
      const target = fenceLine ? fenceLine + Number(/line (\d+)/i.exec(message)?.[1] ?? 0) : 0
      const summary = message.split('\n')[0].replace(/:$/, '')
      failures.push(target ? `ligne ${target} (${summary})` : summary)
      if (target) {
        const jump = document.createElement('button')
        jump.type = 'button'
        jump.className = 'diagram-error-goto'
        jump.dataset.gotoLine = String(target)
        jump.textContent = `Aller à la ligne ${target}`
        diagram.append(jump)
      }
      diagram.removeAttribute('data-mermaid-source')
    }
  }

  if (failures.length) {
    throw new Error(failures.join(', '))
  }
}
