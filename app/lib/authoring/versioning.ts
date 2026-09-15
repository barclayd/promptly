import type { SchemaField } from '../schema-types';
import { authoringSemverSchema } from '../validations/authoring';
import { parseAuthoringValue } from './normalize';
import { AuthoringError } from './types';

export type AuthoringVersionNumber = {
  major: number;
  minor: number;
  patch: number;
  version: string;
};
export type AuthoringVersionSelectionInput = {
  currentSchema: SchemaField[];
  latestPublished: { version: string; schema: SchemaField[] } | null;
};

export const parseAuthoringVersion = (
  version: string,
): AuthoringVersionNumber => {
  const parsed = parseAuthoringValue(authoringSemverSchema, version);
  const [major, minor, patch] = parsed.split('.').map(Number);
  return { major, minor, patch, version: parsed };
};

export const authoringSchemasEqual = (
  first: SchemaField[],
  second: SchemaField[],
): boolean =>
  first.length === second.length &&
  JSON.stringify(first.toSorted((a, b) => a.name.localeCompare(b.name))) ===
    JSON.stringify(second.toSorted((a, b) => a.name.localeCompare(b.name)));

export const suggestAuthoringVersion = ({
  currentSchema,
  latestPublished,
}: AuthoringVersionSelectionInput): AuthoringVersionNumber => {
  if (latestPublished === null) return parseAuthoringVersion('1.0.0');
  const latest = parseAuthoringVersion(latestPublished.version);
  return parseAuthoringVersion(
    authoringSchemasEqual(currentSchema, latestPublished.schema)
      ? `${latest.major}.${latest.minor + 1}.${latest.patch}`
      : `${latest.major + 1}.0.0`,
  );
};

export const selectAuthoringPublishVersion = (
  input: AuthoringVersionSelectionInput & { override?: string },
): AuthoringVersionNumber => {
  const selected =
    input.override === undefined
      ? suggestAuthoringVersion(input)
      : parseAuthoringVersion(input.override);
  if (input.latestPublished === null) return selected;
  const latest = parseAuthoringVersion(input.latestPublished.version);
  const greater =
    selected.major > latest.major ||
    (selected.major === latest.major &&
      (selected.minor > latest.minor ||
        (selected.minor === latest.minor && selected.patch > latest.patch)));
  if (!greater)
    throw new AuthoringError(
      'invalid_input',
      'The publication version must be greater than the latest published version.',
      [
        {
          code: 'version_not_increasing',
          severity: 'error',
          path: ['version'],
          message: `Choose a semantic version greater than ${latest.version}.`,
        },
      ],
    );
  return selected;
};
