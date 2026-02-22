import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { PromptRefBadge } from '../prompt-ref-badge';

export interface PromptRefOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    promptRef: {
      insertPromptRef: (attrs: {
        promptId: string;
        promptName: string;
      }) => ReturnType;
    };
  }
}

export const PromptRefNode = Node.create<PromptRefOptions>({
  name: 'promptRef',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      promptId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-prompt-id'),
        renderHTML: (attributes) => ({
          'data-prompt-id': attributes.promptId,
        }),
      },
      promptName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-prompt-name'),
        renderHTML: (attributes) => ({
          'data-prompt-name': attributes.promptName,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-prompt-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-prompt-ref': '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(PromptRefBadge);
  },

  addCommands() {
    return {
      insertPromptRef:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .run(),
    };
  },
});
