import { CodeBlock } from '~/components/ui/code-block';
import { generateZodSchema } from '~/lib/generate-schema';
import type { SchemaField } from '~/lib/schema-types';

interface CodePreviewProps {
  fields: SchemaField[];
}

export const CodePreview = ({ fields }: CodePreviewProps) => {
  const generatedCode = generateZodSchema(fields);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Generated Schema</h3>
      <CodeBlock code={generatedCode} language="typescript" />
    </div>
  );
};
