import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import {
  cachedMcpJsonSchema,
  cachedMcpSchema,
} from '../../app/lib/mcp/schema.server';
import * as history from '../../app/lib/validations/authoring-history';
import * as mutations from '../../app/lib/validations/authoring-mutations';
import * as authoring from '../../app/lib/validations/mcp-authoring';
import * as foundation from '../../app/lib/validations/mcp-protocol';
import { expect, test } from '../fixtures/base';

test('cached MCP schemas retain the original JSON contracts in both directions', () => {
  for (const [name, schema] of Object.entries({
    ...history,
    ...mutations,
    ...authoring,
    ...foundation,
  })) {
    if (!(schema instanceof z.ZodType)) continue;
    const cached = cachedMcpJsonSchema(schema);
    for (const direction of ['input', 'output'] as const) {
      const options = { target: 'draft-2020-12' } as const;
      const original = schema['~standard'].jsonSchema[direction];
      let expected: Record<string, unknown>;
      try {
        expected = original(options);
      } catch (error) {
        expect(() => cached[direction](options), name).toThrow(
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }
      expect(cached[direction](options), name).toEqual(expected);
      expect(cachedMcpJsonSchema(schema)[direction](options), name).toEqual(
        expected,
      );
    }
  }
});

test('fresh MCP servers convert each static schema once without caching vendor options', async () => {
  const schema = z.object({ value: z.string().default('default value') });
  const source = schema['~standard'].jsonSchema;
  const input = source.input;
  const output = source.output;
  let inputCalls = 0;
  let outputCalls = 0;
  Object.assign(source, {
    input: (options: Parameters<typeof input>[0]) => {
      inputCalls++;
      return input(options);
    },
    output: (options: Parameters<typeof output>[0]) => {
      outputCalls++;
      return output(options);
    },
  });
  for (let index = 0; index < 20; index++) {
    const server = new McpServer({ name: 'Schema regression', version: '1' });
    server.registerTool(
      'echo',
      {
        inputSchema: cachedMcpSchema(schema),
        outputSchema: cachedMcpSchema(schema),
      },
      (value) => ({ content: [], structuredContent: value }),
    );
    await server.close();
  }
  expect(inputCalls).toBe(1);
  expect(outputCalls).toBe(1);
  const cached = cachedMcpJsonSchema(schema);
  const defaultOptions = { target: 'draft-2020-12' } as const;
  expect(cached.input(defaultOptions).required).toBeUndefined();
  expect(cached.output(defaultOptions).required).toEqual(['value']);
  for (let index = 0; index < 2; index++) {
    const options = { target: 'draft-07' } as const;
    expect(cached.input(options)).toEqual(input(options));
    expect(cached.output(options)).toEqual(output(options));
    const vendorOptions = { ...defaultOptions, libraryOptions: {} };
    expect(cached.input(vendorOptions)).toEqual(input(vendorOptions));
    expect(cached.output(vendorOptions)).toEqual(output(vendorOptions));
  }
  expect(inputCalls).toBe(5);
  expect(outputCalls).toBe(5);
});

test('cached MCP schemas still validate every value and apply Zod transforms', async () => {
  let validations = 0;
  const schema = z.strictObject({
    name: z.string().trim().min(1),
    count: z.number().int().min(1).default(2),
  });
  const original = schema['~standard'].validate;
  Object.assign(schema['~standard'], {
    validate: (...args: Parameters<typeof original>) => {
      validations++;
      return original(...args);
    },
  });
  for (const value of [
    { name: '  first  ' },
    { name: 'second', count: 3 },
    { name: ' ' },
    { name: 'third', count: 0 },
    { name: 'fourth', unexpected: true },
  ]) {
    const cached = cachedMcpSchema(schema);
    expect(await cached['~standard'].validate(value)).toEqual(
      await original(value),
    );
  }
  expect(validations).toBe(5);
});
