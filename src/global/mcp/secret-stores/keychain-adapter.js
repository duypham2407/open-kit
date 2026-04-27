import { execFileSync } from 'node:child_process';
import os from 'node:os';

import { redactedKeyState, redactKnownSecrets } from '../redaction.js';

export const KEYCHAIN_STORE = 'keychain';

export function keychainRef({ mcpId, envVar, scope = 'openkit', kind = 'bundled' }) {
  return {
    store: KEYCHAIN_STORE,
    service: `dev.openkit.mcp.${scope}`,
    account: `${kind}:${mcpId}:${envVar}`,
  };
}

function normalizeRunner(runner = execFileSync, command = '/usr/bin/security') {
  return (args, options = {}) => runner(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options });
}

function sanitize(error, secrets = []) {
  const message = error?.stderr?.toString?.() || error?.message || String(error);
  return redactKnownSecrets(message, { secrets });
}

export function createKeychainAdapter({ runner = execFileSync, platform = os.platform(), env = process.env } = {}) {
  const run = normalizeRunner(runner, env.OPENKIT_SECURITY_CLI ?? '/usr/bin/security');
  return {
    id: KEYCHAIN_STORE,
    availability() {
      if (platform !== 'darwin') {
        return { status: 'unavailable', reason: 'keychain_requires_macos', remediation: 'Use --store local_env_file on this platform.' };
      }
      try {
        run(['list-keychains']);
        return { status: 'available' };
      } catch (error) {
        return { status: 'unavailable', reason: 'security_command_unavailable', remediation: sanitize(error) };
      }
    },
    set({ bindingRef, value }) {
      const available = this.availability();
      if (available.status !== 'available') return { ...available, store: KEYCHAIN_STORE, ref: bindingRef };
      try {
        run(['add-generic-password', '-a', bindingRef.account, '-s', bindingRef.service, '-w', value, '-U']);
        return { status: 'stored', store: KEYCHAIN_STORE, ref: bindingRef, keyState: redactedKeyState(true) };
      } catch (error) {
        return { status: 'failed', store: KEYCHAIN_STORE, ref: bindingRef, reason: sanitize(error, [value]) };
      }
    },
    get({ bindingRef }) {
      const available = this.availability();
      if (available.status !== 'available') return { ...available, store: KEYCHAIN_STORE, ref: bindingRef };
      try {
        const value = String(run(['find-generic-password', '-a', bindingRef.account, '-s', bindingRef.service, '-w']) ?? '').replace(/\r?\n$/u, '');
        if (!value) return { status: 'missing', store: KEYCHAIN_STORE, ref: bindingRef, reason: 'empty_or_missing' };
        return { status: 'loaded', value, store: KEYCHAIN_STORE, ref: bindingRef };
      } catch (error) {
        return { status: 'missing', store: KEYCHAIN_STORE, ref: bindingRef, reason: sanitize(error) };
      }
    },
    unset({ bindingRef }) {
      const available = this.availability();
      if (available.status !== 'available') return { ...available, store: KEYCHAIN_STORE, ref: bindingRef, removed: false };
      try {
        run(['delete-generic-password', '-a', bindingRef.account, '-s', bindingRef.service]);
        return { status: 'removed', store: KEYCHAIN_STORE, ref: bindingRef, removed: true };
      } catch (error) {
        return { status: 'already_missing', store: KEYCHAIN_STORE, ref: bindingRef, removed: false, reason: sanitize(error) };
      }
    },
    inspect({ bindingRef }) {
      const result = this.get({ bindingRef });
      return { status: result.status === 'loaded' ? 'ok' : result.status, store: KEYCHAIN_STORE, ref: bindingRef, keyState: redactedKeyState(result.status === 'loaded'), reason: result.reason };
    },
    doctor() { return { store: KEYCHAIN_STORE, ...this.availability(), checks: ['macos_security_cli'], warnings: [] }; },
    repair() { return { store: KEYCHAIN_STORE, ...this.availability(), checks: ['availability_only'], warnings: ['Keychain repair is limited to availability checks.'] }; },
  };
}
