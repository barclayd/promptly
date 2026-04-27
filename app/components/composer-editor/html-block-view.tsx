'use client';

import { IconBrandHtml5, IconCode, IconTrash } from '@tabler/icons-react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { useCallback, useRef } from 'react';
import { Button } from '~/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { cn } from '~/lib/utils';
import { useComposerEditorStore } from '~/stores/composer-editor-store';
import {
  HtmlBlockCodeMirror,
  type HtmlBlockCodeMirrorHandle,
} from './html-block-codemirror';
import { PromptRefPicker } from './prompt-ref-picker';
import { VariableRefPicker } from './variable-ref-picker';

const escapeAttr = (v: string): string =>
  v
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const HtmlBlockView = ({
  node,
  editor,
  selected,
  updateAttributes,
  deleteNode,
}: ReactNodeViewProps) => {
  const rawHtml = ((node.attrs.rawHtml as string | null) ?? '') as string;
  const cmRef = useRef<HtmlBlockCodeMirrorHandle | null>(null);
  const composerPrompts = useComposerEditorStore((s) => s.prompts);
  const readOnly = !editor.isEditable;

  const handleChange = useCallback(
    (next: string) => {
      updateAttributes({ rawHtml: next });
    },
    [updateAttributes],
  );

  const insertVariable = useCallback((fieldId: string, fieldPath: string) => {
    const tag =
      '<span data-variable-ref="" ' +
      `data-field-id="${escapeAttr(fieldId)}" ` +
      `data-field-path="${escapeAttr(fieldPath)}"></span>`;
    cmRef.current?.insertAtCursor(tag);
  }, []);

  const insertPrompt = useCallback((promptId: string, promptName: string) => {
    const tag =
      '<span data-prompt-ref="" ' +
      `data-prompt-id="${escapeAttr(promptId)}" ` +
      `data-prompt-name="${escapeAttr(promptName)}"></span>`;
    cmRef.current?.insertAtCursor(tag);
  }, []);

  return (
    <NodeViewWrapper
      className={cn(
        'html-block-view group/html-block my-2 overflow-hidden rounded-md border bg-muted/30',
        selected && 'ring-2 ring-primary/40 ring-offset-1',
      )}
      data-html-block-view
    >
      <div
        className="flex items-center gap-1 border-b bg-muted/40 px-2 py-1"
        contentEditable={false}
      >
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <IconBrandHtml5 className="size-3.5" />
          HTML
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          {!readOnly && (
            <>
              <VariableRefPicker
                editor={editor}
                onInsertVariable={insertVariable}
                triggerLabel="Variable"
                triggerIcon={<IconCode className="size-3.5" />}
              />
              <PromptRefPicker
                editor={editor}
                prompts={composerPrompts}
                customInsert={insertPrompt}
                triggerLabel="Prompt"
              />
              <div className="mx-1 h-4 w-px bg-border" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 rounded-sm text-muted-foreground hover:text-destructive focus-visible:ring-0"
                    onClick={() => deleteNode()}
                  >
                    <IconTrash className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  Delete HTML block
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
      </div>

      <div contentEditable={false} className="bg-background">
        <HtmlBlockCodeMirror
          ref={cmRef}
          value={rawHtml}
          onChange={handleChange}
          readOnly={readOnly}
        />
      </div>
    </NodeViewWrapper>
  );
};
