export function recoverEditPlan(plan = null) {
  return {
    plan,
    status: plan ? 'recovered' : 'noop',
  };
}
