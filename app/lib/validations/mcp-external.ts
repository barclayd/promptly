import { z } from 'zod';
import { mcpAuthoringReadSchema } from './mcp-authoring';

const id = z.string().min(1).max(200);
export const externalMcpServerSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  name: z.string().trim().min(1).max(200),
  resource: z
    .string()
    .max(2048)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          url.protocol === 'https:' &&
          url.pathname.endsWith('/mcp') &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          url.href === value
        );
      } catch {
        return false;
      }
    }, 'Use an exact HTTPS MCP resource URL.'),
  organizationId: id,
  sharedSecret: z.string().min(32).max(512),
});
export type ExternalMcpServer = z.infer<typeof externalMcpServerSchema>;
export const externalMcpServersSchema = z
  .array(externalMcpServerSchema)
  .max(20)
  .refine(
    (servers) =>
      new Set(servers.map((server) => server.id)).size === servers.length &&
      new Set(servers.map((server) => server.resource)).size === servers.length,
    'External server IDs and resources must be unique.',
  );
export type ExternalMcpServers = z.infer<typeof externalMcpServersSchema>;

export const externalMcpSubjectSchema = z.strictObject({
  userId: id,
  organizationId: id,
  connectionId: id,
});
export type ExternalMcpSubject = z.infer<typeof externalMcpSubjectSchema>;

export const externalMcpReadSchema = z.discriminatedUnion('tool', [
  z.strictObject({
    tool: z.literal('get_connection'),
    arguments: z.strictObject({}),
  }),
  z.strictObject({
    tool: z.literal('get_prompt'),
    arguments: mcpAuthoringReadSchema,
  }),
  z.strictObject({
    tool: z.literal('get_composer'),
    arguments: mcpAuthoringReadSchema,
  }),
  z.strictObject({
    tool: z.literal('get_snippet'),
    arguments: mcpAuthoringReadSchema,
  }),
]);
export type ExternalMcpRead = z.infer<typeof externalMcpReadSchema>;

export const externalMcpRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('introspect'),
    token: z.string().min(1).max(8192),
    resource: z.string().min(1).max(2048),
  }),
  z.strictObject({
    action: z.literal('read'),
    subject: externalMcpSubjectSchema,
    tool: z.enum([
      'get_connection',
      'get_prompt',
      'get_composer',
      'get_snippet',
    ]),
    arguments: z.record(z.string(), z.unknown()),
  }),
]);
export type ExternalMcpRequest = z.infer<typeof externalMcpRequestSchema>;

export const mcpStoredGrantAudienceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clientId: z.string(),
  resource: z.string(),
});
export type McpStoredGrantAudience = z.infer<
  typeof mcpStoredGrantAudienceSchema
>;
export const externalMcpStoredGrantSchema = mcpStoredGrantAudienceSchema.extend(
  {
    scope: z
      .array(z.enum(['mcp:read', 'mcp:run']))
      .min(1)
      .max(2),
    createdAt: z.number().int().positive(),
    expiresAt: z.number().int().positive().optional(),
  },
);
export type ExternalMcpStoredGrant = z.infer<
  typeof externalMcpStoredGrantSchema
>;
