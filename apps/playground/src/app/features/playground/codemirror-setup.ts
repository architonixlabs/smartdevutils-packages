// CodeMirror 6 setup. Loaded with a dynamic import so the editor is its own lazy chunk.
// Colours come from CSS custom properties, so the editor follows the app theme without reconfiguring.
import { autocompletion, closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { javascript } from '@codemirror/lang-javascript'
import {
  HighlightStyle,
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { highlightSelectionMatches, searchKeymap } from '@codemirror/search'
import { Compartment, EditorState, type Extension } from '@codemirror/state'
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  rectangularSelection,
} from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { SnippetLang } from '../../core/model'

export interface EditorOptions {
  doc: string
  lang: SnippetLang
  readOnly: boolean
  label: string
  onChange: (code: string) => void
  onRun: () => void
}

export interface EditorController {
  setDoc(code: string): void
  getDoc(): string
  setLang(lang: SnippetLang): void
  setReadOnly(ro: boolean): void
  setLabel(label: string): void
  focus(): void
  destroy(): void
}

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.controlKeyword, t.operatorKeyword], color: 'var(--code-keyword)' },
  { tag: [t.string, t.special(t.string), t.regexp], color: 'var(--code-string)' },
  { tag: [t.number, t.bool, t.null, t.atom], color: 'var(--code-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--code-comment)', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--code-function)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--code-type)' },
  { tag: [t.tagName], color: 'var(--code-tag)' },
  { tag: [t.attributeName, t.propertyName], color: 'var(--code-attr)' },
  { tag: [t.definition(t.variableName)], color: 'var(--code-def)' },
  { tag: [t.invalid], color: 'var(--danger)' },
])

const theme = EditorView.theme({
  '&': {
    color: 'var(--code-fg)',
    backgroundColor: 'var(--code-bg)',
    fontSize: '14px',
    height: '100%',
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.55' },
  '.cm-content': { caretColor: 'var(--accent)', padding: '10px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection':
    { backgroundColor: 'var(--code-selection) !important' },
  '.cm-gutters': {
    backgroundColor: 'var(--code-gutter-bg)',
    color: 'var(--code-gutter-fg)',
    border: 'none',
    borderRight: '1px solid var(--border)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--code-active-line)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--code-active-line)', color: 'var(--fg)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--code-bracket)',
    outline: '1px solid var(--accent)',
  },
  '.cm-searchMatch': { backgroundColor: 'var(--code-search)', outline: '1px solid var(--warn)' },
  '.cm-selectionMatch': { backgroundColor: 'var(--code-bracket)' },
  '.cm-panels': { backgroundColor: 'var(--surface)', color: 'var(--fg)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--border)' },
  '.cm-panel input, .cm-panel button, .cm-textfield': {
    font: 'inherit',
    color: 'var(--fg)',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border-strong)',
    borderRadius: '4px',
  },
  '.cm-button': { backgroundImage: 'none', backgroundColor: 'var(--surface-2)' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent)', color: 'var(--accent-fg)' },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--surface-2)', color: 'var(--muted)', border: 'none' },
})

function language(lang: SnippetLang): Extension {
  switch (lang) {
    case 'html':
      return html()
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'ts':
      return javascript({ typescript: true })
    case 'js':
      return javascript()
  }
}

export function createEditor(parent: HTMLElement, opts: EditorOptions): EditorController {
  const langC = new Compartment()
  const roC = new Compartment()
  const labelC = new Compartment()
  let silent = false

  const readOnlyExt = (ro: boolean) => [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)]
  const labelExt = (label: string) =>
    EditorView.contentAttributes.of({ 'aria-label': label, 'aria-describedby': 'pg-editor-help' })

  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.doc,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        syntaxHighlighting(highlight),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          {
            key: 'Mod-Enter',
            preventDefault: true,
            run: () => {
              opts.onRun()
              return true
            },
          },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          // Tab indents; Escape then Tab moves focus out (CodeMirror's built-in focus escape).
          indentWithTab,
        ]),
        theme,
        EditorView.lineWrapping,
        langC.of(language(opts.lang)),
        roC.of(readOnlyExt(opts.readOnly)),
        labelC.of(labelExt(opts.label)),
        EditorView.updateListener.of((u) => {
          if (u.docChanged && !silent) opts.onChange(u.state.doc.toString())
        }),
      ],
    }),
  })

  return {
    setDoc(code) {
      if (code === view.state.doc.toString()) return
      silent = true
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } })
      silent = false
    },
    getDoc: () => view.state.doc.toString(),
    setLang(lang) {
      view.dispatch({ effects: langC.reconfigure(language(lang)) })
    },
    setReadOnly(ro) {
      view.dispatch({ effects: roC.reconfigure(readOnlyExt(ro)) })
    },
    setLabel(label) {
      view.dispatch({ effects: labelC.reconfigure(labelExt(label)) })
    },
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
