import { createAnthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { data } from 'react-router';
import { getAuth } from '~/lib/auth.server';
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

  const formData = await request.formData();
  const promptId = formData.get('promptId') as string;
  const folderId = formData.get('folderId') as string;
  const versionNumber = formData.get('version') as string | null;
  const model =
    (formData.get('model') as string) || 'anthropic/claude-haiku-4.5';
  const temperature = Number.parseFloat(
    (formData.get('temperature') as string) || '0.5',
  );
  // const inputDataJson = formData.get('inputData') as string | null;

  if (!promptId || !folderId) {
    return data({ error: 'Missing promptId or folderId' }, { status: 400 });
  }

  const db = context.cloudflare.env.promptly;

  // Get the prompt version data
  let versionQuery: string;
  let versionParams: string[];

  if (versionNumber) {
    versionQuery =
      'SELECT system_message, user_message FROM prompt_version WHERE prompt_id = ? AND version = ?';
    versionParams = [promptId, versionNumber];
  } else {
    versionQuery =
      'SELECT system_message, user_message FROM prompt_version WHERE prompt_id = ? ORDER BY version DESC LIMIT 1';
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

  const systemMessage = promptVersion.system_message || '';
  const userMessage = promptVersion.user_message || '';

  // // Parse and inject input data if provided
  // if (inputDataJson) {
  //   try {
  //     const inputData = JSON.parse(inputDataJson);
  //     // For now, stringify the input data and append to user message
  //     if (Array.isArray(inputData) && inputData.length > 0) {
  //       userMessage = `${userMessage}\n\nInput data:\n${inputData.join('\n')}`;
  //     }
  //   } catch {
  //     // Ignore parse errors
  //   }
  // }

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: systemMessage,
    prompt: userMessage,
    temperature,
  });

  return result.toTextStreamResponse();
};
