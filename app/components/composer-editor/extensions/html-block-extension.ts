import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HtmlBlockView } from '../html-block-view';

// HTML attribute serialization only escapes `&` and `"` — `<` and `>` are
// left raw. That's fine for browser parsers (which are quote-aware) but
// breaks our server-side regex parser, which uses `[^>]*` to find the
// closing `>` of the open `<div data-html-block ...>` tag. Pre-encoding
// `<`/`>` here ensures the serialized attribute value contains no raw
// angle brackets, so the regex parser stays simple.
const encodeRawHtmlAttr = (s: string): string =>
  s.replace(/</g, '&lt;').replace(/>/g, '&gt;');

const decodeRawHtmlAttr = (s: string): string =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>');

export interface HtmlBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    htmlBlock: {
      insertHtmlBlock: (rawHtml?: string) => ReturnType;
    };
  }
}

export const HtmlBlockNode = Node.create<HtmlBlockOptions>({
  name: 'htmlBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  defining: true,
  isolating: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      rawHtml: {
        default: '',
        // Prefer the attribute payload (new format). Fall back to innerHTML
        // for legacy blocks saved before the data-raw-html migration.
        parseHTML: (element) => {
          const el = element as HTMLElement;
          const attr = el.getAttribute('data-raw-html');
          return attr !== null ? decodeRawHtmlAttr(attr) : (el.innerHTML ?? '');
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-html-block]' }];
  },

  renderHTML({ node }) {
    // Store the raw payload as a string attribute so the browser's HTML
    // parser never tries to interpret it as live markup. This is what
    // makes chips inside attribute values (e.g. <a href="<span ...>">)
    // round-trip byte-exactly — attribute storage encodes/decodes via
    // entity escaping rather than DOM tree construction.
    const dom = document.createElement('div');
    dom.setAttribute('data-html-block', '');
    const raw = (node.attrs.rawHtml as string | null) ?? '';
    if (raw.length > 0) {
      dom.setAttribute('data-raw-html', encodeRawHtmlAttr(raw));
    }
    return dom;
  },

  addNodeView() {
    return ReactNodeViewRenderer(HtmlBlockView);
  },

  addCommands() {
    return {
      insertHtmlBlock:
        (rawHtml = '') =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: { rawHtml },
            })
            .focus()
            .run(),
    };
  },
});
