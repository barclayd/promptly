import { mergeAttributes, Node } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CompactVariableRefBadge } from '../compact-variable-ref-badge';
import { VariableRefBadge } from '../variable-ref-badge';

export interface VariableRefOptions {
  HTMLAttributes: Record<string, unknown>;
  compact: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variableRef: {
      insertVariableRef: (attrs: {
        fieldId: string;
        fieldPath: string;
      }) => ReturnType;
    };
  }
}

export const VariableRefNode = Node.create<VariableRefOptions>({
  name: 'variableRef',
  group: 'inline',
  inline: true,
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      compact: false,
    };
  },

  addAttributes() {
    return {
      fieldId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-id'),
        renderHTML: (attributes) => ({
          'data-field-id': attributes.fieldId,
        }),
      },
      fieldPath: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-field-path'),
        renderHTML: (attributes) => ({
          'data-field-path': attributes.fieldPath,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-variable-ref]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-variable-ref': '',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(
      this.options.compact ? CompactVariableRefBadge : VariableRefBadge,
    );
  },

  addCommands() {
    return {
      insertVariableRef:
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
