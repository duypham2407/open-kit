export function createEvidenceCaptureTool({ workflowKernel }) {
  return {
    id: 'tool.evidence-capture',
    description: 'Records verification evidence through workflow kernel',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    validationSurface: 'compatibility_runtime',
    execute({
      id,
      kind = 'runtime',
      scope,
      summary,
      source = 'runtime-tool',
      command = null,
      exit_status = null,
      artifact_refs = [],
      details = null,
      customStatePath = null,
    }) {
      if (!workflowKernel?.recordVerificationEvidence) {
        return {
          id,
          kind,
          scope,
          summary,
          source,
          details,
          customStatePath,
          recorded: false,
          status: 'workflow-kernel-unavailable',
        };
      }

      const entry = {
        id,
        kind,
        scope,
        summary,
        source,
        command,
        exit_status,
        artifact_refs,
        recorded_at: new Date().toISOString(),
      };

      if (details !== null && details !== undefined) {
        entry.details = details;
      }

      const result = workflowKernel.recordVerificationEvidence(entry, customStatePath);

      return {
        id,
        kind,
        scope,
        summary,
        source,
        details,
        customStatePath,
        recorded: Boolean(result),
      };
    },
  };
}
