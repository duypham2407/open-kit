export const SESSIONS_INDEX_SCHEMA = 'openkit/sessions-index@1';
export const SESSION_META_SCHEMA = 'openkit/session-meta@1';
export const WORK_ITEMS_INDEX_SCHEMA_V3 = 'openkit/work-items-index@3';
export const LEGACY_STUB_SCHEMA = 'openkit/legacy-stub@1';

export const HEARTBEAT_INTERVAL_MS = 60_000;
export const ORPHAN_THRESHOLD_MS = 10 * 60_000;
export const CLOSED_RETENTION_MS = 7 * 24 * 60 * 60_000;

export const LEGACY_MIRROR_ROTATE_KEEP = 10;

export const INDEX_LOCK_RETRIES = 20;
export const INDEX_LOCK_RETRY_INTERVAL_MS = 100;
export const INDEX_LOCK_TIMEOUT_MS = 2_000;

export const SIGTERM_TO_SIGKILL_GRACE_MS = 3_000;
export const SIGKILL_CONFIRM_TIMEOUT_MS = 5_000;

export const SESSION_ID_PREFIX = 's_';
export const SESSION_ID_HEX_LEN = 6;
export const SYNTHETIC_ORPHAN_PREFIX = 's_orphan_';
export const SYNTHETIC_ORPHAN_HEX_LEN = 8;
