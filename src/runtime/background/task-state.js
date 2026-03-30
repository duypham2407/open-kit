export const BACKGROUND_RUN_STATUSES = ['pending', 'running', 'completed', 'cancelled'];

export function createBackgroundRun({ id, title, payload, createdAt = new Date().toISOString() }) {
  return {
    id,
    title,
    payload,
    status: 'pending',
    createdAt,
    updatedAt: createdAt,
    output: null,
  };
}
