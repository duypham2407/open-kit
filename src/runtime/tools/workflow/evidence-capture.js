export function createEvidenceCaptureTool() {
  return {
    id: 'tool.evidence-capture',
    execute({ id, scope, summary, source = 'runtime-tool' }) {
      return {
        id,
        scope,
        summary,
        source,
      };
    },
  };
}
