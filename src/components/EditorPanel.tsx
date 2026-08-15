import { useMemo, useRef } from 'react'

interface EditorPanelProps {
  markdown: string
  onChange: (value: string) => void
}

export function EditorPanel({ markdown, onChange }: EditorPanelProps) {
  const lineNumbers = useMemo(
    () => Array.from({ length: markdown.split('\n').length }, (_, index) => index + 1),
    [markdown],
  )
  const gutterRef = useRef<HTMLDivElement>(null)

  return (
    <section className="editor-panel" aria-label="Éditeur Markdown">
      <div className="editor-heading">
        <span>Markdown</span>
        <span className="editor-help">Markdown + Mermaid</span>
      </div>
      <div className="editor-body">
        <div className="line-numbers" ref={gutterRef} aria-hidden="true">
          {lineNumbers.map((line) => <span key={line}>{line}</span>)}
        </div>
        <textarea
          aria-label="Contenu Markdown"
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => {
            if (gutterRef.current) gutterRef.current.scrollTop = event.currentTarget.scrollTop
          }}
          spellCheck="false"
        />
      </div>
      <footer className="editor-footer">
        <span>{markdown.split('\n').length} lignes · {markdown.length.toLocaleString('fr-FR')} caractères</span>
        <span className="autosave"><i /> Enregistré localement</span>
      </footer>
    </section>
  )
}
