# External preview services

Promptly can authorize a configured external MCP service using the existing Promptly sign-in, workspace membership, and OAuth issuer. The service can read definitions on behalf of an explicitly consented connection. Optional `mcp:run` consent lets the external service run previews using customer inputs and its configured model providers, which may incur provider charges. The bridge does not execute models, send emails, edit drafts, or publish content.

External services are disabled when `MCP_EXTERNAL_SERVERS` is absent or `[]`. `MCP_ENABLED=false` disables them along with native MCP. Native `/mcp` does not accept external grants.

## Configure a service

Apply migration `0030_mcp_external_connections.sql` before enabling an external registration. Configure `MCP_EXTERNAL_SERVERS` as a **Worker secret**, containing an array with this shape:

```json
[
  {
    "id": "preview-engine",
    "name": "External preview engine",
    "resource": "https://preview.example/mcp",
    "organizationId": "YOUR_WORKSPACE_ID",
    "sharedSecret": "REPLACE_WITH_A_RANDOM_SERVICE_SECRET"
  }
]
```

Use a cryptographically random secret with at least 32 bytes of entropy. Store the same value in the external service's secret manager. Do not put the registration JSON, real workspace IDs, secrets, OAuth tokens, or customer inputs in source control, Terraform outputs, CLI arguments, or logs. Set the Worker secret through a secure prompt or a private input file, for example `bunx wrangler secret put MCP_EXTERNAL_SERVERS`. Local development can use an ignored `.env` or `.dev.vars` file.

Each registration has one unique ID, one exact HTTPS resource URL ending in `/mcp`, and one workspace. Query strings, fragments, credentials in URLs, and duplicate IDs/resources are rejected. There are at most 20 registrations. A malformed configuration disables all external registrations while leaving native MCP independent.

The external MCP server advertises its own resource metadata and Promptly's issuer. Clients request the exact external `resource`, `mcp:read`, and optionally `mcp:run`, using S256 PKCE. Existing Promptly `/oauth/authorize` and `/oauth/token` endpoints handle authorization and exchange. Consent displays the external service and resource, offers read access only, and leaves external preview execution unchecked. External requests for `mcp:write` or `mcp:publish` are rejected.

## Bridge API

All calls use `POST /api/mcp/external/:serverId` on Promptly's canonical HTTPS origin with `Content-Type: application/json` and `Authorization: Bearer <sharedSecret>`. Bodies are limited to 16 KiB. Responses have `Cache-Control: no-store`. Credentials are compared using constant-time comparison of SHA-256 digests.

### Introspect an incoming engine access token

```json
{
  "action": "introspect",
  "resource": "https://preview.example/mcp",
  "token": "INCOMING_ENGINE_ACCESS_TOKEN"
}
```

An invalid, expired, revoked, wrong-audience, or otherwise unavailable token returns `{ "active": false }`. An active result contains:

```json
{
  "active": true,
  "userId": "USER_ID",
  "organizationId": "WORKSPACE_ID",
  "connectionId": "CONNECTION_ID",
  "scopes": ["mcp:read", "mcp:run"],
  "expiresAt": 1800000000000
}
```

`expiresAt` is epoch **milliseconds**. Scopes are the intersection of the effective access token, live D1 connection, and active OAuth grant. The engine must require `mcp:run` for operations involving customer data or paid preview execution. An access token is sent only to this authorization-server introspection action; never forward it to Promptly's native MCP or definition read endpoints.

### Read definitions for a consented job

```json
{
  "action": "read",
  "subject": {
    "userId": "USER_ID",
    "organizationId": "WORKSPACE_ID",
    "connectionId": "CONNECTION_ID"
  },
  "tool": "get_prompt",
  "arguments": {
    "id": "PROMPT_ID",
    "version": { "kind": "draft" }
  }
}
```

Only `get_connection`, `get_prompt`, `get_composer`, and `get_snippet` are allowed. `get_connection` takes empty arguments. Definition reads use the same explicit `draft`, `working`, `latest`, or exact `published` selector as native MCP, without missing-version fallback. Their response is the existing MCP tool result: `content: [{type: "text", text: JSON.stringify(value)}]` plus `structuredContent: value`. Domain failures return the same structured `isError: true` result. Definition reads require `MCP_AUTHORING_ENABLED=true`.

The external service credential authorizes delegation only for that registration's D1-bound, unrevoked connection and its current workspace member. IDs supplied in `subject` never grant access by themselves. Jobs store these IDs and immutable snapshots, not user access or refresh tokens. Before starting or resuming paid work, the engine must recheck the connection's current `mcp:run` permission. Replaying a captured snapshot must not fetch fresh customer data.

Invalid service credentials return 401, unavailable delegated access returns 403, malformed requests return 400, unsupported media returns 415, and oversized bodies return 413. Throttled requests return 429 with `Retry-After`. Public bridge traffic has separate limits of 120 requests per source per minute and 600 globally; source addresses are hashed before storage. Stale rate keys are removed in bounded batches, and the global limit bounds new source-key growth. Authorized reads also share the existing 120/minute connection and 600/minute workspace MCP limits. MCP usage remains separate from application API-call allowance.

## Rotate, disable, and revoke

To rotate a service credential, generate a new random value and update both the external service secret manager and `MCP_EXTERNAL_SERVERS`. Only one credential per registration is accepted, so coordinate the change during a brief pause; old credentials immediately stop authenticating after the new configuration is active. Existing user grants remain bound to the same server/resource/workspace.

Remove a registration, or set the secret to `[]`, to stop new consent, token issuance/refresh, introspection, and delegated reads for that service. Changing the registration's resource or workspace invalidates old bindings; users must reconnect. Disabling and later restoring an identical registration can reactivate still-valid grants. For permanent removal, also revoke its connections from Promptly Settings.

Members can revoke their own connection. Workspace owners/admins can revoke any workspace connection. Settings shows the external resource alongside each external connection. Revocation is authoritative in D1 even if a token or grant remains visible through KV replication. RFC 7009 access-token or refresh-token revocation revokes the whole connection. Membership deletion or loss, scope removal, and grant expiry are checked again on every delegated call. Refresh grants expire after 30 days; reconnect after expiry.

## Provider dependency and verification

This integration pins `@cloudflare/workers-oauth-provider` to 0.10.3. Authorization helpers and native MCP keep a canonical resource. Only `/oauth/token` uses the provider's unpinned resource mode, with its default strict URI matching (`resourceMatchOriginOnly=false`); requested token audiences must be contained in the original grant. Token callbacks additionally compare the stored grant audience with the authoritative D1 binding.

The provider has no single-grant lookup API. The bounded external access adapter reads its `grant:<userId>:<grantId>` KV record using IDs obtained from D1 and validates client, resource, scopes, and expiry. This storage-format dependency, together with the existing RFC 7009 revocation adapter, must be reviewed on provider upgrades. Access-token decryption and validation use the provider's `unwrapToken` API.

`e2e/tests/mcp-external.spec.ts` exercises real Miniflare D1/KV and the production consent/token/read handlers, including PKCE, single-use consent, native compatibility, audience/scope escalation, delegated reads, workspace isolation, revoked/expired grants, disabled registrations, and stripped-prop rejection. `mcp-rate-limits.spec.ts` verifies isolated source/global thresholds and bounded cleanup.

References: [Cloudflare OAuth provider](https://github.com/cloudflare/workers-oauth-provider), [Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [RFC 8707 resource indicators](https://www.rfc-editor.org/rfc/rfc8707), [RFC 7009 revocation](https://www.rfc-editor.org/rfc/rfc7009).
