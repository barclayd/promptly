// Invalidate prompt metadata only (for update - name/description changes)
export const invalidatePromptCache = async (
  cache: KVNamespace,
  promptId: string,
) => {
  await cache.delete(`prompt:${promptId}`);
};

// Invalidate prompt and all its versions (for delete)
export const invalidatePromptAndVersions = async (
  cache: KVNamespace,
  promptId: string,
) => {
  // Delete prompt metadata
  await cache.delete(`prompt:${promptId}`);

  // List and delete all version keys
  const list = await cache.list({ prefix: `version:${promptId}:` });
  await Promise.all(list.keys.map((k) => cache.delete(k.name)));
};

type VersionCacheData = {
  systemMessage: string;
  userMessage: string;
  config: Record<string, unknown>;
  version: string;
};

// Cache published version and invalidate latest (for publish)
export const cachePublishedVersion = async (
  cache: KVNamespace,
  promptId: string,
  version: string,
  data: VersionCacheData,
) => {
  const value = JSON.stringify(data);

  // Cache the specific version permanently (no TTL - immutable)
  await cache.put(`version:${promptId}:${version}`, value);

  // Invalidate 'latest' so API worker re-fetches
  await cache.delete(`version:${promptId}:latest`);
};
