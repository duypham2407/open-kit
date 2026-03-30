export function pollBackgroundRun(run) {
  return {
    id: run.id,
    status: run.status,
    updatedAt: run.updatedAt,
  };
}
