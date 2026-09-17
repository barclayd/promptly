import { AjvJsonSchemaValidator } from '@modelcontextprotocol/server/validators/ajv';
import { z } from 'zod';
import { expect, test } from '../fixtures/base';
import { mcpRpc, withMcpAuthoring } from '../fixtures/mcp-authoring';

const beforeTestingCapabilitySchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object' as const,
  properties: {
    workspaceId: { type: 'string' as const },
    scopes: { type: 'array' as const, items: { type: 'string' as const } },
    authoringAvailable: { type: 'boolean' as const },
  },
  required: ['workspaceId', 'scopes', 'authoringAvailable'],
  additionalProperties: false,
};

const initialTestingCapabilitySchema = {
  ...beforeTestingCapabilitySchema,
  properties: {
    ...beforeTestingCapabilitySchema.properties,
    canRunTests: { type: 'boolean' as const },
  },
  required: [...beforeTestingCapabilitySchema.required, 'canRunTests'],
};

test('MCP catalog refresh resolves cached connection schemas and permits future output additions', async () => {
  const validator = new AjvJsonSchemaValidator();
  const validateBeforeCapability = validator.getValidator(
    beforeTestingCapabilitySchema,
  );
  const validateInitialCapability = validator.getValidator(
    initialTestingCapabilitySchema,
  );
  await withMcpAuthoring(async (runtime, db) => {
    const scopes = ['mcp:read', 'mcp:run'];
    await db
      .prepare(
        "UPDATE mcp_connection SET scopes = ? WHERE id = 'connection-read'",
      )
      .bind(JSON.stringify(scopes))
      .run();
    for (const legacy of [false, true]) {
      const options = { legacy, permission: 'read' as const, scopes };
      const discovery = await mcpRpc(
        runtime,
        legacy ? 'initialize' : 'server/discover',
        legacy
          ? {
              protocolVersion: '2025-11-25',
              capabilities: {},
              clientInfo: { name: 'Schema regression', version: '1.0.0' },
            }
          : {},
        options,
      );
      expect(discovery.body.error).toBeUndefined();
      const serverInfo = {
        name: 'Promptly',
        version: '0.2.0',
      };
      expect(discovery.body.result).toMatchObject(
        legacy
          ? { serverInfo }
          : { _meta: { 'io.modelcontextprotocol/serverInfo': serverInfo } },
      );
      const call = await mcpRpc(
        runtime,
        'tools/call',
        { name: 'get_connection', arguments: {} },
        options,
      );
      expect(call.response.status).toBe(200);
      expect(call.body.error).toBeUndefined();
      expect(call.body.result?.isError).not.toBe(true);
      const output = z
        .record(z.string(), z.unknown())
        .parse(call.body.result?.structuredContent);
      expect(output).toEqual({
        workspaceId: 'workspace',
        scopes,
        authoringAvailable: true,
        canRunTests: true,
      });
      expect(validateBeforeCapability(output)).toMatchObject({
        valid: false,
        errorMessage: 'data must NOT have additional properties',
      });
      expect(validateInitialCapability(output).valid).toBe(true);
      const { canRunTests: _, ...beforeCapabilityOutput } = output;
      expect(validateBeforeCapability(beforeCapabilityOutput).valid).toBe(true);
      expect(validateInitialCapability(beforeCapabilityOutput)).toMatchObject({
        valid: false,
        errorMessage: "data must have required property 'canRunTests'",
      });

      const listing = await mcpRpc(runtime, 'tools/list', {}, options);
      expect(listing.body.error).toBeUndefined();
      const tools = z
        .array(
          z.object({
            name: z.string(),
            outputSchema: z.record(z.string(), z.unknown()),
          }),
        )
        .parse(listing.body.result?.tools);
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          'test_prompt',
          'test_snippet',
          'test_composer',
          'compare_tests',
          'get_test_result',
        ]),
      );
      const schema = tools.find(
        (tool) => tool.name === 'get_connection',
      )?.outputSchema;
      expect(schema).toBeDefined();
      if (!schema) throw new Error('Missing connection output schema');
      const validateRefreshed = validator.getValidator(schema);
      expect(validateRefreshed(output).valid).toBe(true);
      expect(
        validateRefreshed({ ...output, futureCapability: true }).valid,
      ).toBe(true);
      expect(validateRefreshed({ ...output, canRunTests: 'true' }).valid).toBe(
        false,
      );
      expect(validateRefreshed(beforeCapabilityOutput).valid).toBe(false);
    }
  });
});
