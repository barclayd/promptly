import { Extension } from '@tiptap/core';
import { Fragment, Slice } from 'prosemirror-model';
import { Plugin, PluginKey } from 'prosemirror-state';
import type { FlatVariable } from '~/lib/flatten-schema-fields';

type LinkUrlPasteOptions = {
  schemaFields: FlatVariable[];
};

const VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;

export const LinkUrlPaste = Extension.create<LinkUrlPasteOptions>({
  name: 'linkUrlPaste',

  addOptions() {
    return {
      schemaFields: [],
    };
  },

  addProseMirrorPlugins() {
    const { schemaFields } = this.options;

    return [
      new Plugin({
        key: new PluginKey('linkUrlPaste'),
        props: {
          handlePaste: (view, _event, slice) => {
            const text = slice.content
              .textBetween(0, slice.content.size, '')
              .replace(/[\r\n]/g, '');

            const { schema } = view.state;
            const matches = [...text.matchAll(VARIABLE_PATTERN)];

            if (matches.length === 0) {
              const { tr } = view.state;
              if (text.length > 0) {
                tr.replaceSelectionWith(schema.text(text), true);
              } else {
                tr.deleteSelection();
              }
              view.dispatch(tr);
              return true;
            }

            const nodes: ReturnType<typeof schema.text>[] = [];
            let lastIndex = 0;

            for (const match of matches) {
              const matchStart = match.index;
              const fullMatch = match[0];
              const fieldPath = match[1];

              if (matchStart > lastIndex) {
                nodes.push(schema.text(text.slice(lastIndex, matchStart)));
              }

              const field = schemaFields.find((f) => f.path === fieldPath);

              if (field) {
                nodes.push(
                  schema.nodes.variableRef.create({
                    fieldId: field.id,
                    fieldPath: field.path,
                  }),
                );
              } else {
                nodes.push(schema.text(fullMatch));
              }

              lastIndex = matchStart + fullMatch.length;
            }

            if (lastIndex < text.length) {
              nodes.push(schema.text(text.slice(lastIndex)));
            }

            const fragment = Fragment.from(nodes);
            const { tr } = view.state;
            tr.replaceSelection(new Slice(fragment, 0, 0));
            view.dispatch(tr);

            return true;
          },
        },
      }),
    ];
  },
});
