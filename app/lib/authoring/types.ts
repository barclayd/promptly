import type { Provider } from '../model-pricing';
import type {
  AuthoringContentKind,
  ComposerPromptReference,
} from '../validations/authoring';

export type AuthoringDiagnostic = {
  code: string;
  severity: 'error' | 'warning';
  path: (string | number)[];
  message: string;
};

export type AuthoringErrorCode =
  | 'invalid_input'
  | 'access_denied'
  | 'policy_changed'
  | 'payload_too_large'
  | 'content_not_found'
  | 'content_in_use'
  | 'change_not_found'
  | 'version_not_found'
  | 'reference_unavailable'
  | 'invalid_stored_definition'
  | 'duplicate_drafts'
  | 'stale_revision'
  | 'idempotency_conflict'
  | 'publication_blocked'
  | 'subscription_limit';

export class AuthoringError extends Error {
  constructor(
    public readonly code: AuthoringErrorCode,
    message: string,
    public readonly diagnostics: AuthoringDiagnostic[] = [],
    public readonly details?: { currentRevision: string | null },
  ) {
    super(message);
    this.name = 'AuthoringError';
  }
}

export type AssignedAuthoringId = {
  kind: 'field' | 'validation';
  path: (string | number)[];
  id: string;
};

export type NormalizedAuthoringDefinition<T> = {
  definition: T;
  assignedIds: AssignedAuthoringId[];
  diagnostics: AuthoringDiagnostic[];
};

export type NormalizedComposerDefinition<T> =
  NormalizedAuthoringDefinition<T> & {
    promptReferences: ComposerPromptReference[];
  };

export type AuthoringMetadata = {
  id: string;
  organizationId: string;
  kind: AuthoringContentKind;
  folderId: string | null;
  revision: string | null;
};

export type AuthoringVersion = {
  id: string;
  status: 'draft' | 'published';
  version: string | null;
  createdAt: number;
  updatedAt: number | null;
  publishedAt: number | null;
};

export type AuthoringDependency = {
  kind: 'prompt' | 'snippet';
  id: string;
  name: string;
  pinnedVersionId: string | null;
  resolvedVersionId: string | null;
  resolvedVersion: string | null;
};

export type AuthoringReadResult<T> = {
  metadata: AuthoringMetadata;
  version: AuthoringVersion;
  definition: T;
  dependencies: AuthoringDependency[];
  diagnostics: AuthoringDiagnostic[];
};

export type AuthoringDefinitionReadResult<T> = Omit<
  AuthoringReadResult<T>,
  'dependencies'
> & {
  session: D1DatabaseSession;
};

export type AuthoringPage<T> = { items: T[]; nextOffset: number | null };

export type AuthoringModel = {
  id: string;
  displayName: string;
  provider: Provider;
};
