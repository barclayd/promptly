import { nanoid } from 'nanoid';
import { type RouterContextProvider, redirect } from 'react-router';
import { z } from 'zod';
import {
  authContext,
  cloudflareContext,
  orgContext,
  sessionContext,
} from '~/context';
import {
  createComposerAuthoringSchema,
  createPromptAuthoringSchema,
  restoreAuthoringChangeSchema,
  updateComposerAuthoringSchema,
  updatePromptAuthoringSchema,
} from '../validations/authoring-mutations';
import {
  type AuthoringPrincipal,
  authorizeAuthoringAccess,
} from './access.server';
import type {
  BrowserAuthoringDocument,
  BrowserAuthoringKind,
  BrowserAuthoringResponse,
} from './browser-types';
import { getAuthoringAfterSnapshot } from './history.server';
import {
  type AuthoringMutationResult,
  createComposer,
  createPrompt,
  publishComposer,
  publishPrompt,
  restoreAuthoringChange,
  softDeleteComposer,
  softDeletePrompt,
  updateComposer,
  updatePrompt,
} from './mutations.server';
import { parseAuthoringValue } from './normalize';
import { deliverAuthoringEvents } from './outbox.server';
import { readComposerDefinition, readPromptDefinition } from './reads.server';
import { AuthoringError } from './types';

type BrowserOperation =
  | 'save'
  | 'messages'
  | 'content'
  | 'config'
  | 'references'
  | 'metadata'
  | 'create'
  | 'publish'
  | 'delete'
  | 'restore';

const json = (body: BrowserAuthoringResponse, status = 200) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

const principalFor = (context: Readonly<RouterContextProvider>) => {
  const session = context.get(sessionContext);
  const org = context.get(orgContext);
  if (!session?.user || !org) {
    throw new AuthoringError(
      'access_denied',
      'Sign in to your workspace to continue.',
    );
  }
  return {
    source: 'browser' as const,
    userId: session.user.id,
    organizationId: org.organizationId,
  };
};

const parseJson = (value: FormDataEntryValue | null): unknown => {
  if (typeof value !== 'string') {
    throw new AuthoringError('invalid_input', 'A JSON value is required.');
  }
  try {
    return JSON.parse(value);
  } catch {
    throw new AuthoringError('invalid_input', 'The submitted JSON is invalid.');
  }
};

const object = (value: unknown) =>
  parseAuthoringValue(z.record(z.string(), z.unknown()), value);

export const browserAuthoringError = (error: unknown) => {
  if (!(error instanceof AuthoringError)) {
    return json(
      {
        status: 'unknown',
        code: 'request_failed',
        error: 'The request could not be confirmed. Retry the same request.',
      },
      500,
    );
  }
  const status =
    error.code === 'stale_revision' || error.code === 'idempotency_conflict'
      ? 409
      : error.code === 'access_denied' || error.code === 'subscription_limit'
        ? 403
        : error.code === 'content_not_found' ||
            error.code === 'version_not_found'
          ? 404
          : error.code === 'payload_too_large'
            ? 413
            : 400;
  return json(
    {
      status: error.code === 'stale_revision' ? 'conflict' : 'rejected',
      code: error.code,
      error: error.message,
      ...(error.details
        ? { currentRevision: error.details.currentRevision }
        : {}),
      diagnostics: error.diagnostics,
    },
    status,
  );
};

export const readBrowserAuthoringDocument = async (
  context: Readonly<RouterContextProvider>,
  kind: BrowserAuthoringKind,
  id: string,
): Promise<BrowserAuthoringDocument> => {
  const principal = principalFor(context);
  const db = context.get(cloudflareContext).env.promptly;
  await authorizeAuthoringAccess(db, principal, 'mcp:read');
  const input = {
    organizationId: principal.organizationId,
    id,
    version: { kind: 'working' as const },
  };
  const saved =
    kind === 'prompt'
      ? await readPromptDefinition(db, input)
      : await readComposerDefinition(db, input);
  return {
    id,
    kind,
    userId: principal.userId,
    organizationId: principal.organizationId,
    revision: saved.metadata.revision,
    definition: { ...saved.definition, folderId: saved.metadata.folderId },
    version: saved.version,
    diagnostics: saved.diagnostics,
  };
};

export const browserAuthoringAction = async (
  {
    request,
    context,
  }: { request: Request; context: Readonly<RouterContextProvider> },
  kind: BrowserAuthoringKind,
  operation: BrowserOperation,
  documentId?: string,
) => {
  let committed = false;
  try {
    if (request.method !== 'POST')
      return new Response('Method not allowed', { status: 405 });
    const url = new URL(request.url);
    const version = url.searchParams.get('version');
    if (version && version !== 'draft') {
      throw new AuthoringError(
        'invalid_input',
        'Historical versions are read only. Return to the current draft before editing.',
      );
    }
    const form = await request.formData();
    if (
      !form.get('requestKey') ||
      (operation !== 'create' && !form.get('expectedRevision'))
    ) {
      return json(
        {
          status: 'rejected',
          code: 'revision_required',
          error:
            'Refresh this editor before saving. A document revision and request key are required.',
        },
        428,
      );
    }
    const cloudflare = context.get(cloudflareContext);
    let principal: Extract<AuthoringPrincipal, { source: 'browser' }>;
    if (operation === 'create' && !context.get(orgContext)) {
      const session = context.get(sessionContext);
      if (!session?.user)
        throw new AuthoringError(
          'access_denied',
          'Sign in to create a document.',
        );
      const auth = context.get(authContext);
      const created = await auth.api.createOrganization({
        body: { name: `${session.user.name}'s Workspace`, slug: nanoid(10) },
        headers: request.headers,
      });
      if (!created?.id)
        throw new AuthoringError('access_denied', 'A workspace is required.');
      principal = {
        source: 'browser',
        userId: session.user.id,
        organizationId: created.id,
      };
    } else {
      principal = principalFor(context);
    }
    const db = cloudflare.env.promptly;
    const requestKey = String(form.get('requestKey'));
    if (operation === 'create') {
      const input = {
        requestKey,
        ...(form.has('folderId') ? { folderId: form.get('folderId') } : {}),
        definition: form.has('definition')
          ? parseJson(form.get('definition'))
          : {
              name: form.get('name'),
              description: form.get('description') ?? '',
            },
      };
      const created =
        kind === 'prompt'
          ? await createPrompt(
              db,
              principal,
              parseAuthoringValue(createPromptAuthoringSchema, input),
            )
          : await createComposer(
              db,
              principal,
              parseAuthoringValue(createComposerAuthoringSchema, input),
            );
      cloudflare.ctx.waitUntil(
        deliverAuthoringEvents(cloudflare.env, { changeId: created.changeId }),
      );
      return redirect(`/${kind}s/${created.id}`);
    }
    const id =
      documentId ?? String(form.get('id') ?? form.get(`${kind}Id`) ?? '');
    const addressed = {
      id,
      requestKey,
      expectedRevision: String(form.get('expectedRevision')),
    };
    if (operation === 'delete') {
      const deleted =
        kind === 'prompt'
          ? await softDeletePrompt(db, principal, addressed)
          : await softDeleteComposer(db, principal, addressed);
      cloudflare.ctx.waitUntil(
        deliverAuthoringEvents(cloudflare.env, { changeId: deleted.changeId }),
      );
      return json({
        status: 'deleted',
        success: true,
        id,
        revision: deleted.revision,
      });
    }
    let result: AuthoringMutationResult;
    if (operation === 'restore') {
      result = await restoreAuthoringChange(
        db,
        principal,
        parseAuthoringValue(restoreAuthoringChangeSchema, {
          ...addressed,
          kind,
          changeId: form.get('changeId'),
          phase: form.get('phase'),
        }),
      );
    } else if (operation === 'publish') {
      const input = {
        ...addressed,
        ...(form.get('version')
          ? { version: String(form.get('version')) }
          : {}),
      };
      result =
        kind === 'prompt'
          ? await publishPrompt(db, principal, input)
          : await publishComposer(db, principal, input);
    } else {
      const actualOperation =
        operation === 'messages' && form.get('intent') === 'saveConfig'
          ? 'config'
          : operation;
      const changes =
        actualOperation === 'save'
          ? object(parseJson(form.get('patch')))
          : actualOperation === 'metadata'
            ? {
                name: form.get('name'),
                description: form.get('description') ?? '',
              }
            : actualOperation === 'config'
              ? { config: parseJson(form.get('config')) }
              : actualOperation === 'references'
                ? { snippets: parseJson(form.get('snippets')) }
                : actualOperation === 'content'
                  ? { content: form.get('content') ?? '' }
                  : {
                      systemMessage: form.get('systemMessage') ?? '',
                      userMessage: form.get('userMessage') ?? '',
                    };
      const { folderId, ...definitionChanges } = object(changes);
      const input = {
        ...addressed,
        edit: { mode: 'patch', changes: definitionChanges },
        ...(folderId !== undefined ? { folderId } : {}),
      };
      result =
        kind === 'prompt'
          ? await updatePrompt(
              db,
              principal,
              parseAuthoringValue(updatePromptAuthoringSchema, input),
            )
          : await updateComposer(
              db,
              principal,
              parseAuthoringValue(updateComposerAuthoringSchema, input),
            );
    }
    committed = true;
    cloudflare.ctx.waitUntil(
      deliverAuthoringEvents(cloudflare.env, { changeId: result.changeId }),
    );
    const saved = await getAuthoringAfterSnapshot(db, principal, {
      kind,
      id,
      changeId: result.changeId,
      revision: result.revision,
    });
    return json({
      status: 'saved',
      success: true,
      document: {
        id,
        kind,
        userId: principal.userId,
        organizationId: principal.organizationId,
        revision: saved.revision,
        definition: { ...saved.definition, folderId: saved.folderId },
        version: saved.version,
        diagnostics: result.diagnostics,
      },
    });
  } catch (error) {
    return browserAuthoringError(
      committed ? new Error('Acknowledgement unavailable') : error,
    );
  }
};
