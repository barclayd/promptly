import type {
  ComposerDefinition,
  PromptDefinition,
} from '../validations/authoring';
import type { AuthoringDiagnostic, AuthoringVersion } from './types';

export type BrowserAuthoringKind = 'prompt' | 'composer';
export type BrowserAuthoringFields = (PromptDefinition | ComposerDefinition) & {
  folderId: string | null;
};

export type BrowserAuthoringDocument = {
  id: string;
  kind: BrowserAuthoringKind;
  userId: string;
  organizationId: string;
  revision: string | null;
  definition: BrowserAuthoringFields;
  version: AuthoringVersion;
  diagnostics: AuthoringDiagnostic[];
};

export type BrowserAuthoringResponse =
  | { status: 'saved'; success: true; document: BrowserAuthoringDocument }
  | { status: 'deleted'; success: true; revision: string; id: string }
  | {
      status: 'conflict' | 'rejected' | 'unknown';
      error: string;
      code: string;
      currentRevision?: string | null;
      diagnostics?: AuthoringDiagnostic[];
    };
