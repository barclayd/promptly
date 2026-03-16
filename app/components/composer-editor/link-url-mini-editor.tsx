'use client';

import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useMemo, useRef } from 'react';
import { flattenSchemaFields } from '~/lib/flatten-schema-fields';
import { deserializeLinkUrl, serializeLinkUrl } from '~/lib/link-url-template';
import { useComposerEditorStore } from '~/stores/composer-editor-store';
import { getLinkUrlExtensions } from './extensions/link-url-extensions';
import { LinkUrlPaste } from './extensions/link-url-paste-extension';

type LinkUrlMiniEditorProps = {
  initialTemplate: string;
  onEditorReady: (editor: Editor) => void;
  onUrlChange?: (serializedUrl: string) => void;
};

export const LinkUrlMiniEditor = ({
  initialTemplate,
  onEditorReady,
  onUrlChange,
}: LinkUrlMiniEditorProps) => {
  const schemaFields = useComposerEditorStore((s) => s.schemaFields);
  const variables = useMemo(
    () => flattenSchemaFields(schemaFields),
    [schemaFields],
  );

  const initialContent = useMemo(
    () => deserializeLinkUrl(initialTemplate, variables),
    [initialTemplate, variables],
  );

  const onEditorReadyRef = useRef(onEditorReady);
  onEditorReadyRef.current = onEditorReady;

  const onUrlChangeRef = useRef(onUrlChange);
  onUrlChangeRef.current = onUrlChange;

  const onCreate = useCallback(({ editor }: { editor: Editor }) => {
    onEditorReadyRef.current(editor);
    onUrlChangeRef.current?.(serializeLinkUrl(editor));
  }, []);

  const onUpdate = useCallback(({ editor }: { editor: Editor }) => {
    onUrlChangeRef.current?.(serializeLinkUrl(editor));
  }, []);

  const editor = useEditor({
    extensions: [
      ...getLinkUrlExtensions(),
      LinkUrlPaste.configure({ schemaFields: variables }),
    ],
    content: initialContent,
    autofocus: 'end',
    editorProps: {
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          return true;
        }
        return false;
      },
      attributes: {
        class: 'link-url-editor-input',
      },
    },
    onCreate,
    onUpdate,
  });

  // Listen for custom events from the inline VariableRefPicker.
  // This decouples insertion from React's ref/closure system, which
  // gets invalidated when the outer popover's DismissableLayer causes
  // remounts of the LinkEditPopover component tree.
  const containerRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el || !editor) return;
      const handler = (e: Event) => {
        const { fieldId, fieldPath } = (e as CustomEvent).detail;
        if (editor.isDestroyed) return;
        const endPos = editor.state.doc.content.size - 1;
        editor
          .chain()
          .setTextSelection(endPos)
          .insertVariableRef({ fieldId, fieldPath })
          .run();
      };
      el.addEventListener('insert-variable-ref', handler);
      return () => el.removeEventListener('insert-variable-ref', handler);
    },
    [editor],
  );

  return (
    <div className="link-url-editor" ref={containerRef}>
      <EditorContent editor={editor} />
    </div>
  );
};
