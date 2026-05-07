function dispatchIfMissing({ workflowKernel, delegationSupervisor, runtimeStatus, customStatePath, role, stage, artifactKind, title }) {
  const workItemId = runtimeStatus?.state?.work_item_id ?? null;
  if (!workflowKernel || !delegationSupervisor || !workItemId) {
    return {
      dispatched: false,
      reason: 'workflow-context-unavailable',
      role,
      stage,
      artifactKind,
    };
  }

  const readiness = runtimeStatus?.runtimeContext?.planningDispatchSummary?.readiness ?? [];
  const existing = readiness.find((entry) => (
    entry.role === role && entry.stage === stage && entry.artifact_kind === artifactKind
  ));

  if (existing?.completed) {
    return {
      dispatched: false,
      reason: 'already-complete',
      role,
      stage,
      artifactKind,
      runId: existing.run_id ?? null,
    };
  }

  const dispatched = delegationSupervisor.dispatchPlanningStage({
    dispatchPlanningStage: true,
    workItemId,
    role,
    stage,
    artifactKind,
    title,
    customStatePath,
    requestedBy: 'MasterOrchestrator',
    output: { status: 'auto-routed-from-command-loader' },
  });

  if (dispatched?.dispatched === true) {
    const state = workflowKernel?.showRuntimeStatus?.(customStatePath)?.state
      ?? workflowKernel?.showRuntimeStatusRelaxed?.(customStatePath)?.state
      ?? workflowKernel?.showState?.(customStatePath)?.state
      ?? runtimeStatus?.state
      ?? null;
    if (state?.feature_slug) {
      const shouldScaffoldScope = artifactKind === 'scope_package' && !state.artifacts?.scope_package;
      const shouldScaffoldSolution = artifactKind === 'solution_package' && !state.artifacts?.solution_package;

      if (shouldScaffoldScope || shouldScaffoldSolution) {
        const scaffoldKind = shouldScaffoldScope ? 'scope_package' : 'solution_package';
        workflowKernel?.scaffoldAndLinkArtifact?.({
          kind: scaffoldKind,
          slug: state.feature_slug,
          customStatePath,
        });
      }

      workflowKernel?.recordVerificationEvidence?.({
        id: `auto-planning-handoff-${role}-${stage}-${state.feature_slug}`,
        kind: 'review',
        scope: stage,
        summary: `Auto-recorded ${role} planning handoff scaffold`,
        source: 'command-orchestrator',
        recorded_at: new Date().toISOString(),
        details: {
          role_handoff: {
            role,
            stage,
            artifact_kind: artifactKind,
          },
        },
      }, customStatePath);
    }
  }

  return dispatched;
}

export function executeEntryCommandOrchestration({ commandName, workflowKernel, delegationSupervisor, customStatePath = null }) {
  if (typeof commandName !== 'string' || !workflowKernel || !delegationSupervisor) {
    return {
      status: 'unavailable',
      reason: 'missing-runtime-orchestrator-dependencies',
      commandName,
      actions: [],
    };
  }

  const runtimeStatus = workflowKernel?.showRuntimeStatus?.(customStatePath)
    ?? workflowKernel?.showRuntimeStatusRelaxed?.(customStatePath)
    ?? (() => {
      const stateResult = workflowKernel?.showState?.(customStatePath) ?? null;
      if (!stateResult?.state) {
        return null;
      }
      return {
        state: stateResult.state,
        runtimeContext: {
          planningDispatchSummary: {
            readiness: [],
            blockers: [],
            ready: false,
            total: 0,
          },
        },
      };
    })()
    ?? null;
  if (!runtimeStatus?.state) {
    return {
      status: 'unavailable',
      reason: 'workflow-state-unavailable',
      commandName,
      actions: [],
    };
  }

  const stage = runtimeStatus.state.current_stage;
  const actions = [];

  if (commandName === '/delivery') {
    if (stage === 'full_intake' || stage === 'full_product') {
      actions.push(dispatchIfMissing({
        workflowKernel,
        delegationSupervisor,
        runtimeStatus,
        customStatePath,
        role: 'ProductLead',
        stage: 'full_product',
        artifactKind: 'scope_package',
        title: 'Product Lead scope handoff',
      }));
    }

    if (stage === 'full_solution') {
      actions.push(dispatchIfMissing({
        workflowKernel,
        delegationSupervisor,
        runtimeStatus,
        customStatePath,
        role: 'SolutionLead',
        stage: 'full_solution',
        artifactKind: 'solution_package',
        title: 'Solution Lead solution handoff',
      }));
    }
  }

  if (commandName === '/migrate' && (stage === 'migration_intake' || stage === 'migration_baseline' || stage === 'migration_strategy')) {
    actions.push(dispatchIfMissing({
      workflowKernel,
      delegationSupervisor,
      runtimeStatus,
      customStatePath,
      role: 'SolutionLead',
      stage: 'migration_strategy',
      artifactKind: 'solution_package',
      title: 'Solution Lead migration strategy handoff',
    }));
  }

  return {
    status: 'ok',
    commandName,
    stage,
    actions,
  };
}
