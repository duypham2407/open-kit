# Operator Runbook: Embedding & Semantic Search

This page walks through the operator path for installing, configuring, and
verifying the semantic search pipeline end to end.

## 1. Install And Verify

### Global install

```
npm install -g @duypham93/openkit
openkit doctor
openkit run
```

This is the preferred operator path: global package install, non-mutating readiness check, then launch. The first `openkit run` materializes the managed kit into the OpenCode home directory when needed.

Manual compatibility provisioning still exists when you intentionally need it:

```
openkit install --verify
```

`openkit install --verify` is not the preferred onboarding step; it is a manual/compatibility helper that checks:

- kit materialization into the OpenCode home directory
- `better-sqlite3` native module availability
- `web-tree-sitter` and tree-sitter grammar packages
- node_modules provisioning for the managed kit

If `better-sqlite3` is missing, `openkit doctor` reports the global readiness issue and recovery guidance. If manual provisioning fails (e.g., missing build tools), you will see a clear error message.

### Verify with doctor

```
openkit doctor
```

The doctor command reports capability status for the project-graph and
embedding subsystems. Look for lines like:

```
project-graph     active     better-sqlite3 available
embedding         active     provider: ollama (nomic-embed-text)
```

If `embedding` shows `degraded` or `unavailable`, see the configuration step
below.

Use the standard capability vocabulary in reports: `available`, `unavailable`, `degraded`, `preview`, `compatibility_only`, and `not_configured`. Semantic search without embeddings may be degraded to keyword search; disabled embedding config is not configured.

Keep validation surfaces separate while debugging this stack: `openkit doctor` is `global_cli`; graph, embedding, and semantic-search tools are `runtime_tooling`; workflow-state resume and evidence diagnostics are `compatibility_runtime`; target-project app validation remains `target_project_app` only when the project defines real build, lint, or test commands.

### Verify command permission policy

`openkit doctor` also reports the OpenKit command permission policy projected into the managed kit/profile configs. Look for a line like:

```
Command permission policy: degraded | support=degraded | policy=<OPENCODE_HOME>/kits/openkit/assets/default-command-permission-policy.json
```

`degraded` is expected until OpenCode default-allow with confirm-required exception semantics are verified upstream. The canonical policy source is `assets/default-command-permission-policy.json`; the managed global kit config and `profiles/openkit/opencode.json` should match its strict-schema-safe `permission` projection and must not contain OpenKit-only top-level metadata such as `commandPermissionPolicy`. If doctor reports missing, malformed, or drifted policy state, run `openkit upgrade` and re-run `openkit doctor`.

Dangerous entries such as deletion, destructive git, publish/release/deploy, database-destructive, and privileged/system-impacting commands remain confirmation-required by policy. OpenKit does not auto-confirm prompts, intercept a pseudo-terminal, or weaken the agent git/release safety protocol.

## 2. Configure Embedding Provider

### Option A: Ollama (local, recommended for privacy)

1. Install Ollama: https://ollama.ai
2. Pull a model:
   ```
   ollama pull nomic-embed-text
   ```
3. Configure OpenKit:
   ```
   openkit configure-embedding --provider ollama --model nomic-embed-text
   ```

   Or configure via environment:
   ```
   export OLLAMA_HOST=http://localhost:11434
   ```

   Default Ollama dimensions: 768

### Option B: OpenAI

1. Get an API key from https://platform.openai.com
2. Set the environment variable (do NOT store in project config):
   ```
   export OPENAI_API_KEY=sk-...
   ```
3. Configure OpenKit:
   ```
   openkit configure-embedding --provider openai --model text-embedding-3-small
   ```

   Default OpenAI dimensions: 1536

### Option C: Custom OpenAI-compatible endpoint

```
openkit configure-embedding \
  --provider custom \
  --model my-model \
  --base-url https://my-embedding-service.example.com/v1
```

### Security note

- Always prefer environment variables for API keys.
- `openkit configure-embedding` may write provider and model to the project
  config file (`.opencode/opencode.json` or the managed workspace config).
  It does NOT store API keys in config files.
- If you accidentally store a key, remove it and rotate the key immediately.

## 3. Index A Project

### Via the runtime tool

Once OpenKit is running (`openkit run`), the semantic search tool is available
as `tool.embedding-index` inside the session. Use it with these actions:

```
tool.embedding-index index-project            # Index all project files
tool.embedding-index index-file <path>        # Index a single file
tool.embedding-index status                   # Check indexing status
```

### How indexing works

1. `ProjectGraphManager.indexProject()` walks all source files in the project.
2. For each file, it parses via tree-sitter, extracts symbols, imports, edges.
3. The `onFileIndexed` callback triggers `EmbeddingIndexer.indexFileEmbeddings()`.
4. The indexer extracts code chunks from symbols, computes chunk hashes.
5. Unchanged chunks (same hash) are reused from the SQLite DB — no re-embedding.
6. New/changed chunks are embedded in batches via the configured provider.
7. Embeddings are stored in the `embeddings` table alongside metadata.

### Incremental indexing

After the first full index, subsequent runs only re-index files whose `mtime`
has changed. Within changed files, chunk-level hashing further reduces embedding
calls — only chunks whose content actually changed get re-embedded.

## 4. Use Semantic Search

Once indexed, semantic search is available through:

- `tool.semantic-search` (primary tool, supports `search`, `context`, `session`, `recent` actions)
- `SessionMemoryManager.semanticSearchQuery()` (programmatic API)

### Search modes

| Mode | When used | How it works |
|---|---|---|
| **hybrid** | Embedding provider available + indexed project | Merges vector similarity (70%) with keyword matching (30%) plus rerank boosts |
| **embedding** | Provider available, no keyword hits | Pure vector similarity |
| **keyword** | No embedding provider or no embeddings | Symbol name matching with normalized scoring |

If semantic search returns keyword-only results because embeddings are absent, report the capability as `degraded`, not fully available. If the embedding provider is disabled or missing config, report `not_configured` until the provider is enabled.

### Example search from a session

```
tool.semantic-search search "authentication middleware"
```

Returns ranked results with:
- `path` — file path
- `score` — merged score (0-1)
- `scoreBreakdown` — { vectorScore, keywordScore, rerankBoost }
- `metadata` — symbol name, kind, line range, etc.
- `context` — expanded dependencies, dependents, same-file symbols

## 5. Verify Everything Works

Quick verification checklist:

```
# 1. Check native module
node -e "require('better-sqlite3')"

# 2. Check doctor
openkit doctor

# 3. Run embedding tests (uses MockEmbeddingProvider, no network)
node --test tests/runtime/embedding-pipeline.test.js tests/runtime/semantic-memory.test.js

# 4. Check index status after running openkit
#    (inside a session): tool.embedding-index status
```

## 6. Upgrading

```
openkit upgrade
```

This re-provisions the managed kit. The SQLite database and embeddings are
preserved across upgrades. If the DB schema changes, migrations run
automatically on next startup.

## 7. Uninstalling

```
openkit uninstall
```

This removes the managed kit from the OpenCode home directory. Project-local
`.opencode/` files are not touched. The SQLite database (if stored in the
managed workspace) is removed with the workspace.
