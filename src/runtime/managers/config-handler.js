export function createConfigHandler({ configResult }) {
  return {
    getConfig() {
      return configResult.config;
    },
    describeSources() {
      return {
        project: configResult.projectConfigPath,
        user: configResult.userConfigPath,
      };
    },
  };
}
