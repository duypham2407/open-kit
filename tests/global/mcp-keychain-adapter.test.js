import test from 'node:test';
import assert from 'node:assert/strict';

import { createKeychainAdapter, keychainRef } from '../../src/global/mcp/secret-stores/keychain-adapter.js';

const SECRET = 'sk-openkit-keychain-sentinel-950';
const ref = keychainRef({ mcpId: 'context7', envVar: 'CONTEXT7_API_KEY', scope: 'openkit', kind: 'bundled' });

function memoryRunner(store = new Map()) {
  return (_cmd, args) => {
    const command = args[0];
    if (command === 'list-keychains') return 'ok';
    const account = args[args.indexOf('-a') + 1];
    const service = args[args.indexOf('-s') + 1];
    const key = `${service}/${account}`;
    if (command === 'add-generic-password') {
      store.set(key, args[args.indexOf('-w') + 1]);
      return '';
    }
    if (command === 'find-generic-password') {
      if (!store.has(key)) throw new Error('not found');
      return `${store.get(key)}\n`;
    }
    if (command === 'delete-generic-password') {
      if (!store.delete(key)) throw new Error('not found');
      return '';
    }
    throw new Error(`unexpected command ${command}`);
  };
}

test('keychain adapter stores, reads, and deletes through fake macOS security runner', () => {
  const adapter = createKeychainAdapter({ platform: 'darwin', runner: memoryRunner() });

  assert.equal(adapter.availability().status, 'available');
  const stored = adapter.set({ bindingRef: ref, value: SECRET });
  assert.equal(stored.status, 'stored');
  assert.equal(JSON.stringify(stored).includes(SECRET), false);
  assert.equal(adapter.get({ bindingRef: ref }).value, SECRET);
  const inspected = adapter.inspect({ bindingRef: ref });
  assert.equal(inspected.keyState, 'present_redacted');
  assert.equal(JSON.stringify(inspected).includes(SECRET), false);
  assert.equal(adapter.unset({ bindingRef: ref }).removed, true);
  assert.equal(adapter.get({ bindingRef: ref }).status, 'missing');
});

test('keychain adapter is unavailable on non-macOS and never runs security', () => {
  let called = false;
  const adapter = createKeychainAdapter({ platform: 'linux', runner: () => { called = true; } });
  assert.equal(adapter.availability().status, 'unavailable');
  assert.equal(adapter.set({ bindingRef: ref, value: SECRET }).status, 'unavailable');
  assert.equal(called, false);
});

test('keychain adapter sanitizes failures without leaking submitted secret', () => {
  const adapter = createKeychainAdapter({ platform: 'darwin', runner: (_cmd, args) => {
    if (args[0] === 'list-keychains') return 'ok';
    throw new Error(`denied ${SECRET}`);
  } });
  const result = adapter.set({ bindingRef: ref, value: SECRET });
  assert.equal(result.status, 'failed');
  assert.equal(JSON.stringify(result).includes(SECRET), false);
});
