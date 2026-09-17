import { z } from 'zod';

const contentResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  type: z.enum(['prompt', 'composer', 'snippet']),
  url: z.string(),
});

export const mcpConnectionToolInputSchema = z.object({});
export type McpConnectionToolInput = z.infer<
  typeof mcpConnectionToolInputSchema
>;

export const mcpConnectionToolOutputSchema = z.object({
  workspaceId: z.string(),
  scopes: z
    .array(z.string())
    .describe(
      'Current effective permissions shared by the token and connection grant.',
    ),
  authoringAvailable: z
    .boolean()
    .describe(
      'Whether authoring and testing tools are enabled on this server; individual scopes still apply.',
    ),
  canRunTests: z
    .boolean()
    .describe(
      'Whether testing is enabled and this request has mcp:run permission. Model credentials and test inputs are validated separately.',
    ),
});
export type McpConnectionToolOutput = z.infer<
  typeof mcpConnectionToolOutputSchema
>;

export const mcpSearchToolInputSchema = z.object({
  query: z.string().max(200).default(''),
  type: z.enum(['prompt', 'composer', 'snippet']).optional(),
  offset: z.number().int().min(0).max(100_000).default(0),
  limit: z.number().int().min(1).max(100).default(25),
});
export type McpSearchToolInput = z.infer<typeof mcpSearchToolInputSchema>;

export const mcpSearchToolOutputSchema = z.object({
  items: z.array(contentResultSchema),
  nextOffset: z.number().nullable(),
});
export type McpSearchToolOutput = z.infer<typeof mcpSearchToolOutputSchema>;
