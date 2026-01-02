import { reconstructFullData } from './input-data-utils';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown[]): value is string[] =>
  value.every((v): v is string => typeof v === 'string');

const isObjectArray = (value: unknown[]): value is Record<string, unknown>[] =>
  value.every((v): v is Record<string, unknown> => isRecord(v));

const formatStringArray = (arr: string[]): string =>
  arr.map((v, i) => `${i + 1}: ${v}`).join('\n');

const formatObjectArray = (arr: Record<string, unknown>[]): string =>
  arr
    .map((item, i) => {
      const lines = Object.entries(item)
        .map(([k, v]) => `  ${k}: ${formatValue(v)}`)
        .join('\n');
      return `- Item ${i + 1}:\n${lines}`;
    })
    .join('\n');

const formatMixedArray = (arr: unknown[]): string =>
  arr.map((v, i) => `${i + 1}: ${formatValue(v)}`).join('\n');

const formatObject = (obj: Record<string, unknown>): string =>
  Object.entries(obj)
    .map(([k, v]) => `${k}: ${formatValue(v)}`)
    .join('\n');

export const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (isStringArray(value)) return formatStringArray(value);
    if (isObjectArray(value)) return formatObjectArray(value);
    return formatMixedArray(value);
  }

  if (isRecord(value)) return formatObject(value);

  return String(value);
};

export const getNestedValue = (
  obj: Record<string, unknown>,
  path: string,
): unknown => {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) return undefined;

    if (isRecord(current)) {
      current = current[key];
      continue;
    }

    if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      if (Number.isNaN(index)) return undefined;
      current = current[index];
      continue;
    }

    return undefined;
  }

  return current;
};

interface InterpolationResult {
  text: string;
  usedKeys: Set<string>;
}

export const interpolatePrompt = (
  template: string,
  inputData: unknown,
  rootName: string | null,
): InterpolationResult => {
  const data = reconstructFullData(inputData, rootName);
  const usedKeys = new Set<string>();
  const regex = /\$\{([^}]+)\}/g;

  const text = template.replace(regex, (match, path) => {
    const value = getNestedValue(data, path);
    if (value === undefined) return match;
    usedKeys.add(path.split('.')[0]);
    return formatValue(value);
  });

  return { text, usedKeys };
};

export const getUnusedKeys = (
  data: Record<string, unknown>,
  usedKeys: Set<string>,
): string[] => Object.keys(data).filter((key) => !usedKeys.has(key));

export const appendUnusedData = (
  prompt: string,
  unusedData: Record<string, unknown>,
): string => {
  if (Object.keys(unusedData).length === 0) return prompt;
  return `${prompt}\n\n${JSON.stringify(unusedData)}`;
};

// Prepare prompts (result type pattern)
interface PreparePromptsOptions {
  systemMessage: string;
  userMessage: string;
  inputDataJson: string | null;
  inputDataRootName: string | null;
}

interface PreparePromptsResult {
  systemMessage: string;
  userMessage: string;
  unusedFields: string[];
  error: string | null;
}

export const preparePrompts = (
  options: PreparePromptsOptions,
): PreparePromptsResult => {
  const { systemMessage, userMessage, inputDataJson, inputDataRootName } =
    options;

  if (!inputDataJson) {
    return { systemMessage, userMessage, unusedFields: [], error: null };
  }

  let inputData: unknown;
  try {
    inputData = JSON.parse(inputDataJson);
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'Invalid JSON';
    return {
      systemMessage,
      userMessage,
      unusedFields: [],
      error: `Failed to parse input data: ${errorMessage}`,
    };
  }

  const systemResult = interpolatePrompt(
    systemMessage,
    inputData,
    inputDataRootName,
  );
  const userResult = interpolatePrompt(
    userMessage,
    inputData,
    inputDataRootName,
  );

  const allUsedKeys = new Set([
    ...systemResult.usedKeys,
    ...userResult.usedKeys,
  ]);
  const fullData = reconstructFullData(inputData, inputDataRootName);
  const unusedFields = getUnusedKeys(fullData, allUsedKeys);

  let finalUserMessage = userResult.text;
  if (unusedFields.length > 0) {
    const unusedData = Object.fromEntries(
      unusedFields.map((k) => [k, fullData[k]]),
    );
    finalUserMessage = appendUnusedData(finalUserMessage, unusedData);
  }

  return {
    systemMessage: systemResult.text,
    userMessage: finalUserMessage,
    unusedFields,
    error: null,
  };
};
