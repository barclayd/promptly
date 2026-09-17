import { z } from 'zod';

export const mcpScopeSchema = z.enum([
  'mcp:read',
  'mcp:write',
  'mcp:publish',
  'mcp:run',
]);
export type McpScope = z.infer<typeof mcpScopeSchema>;

export const mcpPermissionSchema = z.enum(['read', 'edit', 'publish']);
export type McpPermission = z.infer<typeof mcpPermissionSchema>;

export const scopesForMcpPermission = (
  permission: McpPermission,
): McpScope[] => {
  if (permission === 'publish') {
    return ['mcp:read', 'mcp:write', 'mcp:publish'];
  }
  return permission === 'edit' ? ['mcp:read', 'mcp:write'] : ['mcp:read'];
};

export const permissionForMcpScopes = (
  scopes: readonly McpScope[],
): McpPermission => {
  if (scopes.includes('mcp:publish')) return 'publish';
  return scopes.includes('mcp:write') ? 'edit' : 'read';
};

export const mcpScopesSchema = z.array(mcpScopeSchema).min(1).max(4);

export const mcpGrantScopesSchema = mcpScopesSchema.refine(
  (scopes) => {
    const expected = scopesForMcpPermission(permissionForMcpScopes(scopes));
    const contentScopes = scopes.filter((scope) => scope !== 'mcp:run');
    return (
      new Set(scopes).size === scopes.length &&
      expected.length === contentScopes.length &&
      expected.every((scope) => scopes.includes(scope))
    );
  },
  {
    message: 'MCP grant permissions must include their lower permission levels',
  },
);

export const createMcpConnectionSchema = z.object({
  userId: z.string().min(1).max(200),
  clientId: z.string().min(1).max(2048),
  clientName: z.string().trim().min(1).max(200),
  permission: mcpPermissionSchema.default('edit'),
  allowTesting: z.boolean().default(false),
});
export type CreateMcpConnectionInput = z.input<
  typeof createMcpConnectionSchema
>;

export const mcpConnectionPropsSchema = z.object({
  connectionId: z.string().min(1).max(200),
  userId: z.string().min(1).max(200),
  organizationId: z.string().min(1).max(200),
  clientId: z.string().min(1).max(2048),
  scopes: mcpScopesSchema,
});
export type McpConnectionProps = z.infer<typeof mcpConnectionPropsSchema>;

export const mcpConsentSchema = z.object({
  permission: mcpPermissionSchema.default('edit'),
  allowTesting: z.boolean().default(false),
});
export type McpConsentInput = z.infer<typeof mcpConsentSchema>;

export const revokeMcpConnectionSchema = z.object({
  connectionId: z.string().min(1).max(200),
});
export type RevokeMcpConnectionInput = z.infer<
  typeof revokeMcpConnectionSchema
>;

export const mcpClientRegistrationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  redirects: z
    .string()
    .max(4000)
    .transform((value) =>
      value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z.url().refine((value) => {
            const url = new URL(value);
            return (
              !url.hash &&
              !url.username &&
              !url.password &&
              (url.protocol === 'https:' ||
                value === 'cursor://anysphere.cursor-mcp/oauth/callback' ||
                (url.protocol === 'http:' &&
                  ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
            );
          }, 'Use HTTPS, a local loopback callback, or Cursor’s exact native OAuth callback URL.'),
        )
        .min(1)
        .max(10),
    ),
  authentication: z.enum(['none', 'client_secret_post']),
});
export type McpClientRegistrationInput = z.infer<
  typeof mcpClientRegistrationSchema
>;
