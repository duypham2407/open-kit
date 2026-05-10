import test from 'node:test';
import assert from 'node:assert/strict';
import { ContextAssemblyManager } from '../../runtime/managers/context-assembly-manager.js';
import { ProjectGraphDb } from '../../runtime/analysis/project-graph-db.js';
import { BudgetManager } from '../../runtime/lib/budget-manager.js';
import { ResultRanker } from '../../runtime/lib/result-ranker.js';

test('gathers task-level context', async () => {
  const db = new ProjectGraphDb({ dbPath: ':memory:' });
  const budgetManager = new BudgetManager();
  const ranker = new ResultRanker();

  const manager = new ContextAssemblyManager({
    layers: {
      structural: { db },
      semantic: null,
      intent: null
    },
    budgetManager,
    ranker
  });

  const nodeId = db.insertNode({ path: '/test/file.js' });
  db.insertSymbol({ nodeId, name: 'testFunc', kind: 'function' });

  const context = await manager.gatherTaskContext({
    task: 'Test task',
    focus: ['/test/file.js'],
    depth: 'medium',
    budget: 1000
  });

  assert.ok(context.primaryContext);
  assert.ok(context.metadata);
  assert(context.metadata.budgetUsage.used <= 1000);
});
