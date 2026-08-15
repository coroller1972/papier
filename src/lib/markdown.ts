import DOMPurify from 'dompurify'
import { Marked, Renderer } from 'marked'

const renderer = new Renderer()

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
  const rawHtml = parser.parse(markdown, { async: false }) as string

  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-mermaid-source'],
  })
}

let renderSequence = 0

export async function renderMermaidDiagrams(
  container: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const diagrams = Array.from(
    container.querySelectorAll<HTMLElement>('[data-mermaid-source]'),
  )

  if (diagrams.length === 0) return

  const { default: mermaid } = await import('mermaid')

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

  let hasError = false

  for (const [index, diagram] of diagrams.entries()) {
    if (signal.aborted) return

    const encodedSource = diagram.dataset.mermaidSource
    if (!encodedSource) continue

    const source = decodeURIComponent(encodedSource)
    const id = `papier-diagram-${renderSequence++}-${index}`

    try {
      const { svg, bindFunctions } = await mermaid.render(id, source)
      if (signal.aborted || !diagram.isConnected) return

      // Mermaid's strict security level sanitizes label content before returning
      // the SVG. Keeping its foreignObject labels intact avoids stripping the
      // readable node names during a second SVG-only sanitization pass.
      diagram.innerHTML = svg
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

      bindFunctions?.(diagram)
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
