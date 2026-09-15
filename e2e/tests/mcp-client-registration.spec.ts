import { mcpClientRegistrationSchema } from '../../app/lib/validations/mcp';
import { expect, test } from '../fixtures/base';

test('MCP manual registration accepts Cursor’s exact native callback alongside HTTPS and loopback callbacks', () => {
  const redirects = [
    'cursor://anysphere.cursor-mcp/oauth/callback',
    'https://www.cursor.com/agents/mcp/oauth/callback',
    'http://localhost:8787/callback',
  ];
  const parsed = mcpClientRegistrationSchema.parse({
    name: 'Cursor',
    redirects: redirects.join('\n'),
    authentication: 'none',
  });
  expect(parsed.redirects).toEqual(redirects);
  expect(parsed.authentication).toBe('none');
});

test('MCP manual registration rejects arbitrary schemes and altered native callback destinations', () => {
  for (const redirects of [
    'vscode://anysphere.cursor-mcp/oauth/callback',
    'com.example.app:/oauth/callback',
    'javascript:alert(1)',
    'file:///oauth/callback',
    'cursor://untrusted.example/oauth/callback',
    'cursor://anysphere.cursor-mcp.evil.example/oauth/callback',
    'cursor://anysphere.cursor-mcp/other/callback',
    'cursor://anysphere.cursor-mcp/oauth/callback/',
    'cursor://anysphere.cursor-mcp/oauth/callback?next=https://untrusted.example',
    'cursor://anysphere.cursor-mcp/oauth/callback#fragment',
    'cursor://user@anysphere.cursor-mcp/oauth/callback',
    'cursor://anysphere.cursor-mcp:1234/oauth/callback',
    'CURSOR://anysphere.cursor-mcp/oauth/callback',
    'http://untrusted.example/oauth/callback',
  ]) {
    expect(
      mcpClientRegistrationSchema.safeParse({
        name: 'Client',
        redirects,
        authentication: 'none',
      }).success,
      redirects,
    ).toBe(false);
  }
});
