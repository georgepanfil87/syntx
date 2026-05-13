/** Lowercased tokens that identify a model as embedding-only. */
const EMBEDDING_TOKENS: readonly string[] = [
  'embed', // nomic-embed-text, mxbai-embed-large
  'all-minilm', // sentence-transformers/all-MiniLM family
  'bge-', // BAAI/bge-* (large, base, small)
  'e5-', // intfloat/e5-* family
  'gte-', // Alibaba GTE family
  'arctic-embed', // Snowflake Arctic
];

/**
 * Returns `true` if `name` looks like an embedding-only model.
 * Comparison is case-insensitive; the `:tag` suffix is ignored so
 * `nomic-embed-text:latest` and `nomic-embed-text` both match.
 */
export const isEmbeddingModel = (name: string): boolean => {
  const haystack = name.toLowerCase();
  return EMBEDDING_TOKENS.some((token) => haystack.includes(token));
};

/** Inverse of {@link isEmbeddingModel} — convenience for `.filter()` chains. */
export const isGenerativeModel = (name: string): boolean => {
  return !isEmbeddingModel(name);
};
