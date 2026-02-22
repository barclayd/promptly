import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * Inserts invisible widget decorations between adjacent inline atom nodes
 * (e.g. prompt-ref and variable-ref badges). This gives ProseMirror's
 * `posAtCoords` a real DOM target so the dropcursor can resolve drop
 * positions in the gap between two adjacent badges.
 */
export const AtomGap = Extension.create({
  name: 'atomGap',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('atomGap'),
        props: {
          decorations(state) {
            const { doc } = state;
            const decorations: Decoration[] = [];

            doc.descendants((node, pos) => {
              if (!node.isBlock) return;

              let prevWasInlineAtom = false;

              node.forEach((child, offset) => {
                const childStart = pos + 1 + offset;

                if (prevWasInlineAtom && child.isAtom && child.isInline) {
                  decorations.push(
                    Decoration.widget(
                      childStart,
                      () => {
                        const gap = document.createElement('span');
                        gap.className = 'ProseMirror-atom-gap';
                        return gap;
                      },
                      { side: -1 },
                    ),
                  );
                }

                prevWasInlineAtom = child.isAtom && child.isInline;
              });
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
