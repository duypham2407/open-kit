import fs from 'node:fs';
import path from 'node:path';

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export class PersistentBackgroundStore {
  constructor({ projectRoot, runtimeRoot = projectRoot, mode = 'read-write' }) {
    this.projectRoot = projectRoot;
    this.runtimeRoot = runtimeRoot;
    this.mode = mode;
    this.root = path.join(runtimeRoot, '.opencode', 'background-runs');
    this.indexPath = path.join(this.root, 'index.json');
  }

  ensureWritableStore() {
    ensureDir(this.root);
    if (!fs.existsSync(this.indexPath)) {
      writeJson(this.indexPath, { runs: [] });
    }
  }

  runPath(runId) {
    return path.join(this.root, `${runId}.json`);
  }

  readIndex() {
    return readJsonIfExists(this.indexPath) ?? { runs: [] };
  }

  writeIndex(index) {
    writeJson(this.indexPath, index);
  }

  save(run) {
    if (this.mode === 'read-only') {
      return run;
    }

    this.ensureWritableStore();
    const index = this.readIndex();
    const summary = {
      run_id: run.id,
      workflow_run_id: run.workflowRunId ?? null,
      title: run.title,
      status: run.status,
      work_item_id: run.link?.workItemId ?? null,
      task_id: run.link?.taskId ?? null,
      created_at: run.createdAt,
      updated_at: run.updatedAt,
    };
    const existingIndex = index.runs.findIndex((entry) => entry.run_id === run.id);
    if (existingIndex === -1) {
      index.runs.push(summary);
    } else {
      index.runs[existingIndex] = summary;
    }
    writeJson(this.runPath(run.id), run);
    this.writeIndex(index);
    return run;
  }

  load(runId) {
    return readJsonIfExists(this.runPath(runId));
  }

  list() {
    return this.readIndex().runs;
  }
}
