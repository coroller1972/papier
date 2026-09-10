import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import type { Extension } from '@codemirror/state'
import { Annotation, EditorSelection, EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { markdown as markdownLanguage } from '@codemirror/lang-markdown'
import { openSearchPanel, search } from '@codemirror/search'
import { isolateHistory } from '@codemirror/commands'

interface EditorPanelProps {
  saveStatus: string
  markdown: string
  documentKey: string
  onChange: (value: string) => void
}

const externalChange = Annotation.define<boolean>()

function surround(view: EditorView, before: string, after = before, placeholder = 'texte') {
  const { from, to } = view.state.selection.main
  const selected = view.state.sliceDoc(from, to)
  const content = selected || placeholder
  const alreadyWrapped = from >= before.length && view.state.sliceDoc(from - before.length, from) === before
    && view.state.sliceDoc(to, to + after.length) === after
  view.dispatch(alreadyWrapped ? {
    changes: [{ from: from - before.length, to: from, insert: '' }, { from: to, to: to + after.length, insert: '' }],
    selection: EditorSelection.range(from - before.length, to - before.length),
    annotations: isolateHistory.of('full'),
  } : {
    changes: { from, to, insert: before + content + after },
    selection: EditorSelection.range(from + before.length, from + before.length + content.length),
    annotations: isolateHistory.of('full'),
  })
  view.focus()
  return true
}

function prefixLines(view: EditorView, prefix: string) {
  const { from, to } = view.state.selection.main
  const first = view.state.doc.lineAt(from)
  const last = view.state.doc.lineAt(to > from ? to - 1 : to)
  const lines = view.state.sliceDoc(first.from, last.to).split('\n')
  const remove = lines.every(line => line.startsWith(prefix))
  view.dispatch({ changes: { from: first.from, to: last.to, insert: lines.map(line => remove ? line.slice(prefix.length) : prefix + line).join('\n') }, annotations: isolateHistory.of('full') })
  view.focus()
  return true
}

const commands = {
  bold: (view: EditorView) => surround(view, '**'),
  italic: (view: EditorView) => surround(view, '*'),
  link: (view: EditorView) => surround(view, '[', '](https://)', 'libellé'),
  heading: (view: EditorView) => prefixLines(view, '## '),
  list: (view: EditorView) => prefixLines(view, '- '),
  quote: (view: EditorView) => prefixLines(view, '> '),
  code: (view: EditorView) => surround(view, '`'),
  pageBreak: (view: EditorView) => {
    const { from, to } = view.state.selection.main
    const marker = '\n\n<!-- pagebreak -->\n\n'
    view.dispatch({ changes: { from, to, insert: marker }, selection: { anchor: from + marker.length }, annotations: isolateHistory.of('full') })
    view.focus()
    return true
  },
}

const phrases = {
  Find: 'Rechercher', Replace: 'Remplacer par', next: 'Suivant', previous: 'Précédent', all: 'Tout sélectionner',
  'match case': 'Respecter la casse', regexp: 'Expression régulière', 'by word': 'Mot entier',
  replace: 'Remplacer', 'replace all': 'Tout remplacer', close: 'Fermer la recherche',
}

export function EditorPanel({ markdown, onChange, saveStatus, documentKey }: EditorPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const extensionsRef = useRef<Extension[]>([])
  const viewRef = useRef<EditorView | null>(null)
  const changeRef = useRef(onChange)
  const initialValue = useRef(markdown)
  // Keep editor extensions stable while forwarding changes to the current document.
  useEffect(() => { changeRef.current = onChange }, [onChange])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    extensionsRef.current = [
      basicSetup, markdownLanguage(), search({ top: true }), EditorState.phrases.of(phrases),
      EditorView.contentAttributes.of({ 'aria-label': 'Contenu Markdown', spellcheck: 'false' }),
      EditorView.lineWrapping,
      Prec.highest(keymap.of([
        { key: 'Mod-b', run: commands.bold }, { key: 'Mod-i', run: commands.italic },
        { key: 'Mod-k', run: commands.link }, { key: 'Mod-Shift-h', run: commands.heading },
      ])),
      EditorView.updateListener.of(update => {
        if (update.docChanged && !update.transactions.some(transaction => transaction.annotation(externalChange))) {
          changeRef.current(update.state.doc.toString())
        }
      }),
    ]
    const view = new EditorView({
      parent: host,
      state: EditorState.create({
        doc: initialValue.current,
        extensions: extensionsRef.current,
      }),
    })
    viewRef.current = view
    return () => { view.destroy(); viewRef.current = null }
  }, [])

  const previousKey = useRef(documentKey)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    if (previousKey.current !== documentKey) {
      previousKey.current = documentKey
      // Start a fresh undo history when switching documents.
      view.setState(EditorState.create({ doc: markdown, extensions: extensionsRef.current }))
    }
    if (view.state.doc.toString() !== markdown) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: markdown }, annotations: externalChange.of(true) })
    }
  }, [markdown, documentKey])

  const run = (command: (view: EditorView) => unknown) => { if (viewRef.current) command(viewRef.current) }
  return (
    <section className="editor-panel" aria-label="Éditeur Markdown">
      <div className="editor-heading"><span>Markdown</span><button className="page-break-button" type="button" onClick={() => run(commands.pageBreak)}>Insérer un saut de page</button></div>
      <div className="editor-toolbar" role="toolbar" aria-label="Mise en forme Markdown">
        <button type="button" title="Gras (⌘/Ctrl+B)" aria-label="Gras" onClick={() => run(commands.bold)}><strong>B</strong></button>
        <button type="button" title="Italique (⌘/Ctrl+I)" aria-label="Italique" onClick={() => run(commands.italic)}><em>I</em></button>
        <button type="button" title="Titre (⌘/Ctrl+Maj+H)" aria-label="Titre" onClick={() => run(commands.heading)}>H2</button>
        <button type="button" title="Lien (⌘/Ctrl+K)" onClick={() => run(commands.link)}>Lien</button>
        <button type="button" onClick={() => run(commands.list)}>Liste</button>
        <button type="button" onClick={() => run(commands.quote)}>Citation</button>
        <button type="button" onClick={() => run(commands.code)}>Code</button>
        <button type="button" title="Rechercher / remplacer (⌘/Ctrl+F)" onClick={() => run(openSearchPanel)}>Rechercher / remplacer</button>
      </div>
      <div className="code-editor" ref={hostRef} />
      <footer className="editor-footer">
        <span>{markdown.split('\n').length} lignes · {markdown.length.toLocaleString('fr-FR')} caractères</span>
        <span className="autosave" role="status">{saveStatus}</span>
      </footer>
    </section>
  )
}
