import { lazy, Suspense } from 'react';
import { Skeleton } from '~/components/ui/skeleton';
import { generateZodSchema } from '~/lib/generate-schema';
import type { SchemaField } from '~/lib/schema-types';

const CodeBlock = lazy(() =>
  import('~/components/ui/code-block').then((m) => ({
    default: m.CodeBlock,
  })),
);

interface CodePreviewProps {
  fields: SchemaField[];
}

export const CodePreview = ({ fields }: CodePreviewProps) => {
  const generatedCode = generateZodSchema(fields);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Generated Schema</h3>
      <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-md" />}>
        <CodeBlock code={generatedCode} language="typescript" />
      </Suspense>
    </div>
  );
};
