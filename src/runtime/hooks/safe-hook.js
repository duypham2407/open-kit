export function createSafeHook(hook) {
  return {
    ...hook,
    run(input) {
      try {
        return hook.run ? hook.run(input) : null;
      } catch (error) {
        return {
          hook: hook.id,
          error: error.message,
        };
      }
    },
  };
}
