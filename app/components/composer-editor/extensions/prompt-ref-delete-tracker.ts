import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';

export type PromptRefRemovedPayload = {
  promptId: string;
  promptName: string;
  promptVersionId: string | null;
};

type PromptRefDeleteTrackerOptions = {
  onPromptRefRemoved?: (payload: PromptRefRemovedPayload) => void;
};

export const PromptRefDeleteTracker =
  Extension.create<PromptRefDeleteTrackerOptions>({
    name: 'promptRefDeleteTracker',

    addOptions() {
      return {
        onPromptRefRemoved: undefined,
      };
    },

    addProseMirrorPlugins() {
      const { onPromptRefRemoved } = this.options;

      let debounceTimeout: ReturnType<typeof setTimeout> | null = null;

      return [
        new Plugin({
          key: new PluginKey('promptRefDeleteTracker'),

          appendTransaction(transactions, oldState, newState) {
            if (!onPromptRefRemoved) return null;
            if (!transactions.some((tr) => tr.docChanged)) return null;
            if (transactions.some((tr) => tr.getMeta('history$'))) return null;

            const oldPromptIds = new Map<
              string,
              { promptName: string; promptVersionId: string | null }
            >();

            oldState.doc.descendants((node) => {
              if (node.type.name === 'promptRef' && node.attrs.promptId) {
                oldPromptIds.set(node.attrs.promptId, {
                  promptName: node.attrs.promptName ?? '',
                  promptVersionId: node.attrs.promptVersionId ?? null,
                });
              }
            });

            const newPromptIds = new Set<string>();

            newState.doc.descendants((node) => {
              if (node.type.name === 'promptRef' && node.attrs.promptId) {
                newPromptIds.add(node.attrs.promptId);
              }
            });

            const removed: PromptRefRemovedPayload[] = [];

            for (const [promptId, attrs] of oldPromptIds) {
              if (!newPromptIds.has(promptId)) {
                removed.push({
                  promptId,
                  promptName: attrs.promptName,
                  promptVersionId: attrs.promptVersionId,
                });
              }
            }

            if (removed.length > 0) {
              if (debounceTimeout) {
                clearTimeout(debounceTimeout);
              }

              debounceTimeout = setTimeout(() => {
                debounceTimeout = null;
                for (const payload of removed) {
                  onPromptRefRemoved(payload);
                }
              }, 100);
            }

            return null;
          },

          destroy() {
            if (debounceTimeout) {
              clearTimeout(debounceTimeout);
              debounceTimeout = null;
            }
          },
        }),
      ];
    },
  });
