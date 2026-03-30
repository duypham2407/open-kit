export function createVerificationClaimHook() {
  return {
    id: 'hook.verification-claim-guard',
    name: 'Verification Claim Guard',
    stage: 'planned',
    run({ hasEvidence = false } = {}) {
      return { allowed: hasEvidence };
    },
  };
}
