import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Underline } from '@tiptap/extension-underline';
import { StarterKit } from '@tiptap/starter-kit';
import { AtomGap } from './atom-gap-extension';
import { HtmlBlockNode } from './html-block-extension';
import type { PromptRefRemovedPayload } from './prompt-ref-delete-tracker';
import { PromptRefDeleteTracker } from './prompt-ref-delete-tracker';
import { PromptRefNode } from './prompt-ref-extension';
import { VariableRefNode } from './variable-ref-extension';

type ComposerExtensionOptions = {
  onPromptRefRemoved?: (payload: PromptRefRemovedPayload) => void;
};

export const getComposerExtensions = (options?: ComposerExtensionOptions) => [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: false,
    underline: false,
  }),
  Underline,
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Link.configure({ openOnClick: false }),
  Table.configure({ resizable: true }),
  TableRow,
  TableCell,
  TableHeader,
  TaskList,
  TaskItem.configure({ nested: true }),
  Placeholder.configure({
    placeholder: 'Start writing your composer content...',
  }),
  PromptRefNode,
  VariableRefNode,
  HtmlBlockNode,
  AtomGap,
  PromptRefDeleteTracker.configure({
    onPromptRefRemoved: options?.onPromptRefRemoved,
  }),
];
