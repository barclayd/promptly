'use client';

import type { Editor } from '@tiptap/react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Label } from '~/components/ui/label';
import { serializeLinkUrl } from '~/lib/link-url-template';
import { LinkUrlMiniEditor } from './link-url-mini-editor';
import { VariableRefPicker } from './variable-ref-picker';

type LinkEditPopoverProps = {
  url: string;
  onSetLink: (url: string) => void;
  onRemoveLink: () => void;
  hasLink: boolean;
};

export const LinkEditPopover = ({
  url,
  onSetLink,
  onRemoveLink,
  hasLink,
}: LinkEditPopoverProps) => {
  const [miniEditor, setMiniEditor] = useState<Editor | null>(null);
  const miniEditorRef = useRef<Editor | null>(null);

  const handleEditorReady = useCallback((editor: Editor) => {
    miniEditorRef.current = editor;
    setMiniEditor(editor);
  }, []);

  const handleInsertVariable = useCallback(
    (fieldId: string, fieldPath: string) => {
      const editor = miniEditorRef.current;
      if (!editor || editor.isDestroyed) return;
      editor.chain().focus().insertVariableRef({ fieldId, fieldPath }).run();
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!miniEditor) return;
    const serialized = serializeLinkUrl(miniEditor);
    onSetLink(serialized);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <Label htmlFor="link-url" className="text-xs">
        URL
      </Label>
      {miniEditor && (
        <div className="flex justify-end">
          <VariableRefPicker
            editor={miniEditor}
            variant="secondary"
            onInsertVariable={handleInsertVariable}
          />
        </div>
      )}
      <LinkUrlMiniEditor
        initialTemplate={url}
        onEditorReady={handleEditorReady}
      />
      <div className="flex gap-2 justify-end">
        {hasLink && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onRemoveLink}
          >
            Remove
          </Button>
        )}
        <Button type="submit" size="sm" className="h-7 text-xs">
          Apply
        </Button>
      </div>
    </form>
  );
};
