export const invalidatePromptCache = async (
  cache: KVNamespace,
  promptId: string,
) => {
  await cache.delete(`prompt:${promptId}`);
};
