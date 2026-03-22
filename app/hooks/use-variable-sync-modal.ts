'use client';

import { useCallback, useRef, useState } from 'react';
import type { PromptRefRemovedPayload } from '~/components/composer-editor/extensions/prompt-ref-delete-tracker';
import type { VariableStatus } from '~/components/composer-editor/remove-prompt-variables-modal';
import {
  extractPromptIds,
  extractVariableIds,
} from '~/lib/composer-content-parser';
import type { SchemaField } from '~/lib/schema-types';
import { useComposerEditorStore } from '~/stores/composer-editor-store';
import { fetchPromptSchema } from '~/stores/prompt-schema-cache';

type AddModalState = {
  open: boolean;
  promptName: string;
  variables: SchemaField[];
  existingFields: SchemaField[];
};

type RemoveModalState = {
  open: boolean;
  promptName: string;
  variables: VariableStatus[];
};

const initialAddState: AddModalState = {
  open: false,
  promptName: '',
  variables: [],
  existingFields: [],
};

const initialRemoveState: RemoveModalState = {
  open: false,
  promptName: '',
  variables: [],
};

const matchesNameAndType = (a: SchemaField, b: SchemaField) =>
  a.name === b.name && a.type === b.type;

export const useVariableSyncModal = (getEditorHtml: () => string) => {
  const [addModal, setAddModal] = useState<AddModalState>(initialAddState);
  const [removeModal, setRemoveModal] =
    useState<RemoveModalState>(initialRemoveState);

  // Prevent showing modal during rapid operations
  const addModalPendingRef = useRef(false);
  const removeModalPendingRef = useRef(false);

  const handlePromptAdded = useCallback(
    async (promptId: string, promptName: string) => {
      if (addModalPendingRef.current) return;

      const html = getEditorHtml();
      // Count how many prompt ref badges exist for this promptId.
      // If > 1, it's a duplicate insertion — skip modal.
      const allPromptIds = extractPromptIds(html);
      const count = allPromptIds.filter((id) => id === promptId).length;
      if (count > 1) return;

      addModalPendingRef.current = true;
      try {
        const entry = await fetchPromptSchema(promptId);
        if (!entry || entry.schema.length === 0) return;

        const existingFields = useComposerEditorStore.getState().schemaFields;

        // If all variables already exist (same name + type), skip modal
        const allExist = entry.schema.every((v) =>
          existingFields.some((e) => matchesNameAndType(e, v)),
        );
        if (allExist) return;

        setAddModal({
          open: true,
          promptName,
          variables: entry.schema,
          existingFields,
        });
      } finally {
        addModalPendingRef.current = false;
      }
    },
    [getEditorHtml],
  );

  const handlePromptRemoved = useCallback(
    async (payload: PromptRefRemovedPayload) => {
      if (removeModalPendingRef.current) return;

      removeModalPendingRef.current = true;
      try {
        // Get the removed prompt's schema from cache (or fetch)
        const removedEntry = await fetchPromptSchema(
          payload.promptId,
          payload.promptVersionId,
        );
        if (!removedEntry || removedEntry.schema.length === 0) return;

        const html = getEditorHtml();
        const remainingPromptIds = extractPromptIds(html);
        const variableIdsInContent = new Set(extractVariableIds(html));

        // Get schemas for all remaining prompts (from cache or fetch)
        const remainingEntries = await Promise.all(
          remainingPromptIds.map((id) => fetchPromptSchema(id)),
        );

        // Build a set of all variables used by remaining prompts (by name+type)
        const remainingVarKeys = new Set<string>();
        const promptNamesByVarKey = new Map<string, string[]>();

        for (const entry of remainingEntries) {
          if (!entry) continue;
          for (const field of entry.schema) {
            const key = `${field.name}::${field.type}`;
            remainingVarKeys.add(key);
            const names = promptNamesByVarKey.get(key) ?? [];
            if (!names.includes(entry.promptName)) {
              names.push(entry.promptName);
            }
            promptNamesByVarKey.set(key, names);
          }
        }

        // Get current composer schema fields
        const composerFields = useComposerEditorStore.getState().schemaFields;

        // For each variable from the removed prompt, determine its status
        const variableStatuses: VariableStatus[] = [];

        for (const field of removedEntry.schema) {
          // Find the matching field in the composer's schema (by name+type)
          const composerField = composerFields.find((cf) =>
            matchesNameAndType(cf, field),
          );
          if (!composerField) continue; // Not in composer schema, nothing to remove

          const key = `${field.name}::${field.type}`;
          const usedByPrompts = promptNamesByVarKey.get(key) ?? [];
          const usedInContent = variableIdsInContent.has(composerField.id);
          const orphaned = usedByPrompts.length === 0 && !usedInContent;

          variableStatuses.push({
            field: composerField,
            orphaned,
            usedByPrompts,
            usedInContent,
          });
        }

        // If no orphaned variables, skip modal
        const hasOrphaned = variableStatuses.some((v) => v.orphaned);
        if (!hasOrphaned) return;

        setRemoveModal({
          open: true,
          promptName: payload.promptName,
          variables: variableStatuses,
        });
      } finally {
        removeModalPendingRef.current = false;
      }
    },
    [getEditorHtml],
  );

  const handleAddSelected = useCallback((fields: SchemaField[]) => {
    const existing = useComposerEditorStore.getState().schemaFields;
    const newFields = fields.map((f) => ({
      ...f,
      id: crypto.randomUUID(),
    }));
    useComposerEditorStore
      .getState()
      .setSchemaFields([...existing, ...newFields]);
    setAddModal(initialAddState);
  }, []);

  const handleRemoveSelected = useCallback((fieldIds: string[]) => {
    const idSet = new Set(fieldIds);
    const existing = useComposerEditorStore.getState().schemaFields;
    useComposerEditorStore
      .getState()
      .setSchemaFields(existing.filter((f) => !idSet.has(f.id)));
    setRemoveModal(initialRemoveState);
  }, []);

  const setAddModalOpen = useCallback((open: boolean) => {
    if (!open) {
      setAddModal(initialAddState);
    }
  }, []);

  const setRemoveModalOpen = useCallback((open: boolean) => {
    if (!open) {
      setRemoveModal(initialRemoveState);
    }
  }, []);

  return {
    addModal,
    removeModal,
    setAddModalOpen,
    setRemoveModalOpen,
    handlePromptAdded,
    handlePromptRemoved,
    handleAddSelected,
    handleRemoveSelected,
  };
};
