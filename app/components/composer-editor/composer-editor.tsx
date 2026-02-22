'use client';

import { IconCopy, IconCornerDownLeft } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Check, CheckCircle2, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from '~/components/ui/input-group';
import { cn } from '~/lib/utils';
import { ComposerToolbar } from './composer-toolbar';
import { getComposerExtensions } from './extensions';
import './composer-editor.css';

const formatRelativeTime = (timestamp: number): string => {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) {
    return 'just now';
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes === 1) {
    return '1 minute ago';
  }
  return `${minutes} minutes ago`;
};

const useRelativeTimeDisplay = (timestamp: number | null) => {
  const [display, setDisplay] = useState<string | null>(null);

  useEffect(() => {
    if (!timestamp) {
      setDisplay(null);
      return;
    }

    const update = () => setDisplay(formatRelativeTime(timestamp));
    update();

    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [timestamp]);

  return display;
};

const SaveStatus = ({
  isDirty,
  isPendingSave,
  isSaving,
  lastSavedAt,
}: {
  isDirty?: boolean;
  isPendingSave?: boolean;
  isSaving?: boolean;
  lastSavedAt?: number | null;
}) => {
  const relativeTime = useRelativeTimeDisplay(lastSavedAt ?? null);

  if (isPendingSave || isSaving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        <span className="text-xs">Saving...</span>
      </span>
    );
  }

  if (relativeTime) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground animate-in fade-in duration-300">
        <CheckCircle2 className="size-3 text-emerald-500" />
        <span className="text-xs">
          Saved <span className="text-muted-foreground/70">{relativeTime}</span>
        </span>
      </span>
    );
  }

  if (!isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground/70">
        <CheckCircle2 className="size-3 text-emerald-500/70" />
        <span className="text-xs">Saved</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
      <span className="text-xs italic">Unsaved changes</span>
    </span>
  );
};

type ComposerEditorProps = {
  content: string;
  onChange?: (html: string) => void;
  isDirty?: boolean;
  isPendingSave?: boolean;
  isSaving?: boolean;
  lastSavedAt?: number | null;
  onTest?: () => void;
  disabled?: boolean;
  prompts?: Array<{ id: string; name: string }>;
  onEditorReady?: (editor: Editor) => void;
};

export const ComposerEditor = ({
  content,
  onChange,
  isDirty,
  isPendingSave,
  isSaving,
  lastSavedAt,
  onTest,
  disabled,
  prompts,
  onEditorReady,
}: ComposerEditorProps) => {
  const isCurrentlySaving = isPendingSave || isSaving;
  const [copied, setCopied] = useState(false);

  const editor = useEditor({
    extensions: getComposerExtensions(),
    content,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getHTML());
    },
    editorProps: {
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          onTest?.();
          return true;
        }
        return false;
      },
    },
  });

  // Notify parent when editor is ready
  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync editable state
  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [editor, disabled]);

  const handleCopy = useCallback(async () => {
    if (!editor) return;
    const text = editor.getText();
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 5000);
  }, [editor]);

  return (
    <div className="grid w-full gap-4">
      <InputGroup>
        <InputGroupAddon align="block-start" className="border-b">
          <ComposerToolbar editor={editor} prompts={prompts} />
          <InputGroupButton
            variant="ghost"
            size="icon-xs"
            className={cn(
              'transition-opacity duration-200',
              !isDirty && 'opacity-40 pointer-events-none',
            )}
            disabled={!isDirty}
          >
            {isCurrentlySaving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="cursor-not-allowed" />
            )}
          </InputGroupButton>
          <InputGroupButton variant="ghost" size="icon-xs" onClick={handleCopy}>
            {copied ? (
              <Check className="size-4 text-emerald-500 animate-in zoom-in duration-200" />
            ) : (
              <IconCopy />
            )}
          </InputGroupButton>
        </InputGroupAddon>

        <div
          className={cn(
            'composer-editor flex-1 self-stretch min-h-50 transition-opacity duration-200',
            isCurrentlySaving && 'opacity-90',
          )}
        >
          <EditorContent editor={editor} />
        </div>

        <InputGroupAddon align="block-end" className="border-t">
          <InputGroupText className="min-w-0">
            <SaveStatus
              isDirty={isDirty}
              isPendingSave={isPendingSave}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          </InputGroupText>
          <InputGroupButton
            size="sm"
            className="ml-auto"
            variant="default"
            onClick={onTest}
          >
            Test <IconCornerDownLeft />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
};
