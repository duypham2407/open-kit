export function createVerificationClaimHook({ workflowKernel }) {
  return {
    id: 'hook.verification-claim-guard',
    name: 'Verification Claim Guard',
    stage: 'planned',
    run({ hasEvidence = false } = {}) {
      const runtimeStatus = workflowKernel?.showRuntimeStatus?.() ?? null;
      const evidenceCount = runtimeStatus?.runtimeContext?.verificationEvidenceLines?.length ?? 0;
      const verificationReadiness = runtimeStatus?.runtimeContext?.verificationReadiness ?? null;
      const allowed = hasEvidence || evidenceCount > 0;
      return {
        allowed,
        evidenceCount,
        verificationReadiness,
        blocked: !allowed,
        blockedBy: allowed ? [] : ['missing-verification-evidence'],
        reason: allowed ? null : 'verification claims require recorded evidence',
      };
    },
  };
}
