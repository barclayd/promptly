import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Placeholder from '@tiptap/extension-placeholder';
import Text from '@tiptap/extension-text';
import { AtomGap } from './atom-gap-extension';
import { VariableRefNode } from './variable-ref-extension';

export const getLinkUrlExtensions = () => [
  Document.extend({ content: 'paragraph' }),
  Paragraph,
  Text,
  Placeholder.configure({ placeholder: 'https://example.com' }),
  VariableRefNode.configure({ compact: true }),
  AtomGap,
];
