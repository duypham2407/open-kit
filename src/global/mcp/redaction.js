const DEFAULT_REDACTION = '[REDACTED_SECRET]';

function collectSecretStrings({ secrets = [], env = {}, envVars = [] } = {}) {
  const values = [];
  for (const value of secrets) {
    if (typeof value === 'string' && value.length > 0) {
      values.push(value);
    }
  }
  for (const envVar of envVars) {
    const value = env?.[envVar];
    if (typeof value === 'string' && value.length > 0) {
      values.push(value);
    }
  }
  return [...new Set(values)].sort((left, right) => right.length - left.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactKnownSecrets(value, options = {}) {
  if (typeof value !== 'string') {
    return value;
  }

  let redacted = value;
  for (const secret of collectSecretStrings(options)) {
    redacted = redacted.replace(new RegExp(escapeRegExp(secret), 'g'), options.replacement ?? DEFAULT_REDACTION);
  }

  for (const envVar of options.envVars ?? []) {
    redacted = redacted.replace(new RegExp(`(${escapeRegExp(envVar)}=)[^\\s]+`, 'g'), `$1${options.replacement ?? DEFAULT_REDACTION}`);
  }

  return redacted;
}

export function redactObject(value, options = {}) {
  if (typeof value === 'string') {
    return redactKnownSecrets(value, options);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => redactObject(entry, options));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactObject(entry, options)]));
  }
  return value;
}

export function redactedKeyState(present) {
  return present ? 'present_redacted' : 'missing';
}
