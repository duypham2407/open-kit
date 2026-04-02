// ---------------------------------------------------------------------------
// tool.embedding-index
//
// Operator tool for managing the embedding index.
// Allows manually triggering indexing and inspecting index status.
//
// Actions:
//   "index-file"    — generate embeddings for a single file
//   "index-project" — generate embeddings for all indexed files in the project
//   "status"        — report current embedding indexer status and stats
// ---------------------------------------------------------------------------

export function createEmbeddingIndexTool({ embeddingIndexer }) {
  const isAvailable = embeddingIndexer?.available === true;

  return {
    id: 'tool.embedding-index',
    name: 'Embedding Index Tool',
    description:
      'Manage the project embedding index for semantic code search. ' +
      'Actions: "index-file" (embed a single file), "index-project" (embed all indexed files), "status" (show indexer stats).',
    family: 'analysis',
    stage: 'foundation',
    status: isAvailable ? 'active' : 'degraded',
    async execute(input = {}) {
      const action = typeof input === 'string' ? 'status' : (input.action ?? 'status');

      switch (action) {
        case 'status': {
          if (!embeddingIndexer) {
            return {
              status: 'unavailable',
              reason: 'Embedding indexer is not configured. Set embedding.enabled = true in runtime config.',
            };
          }
          return {
            status: 'ok',
            ...embeddingIndexer.describe(),
            indexingStrategy: 'chunk-level incremental reuse',
          };
        }

        case 'index-file': {
          if (!embeddingIndexer) {
            return { status: 'unavailable', reason: 'Embedding indexer is not configured.' };
          }
          const filePath = typeof input === 'string' ? input : input.filePath;
          if (!filePath) {
            return { status: 'error', reason: 'filePath is required for index-file action.' };
          }
          return embeddingIndexer.indexFileEmbeddings(filePath);
        }

        case 'index-project': {
          if (!embeddingIndexer) {
            return { status: 'unavailable', reason: 'Embedding indexer is not configured.' };
          }
          const maxFiles = input.maxFiles ?? 2000;
          const force = input.force === true;
          return embeddingIndexer.indexProject({ maxFiles, force });
        }

        default:
          return {
            status: 'error',
            reason: `Unknown action: ${action}. Use "status", "index-file", or "index-project".`,
          };
      }
    },
  };
}
