export function createEvidenceCaptureTool({ workflowKernel }) {
  return {
    id: 'tool.evidence-capture',
    description: 'Records verification evidence through workflow kernel',
    execute({ id, kind = 'runtime', scope, summary, source = 'runtime-tool', command = null, exit_status = null, artifact_refs = [], customStatePath = null }) {
      if (!workflowKernel?.recordVerificationEvidence) {
        return {
          id,
          kind,
          scope,
          summary,
          source,
          customStatePath,
          recorded: false,
          status: 'workflow-kernel-unavailable',
        };
      }

      workflowKernel.recordVerificationEvidence({
        id,
        kind,
        scope,
        summary,
        source,
        command,
        exit_status,
        artifact_refs,
      }, customStatePath);

      return {
        id,
        kind,
        scope,
        summary,
        source,
        customStatePath,
        recorded: true,
      };
    },
  };
}
