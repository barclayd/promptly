import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { data } from 'react-router';
import { orgContext } from '~/context';
import { getAuth } from '~/lib/auth.server';
import { preparePrompts } from '~/lib/prompt-interpolation';
import type { Route } from './+types/prompts.run';

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

  const org = context.get(orgContext);
  if (!org) {
    return data({ error: 'Unauthorized' }, { status: 403 });
  }

  const formData = await request.formData();
  const promptId = formData.get('promptId') as string;
  const folderId = formData.get('folderId') as string;
  const versionNumber = formData.get('version') as string | null;
  const model =
    (formData.get('model') as string) || 'anthropic/claude-haiku-4.5';
  const temperature = Number.parseFloat(
    (formData.get('temperature') as string) || '0.5',
  );
  const inputDataJson = formData.get('inputData') as string | null;
  const inputDataRootName = formData.get('inputDataRootName') as string | null;

  if (!promptId || !folderId) {
    return data({ error: 'Missing promptId or folderId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  const promptOwnership = await db
    .prepare('SELECT id FROM prompt WHERE id = ? AND organization_id = ?')
    .bind(promptId, org.organizationId)
    .first();

  if (!promptOwnership) {
    return data({ error: 'Prompt not found' }, { status: 404 });
  }

  let versionQuery: string;
  let versionParams: string[];

  if (versionNumber) {
    versionQuery =
      'SELECT system_message, user_message FROM prompt_version WHERE prompt_id = ? AND version = ?';
    versionParams = [promptId, versionNumber];
  } else {
    // Return most recent published version (exclude drafts where version is NULL)
    versionQuery =
      'SELECT system_message, user_message FROM prompt_version WHERE prompt_id = ? AND published_at IS NOT NULL ORDER BY version DESC LIMIT 1';
    versionParams = [promptId];
  }

  const promptVersion = await db
    .prepare(versionQuery)
    .bind(...versionParams)
    .first<{
      system_message: string | null;
      user_message: string | null;
    }>();

  if (!promptVersion) {
    return data({ error: 'Prompt version not found' }, { status: 404 });
  }

  const prepared = preparePrompts({
    systemMessage: promptVersion.system_message || '',
    userMessage: promptVersion.user_message || '',
    inputDataJson,
    inputDataRootName,
  });

  if (prepared.error) {
    console.warn('Prompt interpolation warning:', prepared.error);
  }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: prepared.systemMessage,
    prompt: prepared.userMessage,
    temperature,
  });

  const response = result.toTextStreamResponse();
  if (prepared.unusedFields.length > 0) {
    response.headers.set(
      'X-Unused-Fields',
      JSON.stringify(prepared.unusedFields),
    );
  }
  return response;
};
