import { Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { HtmlBlockView } from '../html-block-view';

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
        parseHTML: (element) => (element as HTMLElement).innerHTML ?? '',
        // No renderHTML mapping — we serialize via the node's renderHTML
        // below, which constructs a real DOM element so comments and MSO
        // markup survive byte-for-byte.
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-html-block]' }];
  },

  renderHTML({ node }) {
    const dom = document.createElement('div');
    dom.setAttribute('data-html-block', '');
    const raw = (node.attrs.rawHtml as string | null) ?? '';
    if (raw.length > 0) {
      dom.innerHTML = raw;
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
