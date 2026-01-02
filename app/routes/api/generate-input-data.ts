import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, Output } from 'ai';
import { data } from 'react-router';
import { getAuth } from '~/lib/auth.server';
import { buildZodSchema } from '~/lib/build-zod-schema';
import { generateZodSchema } from '~/lib/generate-schema';
import type { SchemaField } from '~/lib/schema-types';
import type { Route } from './+types/generate-input-data';

const SYSTEM_PROMPT = `You are a placeholder content generator for structured JSON objects. Your task is to generate realistic, generic placeholder data that conforms exactly to a provided Zod schema.

## Guidelines

**Infer context from metadata**: Use the schema's field names, descriptions, and any provided title to generate contextually appropriate values.

**Keep it realistic but generic**: Generate content that feels authentic without being too specific.

**Be concise**: Placeholder text should be brief enough to scan quickly. For strings, aim for 2-8 words unless the field expects longer content.

**Respect constraints**: Honor all schema constraints—min/max lengths, regex patterns, enums, number ranges, array lengths, required vs optional fields.

**Use sensible defaults by type**:
- Emails: firstname.lastname@example.com
- URLs: https://example.com/relevant-path
- Phones: +447715968432 format
- Dates: Recent, reasonable dates in ISO format
- IDs: Plausible formats (UUIDs, numeric IDs, slugs)
- Prices/money: Round, realistic figures

**Array lengths**: Unless specified, generate 2-3 items.

## Output

Return only the valid JSON object. No markdown, no explanations.`;

export const action = async ({ request, context }: Route.ActionArgs) => {
  const anthropic = createAnthropic({
    apiKey: context.cloudflare.env.ANTHROPIC_API_KEY,
  });

  const auth = getAuth(context);
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return data({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = (await request.json()) as {
    schema: SchemaField[];
    title?: string;
    description?: string;
  };

  const { schema, title, description } = body;

  if (!schema || !Array.isArray(schema) || schema.length === 0) {
    return data(
      { error: 'Schema is required and must not be empty' },
      { status: 400 },
    );
  }

  try {
    const zodSchema = buildZodSchema(schema);
    const schemaCode = generateZodSchema(schema);

    const { output } = await generateText({
      model: anthropic('claude-haiku-4-5'),
      output: Output.object({
        schema: zodSchema,
      }),
      system: SYSTEM_PROMPT,
      prompt: `Schema:\n${schemaCode}\n\nTitle: ${title || 'Untitled'}\nDescription: ${description || 'No description'}\n\nGenerate placeholder JSON.`,
    });

    if (!output) {
      return data({ error: 'Failed to generate output' }, { status: 500 });
    }

    // If schema has exactly 1 field, unwrap the value and return the root name
    if (schema.length === 1) {
      const rootName = schema[0].name;
      const unwrappedData = (output as Record<string, unknown>)[rootName];
      return data({ inputData: unwrappedData, rootName });
    }

    return data({ inputData: output, rootName: null });
  } catch (error) {
    console.error('Error generating input data:', error);
    return data({ error: 'Failed to generate input data' }, { status: 500 });
  }
};
