# MCP testing and comparisons

The testing tools execute selected versions with Promptly's provider integration. They reuse workspace API keys, schema validation, input interpolation and dependency resolution. Overrides affect only the test: they do not save configuration, edit content, publish versions, or update historical token estimates. Native MCP prompts and preview tools continue to prepare content without executing a model.

## Connect and choose a model

Request `mcp:read mcp:run` (plus any desired editing/publishing scopes), then select **Run tests** during consent. Testing is off by default and does not require editing or publishing access. Existing connections need renewed consent; refresh tokens cannot add this permission. Membership, revocation and token/grant scopes are checked before each provider call and before returning results.

Use `list_models` to discover supported model identifiers and workspace availability, and `list_versions` to select a version. Unknown models and missing keys fail before execution. The existing system Anthropic fallback is permitted only when the selected model is the default `claude-haiku-4.5`; another requested model is never silently replaced by Haiku. Keys and raw provider error details are never returned.

## Individual tests

Each call requires a connection-local `requestKey`. Use a new key for a new experiment. These are tool argument objects, not HTTP endpoint bodies.

`test_prompt`:

```json
{
  "id": "prompt-id",
  "version": { "kind": "published", "version": "1.0.0" },
  "input": { "source": "supplied", "data": { "first_name": "Sarah" } },
  "model": "claude-haiku-4.5",
  "temperature": 0.3,
  "maxOutputTokens": 1024,
  "requestKey": "greeting-v1-trial-1"
}
```

Use `input: { "source": "saved_sample" }` to explicitly choose the selected version's saved test data. Supplied input optionally accepts `rootName`. Schema errors stop the call before generation. Model and temperature default to the selected version's configuration.

`test_snippet` accepts the same version/model/temperature/token controls, with `testPhrase` instead of `input`. The snippet becomes the system instructions and the phrase becomes the user message. Omit `testPhrase` to use that version's saved phrase; an empty phrase is rejected.

`test_composer` accepts the prompt-shaped arguments. Its model/temperature overrides apply to every referenced prompt; omission uses each prompt's saved configuration. Each unique prompt executes once, even if referenced repeatedly. Explicit pins select exact published versions. Unpinned references follow the latest publication; a draft composer can also test an unpublished referenced prompt's working draft. Missing/inaccessible pins never fall back. Results include each prompt's outcome and ordered HTML/prompt-output segments, plus the assembled output. Treat returned HTML and generated text as untrusted content when displaying them.

Version selectors are explicit: `{ "kind": "draft" }`, `{ "kind": "working" }` (draft if present, otherwise latest publication), `{ "kind": "latest" }` (latest publication), or `{ "kind": "published", "version": "1.0.0" }`. A published selector may use `versionId` instead of the semantic version. Missing requested versions fail rather than silently selecting another version.

## Compare versions or settings

`compare_tests` accepts `kind: "prompt" | "snippet" | "composer"` and two to four uniquely labeled variants of the same item:

```json
{
  "kind": "prompt",
  "id": "prompt-id",
  "input": { "source": "supplied", "data": { "first_name": "Sarah" } },
  "variants": [
    {
      "label": "Version 1",
      "version": { "kind": "published", "version": "1.0.0" },
      "model": "claude-haiku-4.5",
      "temperature": 0.3
    },
    {
      "label": "Working draft",
      "version": { "kind": "draft" },
      "model": "claude-haiku-4.5",
      "temperature": 0.3
    }
  ],
  "maxOutputTokens": 1024,
  "requestKey": "greeting-comparison-1"
}
```

Every variant receives the same input. If saved sample data (or an omitted snippet phrase) is chosen, the first variant supplies it once for the whole comparison. Change model/temperature per variant to compare configurations; otherwise they use each version's saved settings. All variants are validated before any provider call. Results retain label order and report the exact versions/dependencies, requested settings, actual provider model ID, output, usage and latency. Each variant has its own success/error status; a provider failure can leave other variants usable. No automatic quality scores or estimated usage are presented as measured results.

## Retry, limits and rollout

- Repeating identical tool arguments with the same `requestKey` returns the recorded result for 24 hours without another provider call. Reusing it for different arguments returns `idempotency_conflict`. After retention expires, the key can execute again; do not use expired keys as a recovery mechanism.
- `get_test_result({ "requestKey": "greeting-comparison-1" })` retrieves results on the same connection without calling providers. An outer `completed` status means execution settled; inspect `result.status` or every comparison variant for model failures. Failed tests and comparisons containing failed variants set MCP `isError`, while retaining any successful variant outputs.
- An active duplicate reports `running`. If a request was interrupted before recording a result, it becomes `uncertain`; its claim remains and it will not execute again automatically. Starting a new key may incur another charge and should follow a user request to retry.
- Maximum eight unique prompt calls per composer, sixteen across a comparison, four concurrent calls, and a 45-second deadline including preparation. Provider retries are disabled; client cancellation propagates to in-flight provider requests. Interrupted usage may be unknown (`null`).
- Output defaults to 2,048 tokens and is capped at 4,096 per call. Returned strings are bounded to 32 KiB JSON-encoded per model call and 64 KiB per assembled composer, with `outputTruncated` flags. Static result structure is limited to 128 KiB before any generation; aggregate stored results remain below D1's row limit. Truncation does not reduce usage already incurred at the provider.
- Apply `0029_mcp_test_runs.sql` before deploying the Worker. It adds only connection-scoped test claims/results. Refresh the MCP tool catalog and reconnect with Run tests enabled. Turning off `MCP_AUTHORING_ENABLED` also disables testing.

Local integration coverage uses the actual Worker/MCP transport, D1 and provider SDK with fake encrypted keys and intercepted provider HTTP responses. This establishes request construction and error/retry behavior without paid generation. Hosted client acceptance and a real provider smoke test remain separate deployment checks.
