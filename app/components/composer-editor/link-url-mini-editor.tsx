'use client';

import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { useCallback, useMemo, useRef } from 'react';
import { flattenSchemaFields } from '~/lib/flatten-schema-fields';
import { deserializeLinkUrl } from '~/lib/link-url-template';
import { useComposerEditorStore } from '~/stores/composer-editor-store';
import { getLinkUrlExtensions } from './extensions/link-url-extensions';
import { LinkUrlPaste } from './extensions/link-url-paste-extension';

type LinkUrlMiniEditorProps = {
  initialTemplate: string;
  onEditorReady: (editor: Editor) => void;
};

export const LinkUrlMiniEditor = ({
  initialTemplate,
  onEditorReady,
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

  const onCreate = useCallback(({ editor }: { editor: Editor }) => {
    onEditorReadyRef.current(editor);
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
  });

  return (
    <div className="link-url-editor">
      <EditorContent editor={editor} />
    </div>
  );
};
