import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

import { SchemaManager } from '../../src/runtime/analysis/schema-migrations.js';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');

test('tracks current schema version', () => {
  const db = new Database(':memory:');
  const manager = new SchemaManager(db);

  const version = manager.getCurrentVersion();
  assert.strictEqual(version, 0); // Fresh DB
});

test('applies migrations in order', () => {
  const db = new Database(':memory:');
  const manager = new SchemaManager(db);

  const migrations = [
    {
      version: 1,
      up: (db) => db.exec('CREATE TABLE test1 (id INTEGER)'),
    },
    {
      version: 2,
      up: (db) => db.exec('CREATE TABLE test2 (id INTEGER)'),
    },
  ];

  manager.migrate(migrations);

  assert.strictEqual(manager.getCurrentVersion(), 2);

  // Verify tables exist
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all();
  const tableNames = tables.map((t) => t.name);
  assert(tableNames.includes('test1'));
  assert(tableNames.includes('test2'));
});
