'use client';

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { bracketMatching, indentOnInput } from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { useTheme } from '~/hooks/use-dark-mode';
import { chipDecorationsPlugin } from './html-block-chip-widget';

export type HtmlBlockCodeMirrorHandle = {
  insertAtCursor: (text: string) => void;
  focus: () => void;
};

type HtmlBlockCodeMirrorProps = {
  value: string;
  onChange: (next: string) => void;
  readOnly?: boolean;
  ref?: React.Ref<HtmlBlockCodeMirrorHandle>;
};

const composerHtmlBlockTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    backgroundColor: 'transparent',
  },
  '.cm-scroller': {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
    lineHeight: '1.55',
  },
  '.cm-content': {
    padding: '10px 12px',
    caretColor: 'var(--foreground)',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'color-mix(in srgb, var(--muted-foreground) 70%, transparent)',
    border: 'none',
    paddingRight: '6px',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 35%, transparent)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '&.cm-focused .cm-selectionBackground, ::selection, .cm-selectionBackground':
    {
      backgroundColor:
        'color-mix(in srgb, var(--primary) 25%, transparent) !important',
    },
  '.cm-line': {
    padding: '0 2px',
  },
  '&.cm-focused': {
    outline: 'none',
  },
});

export const HtmlBlockCodeMirror = ({
  value,
  onChange,
  readOnly,
  ref,
}: HtmlBlockCodeMirrorProps) => {
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const lastEmittedRef = useRef(value);
  // Capture initial value/readOnly so the mount callback has stable deps;
  // subsequent updates are reconciled via the effect below.
  const initialValueRef = useRef(value);
  const initialReadOnlyRef = useRef(readOnly);
  const { isDark } = useTheme();

  const containerRef = useCallback((element: HTMLDivElement | null) => {
    if (!element) {
      viewRef.current?.destroy();
      viewRef.current = null;
      return;
    }
    if (viewRef.current) return;

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        indentOnInput(),
        bracketMatching(),
        html({ matchClosingTags: true, autoCloseTags: true }),
        chipDecorationsPlugin,
        EditorView.lineWrapping,
        EditorState.readOnly.of(!!initialReadOnlyRef.current),
        composerHtmlBlockTheme,
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          const next = update.state.doc.toString();
          lastEmittedRef.current = next;
          onChangeRef.current(next);
        }),
      ],
    });

    viewRef.current = new EditorView({ state, parent: element });
  }, []);

  // Reconcile external value changes (undo/redo, remote collab). Compare
  // against the last value we emitted to avoid feedback loops where our
  // own onChange triggers a parent re-render that comes back as a "new"
  // value. CodeMirror ↔ React state sync is the canonical case where an
  // effect is the right tool.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastEmittedRef.current) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({
      changes: { from: 0, to: current.length, insert: value },
    });
    lastEmittedRef.current = value;
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor: (text: string) => {
        const view = viewRef.current;
        if (!view) return;
        const { from, to } = view.state.selection.main;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: from + text.length },
          scrollIntoView: true,
        });
        view.focus();
      },
      focus: () => viewRef.current?.focus(),
    }),
    [],
  );

  return (
    <div
      ref={containerRef}
      data-theme={isDark ? 'dark' : 'light'}
      className="html-block-cm"
    />
  );
};
