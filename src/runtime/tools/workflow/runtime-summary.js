import path from 'node:path';

export function createRuntimeSummaryTool({ projectRoot }) {
  return {
    id: 'tool.runtime-summary',
    execute() {
      return {
        projectRoot,
        runtimeSummaryPath: path.join(projectRoot, '.opencode', 'lib', 'runtime-summary.js'),
      };
    },
  };
}
