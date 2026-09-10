import DOMPurify from 'dompurify'
import { Marked, Renderer } from 'marked'

const renderer = new Renderer()
const headingCounts = new Map<string, number>()
renderer.heading = function ({ tokens, text, depth }) {
  const slug = text.replace(/<[^>]*>/g, '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
  const count = headingCounts.get(slug) || 0
  headingCounts.set(slug, count + 1)
  const id = count ? `${slug}-${count}` : slug
  return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>`
}
renderer.html = ({ text }) => text.trim() === '<!-- pagebreak -->'
  ? '<div class="manual-page-break"></div>'
  : text

renderer.code = ({ text, lang }) => {
  if (lang?.trim().toLowerCase() === 'mermaid') {
    const source = encodeURIComponent(text)
    return `<div class="mermaid-diagram" data-mermaid-source="${source}"><div class="diagram-loading">Construction du diagramme…</div></div>`
  }

  const languageClass = lang ? ` class="language-${lang.replace(/[^a-z0-9_-]/gi, '')}"` : ''
  const escaped = text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

  return `<pre><code${languageClass}>${escaped}</code></pre>`
}

const parser = new Marked({
  gfm: true,
  breaks: false,
  renderer,
})

export function renderMarkdown(markdown: string): string {
  headingCounts.clear()
  const rawHtml = parser.parse(markdown, { async: false }) as string

  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-mermaid-source'],
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

  let hasError = false

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
      hasError = true
      document.getElementById(`d${id}`)?.remove()
      if (signal.aborted || !diagram.isConnected) return

      const message = error instanceof Error ? error.message.split('\n')[0] : 'Syntaxe invalide'
      diagram.innerHTML = ''
      diagram.classList.add('diagram-error')

      const title = document.createElement('strong')
      title.textContent = 'Le diagramme Mermaid contient une erreur.'
      const detail = document.createElement('span')
      detail.textContent = message
      diagram.append(title, detail)
      diagram.removeAttribute('data-mermaid-source')
    }
  }

  if (hasError) {
    throw new Error('Au moins un diagramme Mermaid contient une erreur.')
  }
}
