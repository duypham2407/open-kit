export function inspectBackgroundDoctor(backgroundManager) {
  return {
    backgroundEnabled: backgroundManager?.enabled ?? false,
    runCount: backgroundManager?.list?.().length ?? 0,
  };
}
