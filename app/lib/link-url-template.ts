import type { Editor } from '@tiptap/react';
import type { FlatVariable } from './flatten-schema-fields';

type TextNode = { type: 'text'; text: string };
type VariableRefNode = {
  type: 'variableRef';
  attrs: { fieldId: string; fieldPath: string };
};
type InlineNode = TextNode | VariableRefNode;
type ParagraphNode = { type: 'paragraph'; content?: InlineNode[] };
type DocNode = { type: 'doc'; content?: ParagraphNode[] };

export const serializeLinkUrl = (editor: Editor): string => {
  const doc = editor.getJSON() as DocNode;
  const paragraph = doc.content?.[0];

  if (!paragraph?.content?.length) {
    return '';
  }

  return paragraph.content
    .map((node) => {
      if (node.type === 'variableRef') {
        return `{{${node.attrs.fieldPath}}}`;
      }
      return node.text;
    })
    .join('');
};

export const deserializeLinkUrl = (
  template: string,
  variables: FlatVariable[],
): DocNode => {
  if (!template) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  const variablesByPath = new Map(variables.map((v) => [v.path, v]));
  const content: InlineNode[] = [];
  const parts = template.split(/(\{\{[^}]+\}\})/g);

  for (const part of parts) {
    if (!part) continue;

    const varMatch = /^\{\{([^}]+)\}\}$/.exec(part);

    if (varMatch) {
      const fieldPath = varMatch[1];
      const variable = variablesByPath.get(fieldPath);

      if (variable) {
        content.push({
          type: 'variableRef',
          attrs: { fieldId: variable.id, fieldPath: variable.path },
        });
      } else {
        content.push({ type: 'text', text: part });
      }
    } else {
      content.push({ type: 'text', text: part });
    }
  }

  return {
    type: 'doc',
    content: [
      { type: 'paragraph', content: content.length > 0 ? content : undefined },
    ],
  };
};
