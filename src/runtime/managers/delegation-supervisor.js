function selectSpecialistForTask(task = {}, specialists = []) {
  if (task.kind === 'research' || task.kind === 'analysis') {
    return specialists.find((entry) => entry.id === 'specialist.librarian') ?? specialists[0] ?? null;
  }

  if (task.kind === 'ui' || task.kind === 'design') {
    return specialists.find((entry) => entry.id === 'specialist.momus') ?? specialists[0] ?? null;
  }

  if (task.kind === 'verification' || task.kind === 'qa') {
    return specialists.find((entry) => entry.id === 'specialist.metis') ?? specialists[0] ?? null;
  }

  return specialists.find((entry) => entry.id === 'specialist.oracle') ?? specialists[0] ?? null;
}

function selectCategoryForTask(task = {}) {
  if (task.kind === 'research' || task.kind === 'analysis') {
    return 'docs-research';
  }

  if (task.kind === 'ui' || task.kind === 'design') {
    return 'visual-engineering';
  }

  if (task.kind === 'verification' || task.kind === 'qa') {
    return 'qa-regression';
  }

  return 'deep';
}

function buildAllocationSnapshot(allocation) {
  return allocation
    ? {
        activeTaskCount: allocation.activeTasks?.length ?? 0,
      }
    : null;
}

function getUnresolvedDependencies(task, taskIndex) {
  const satisfiableStatuses = new Set(['dev_done', 'qa_ready', 'qa_in_progress', 'done', 'cancelled']);
  return (task.depends_on ?? []).filter((dependencyId) => {
    const dependency = taskIndex.get(dependencyId);
    return !dependency || !satisfiableStatuses.has(dependency.status);
  });
}

function findDependencyQueuedTask(tasks = []) {
  const taskIndex = new Map(tasks.map((task) => [task.task_id, task]));
  return tasks
    .map((task) => {
      const unresolvedDependencies = getUnresolvedDependencies(task, taskIndex);
      return {
        task,
        unresolvedDependencies,
        sequentialConstraintDependencies: (task.sequential_constraint_dependencies ?? []).filter((dependencyId) =>
          unresolvedDependencies.includes(dependencyId)
        ),
      };
    })
    .find(({ task, unresolvedDependencies }) => unresolvedDependencies.length > 0 || (task.blocked_by ?? []).length > 0) ?? null;
}

function selectTaskForDispatch(tasks = [], orchestrationHealth = {}, boardStage = null) {
  const dispatchableTaskIds = orchestrationHealth?.dispatchableTaskIds ?? [];

  if (dispatchableTaskIds.length > 0) {
    const taskById = new Map(tasks.map((task) => [task.task_id, task]));
    for (const taskId of dispatchableTaskIds) {
      const task = taskById.get(taskId);
      if (task) {
        return task;
      }
    }
  }

  // Shared orchestration health has already determined that nothing is
  // dispatchable right now, so do not bypass it with a raw status fallback.
  if (orchestrationHealth?.status) {
    return null;
  }

  if (boardStage === 'full_qa') {
    return tasks.find((task) => task.status === 'qa_ready' || task.status === 'dev_done') ?? null;
  }

  return tasks.find((task) => task.status === 'ready') ?? null;
}

function describeUndispatchableBoard(orchestrationHealth, boardStage, tasks) {
  const defaultPayload = {
    dispatched: false,
    boardStage,
    tasks,
    orchestrationHealth,
  };

  switch (orchestrationHealth?.status) {
    case 'blocked-by-dependencies':
      return {
        ...defaultPayload,
        reason: 'queued-by-dependencies',
        taskId: orchestrationHealth?.dependencyBlockedTaskIds?.[0] ?? null,
        unresolvedDependencies: orchestrationHealth?.dependencyBlockedTaskIds ?? [],
      };
    case 'waiting-sequential-constraint':
      return {
        ...defaultPayload,
        reason: 'queued-by-sequential-constraint',
      };
    case 'parallel-cap-reached':
      return {
        ...defaultPayload,
        reason: 'queued-by-parallel-cap',
      };
    case 'waiting-exclusive-window':
      return {
        ...defaultPayload,
        reason: 'queued-by-exclusive-window',
      };
    case 'waiting-shared-artifact-window':
      return {
        ...defaultPayload,
        reason: 'queued-by-shared-artifact',
      };
    case 'waiting-safe-parallel-zone':
      return {
        ...defaultPayload,
        reason: 'queued-by-safe-parallel-zone',
      };
    case 'waiting-integration-checkpoint':
      return {
        ...defaultPayload,
        reason: 'queued-by-integration-checkpoint',
      };
    case 'waiting-stage-advance':
      return {
        ...defaultPayload,
        reason: 'queued-by-stage-advance',
      };
    case 'stale-running-runs':
      return {
        ...defaultPayload,
        reason: 'stale-background-run',
      };
    case 'blocked-by-tasks':
    case 'blocked-no-dispatchable-task':
      return {
        ...defaultPayload,
        reason: 'task-board-blocked',
      };
    default:
      return {
        ...defaultPayload,
        reason: 'no-dispatchable-task',
      };
  }
}

function findQueuedExclusiveTask(tasks = [], taskBoardSummary = null) {
  const exclusiveQueuedTaskIds = taskBoardSummary?.exclusiveQueuedTaskIds ?? [];
  if (exclusiveQueuedTaskIds.length === 0) {
    const hasActiveTask = tasks.some((task) => ['claimed', 'in_progress', 'qa_in_progress'].includes(task.status));
    return hasActiveTask ? tasks.find((task) => task.status === 'ready' && task.concurrency_class === 'exclusive') ?? null : null;
  }

  const taskById = new Map(tasks.map((task) => [task.task_id, task]));
  return taskById.get(exclusiveQueuedTaskIds[0]) ?? null;
}

export class DelegationSupervisor {
  constructor({ workflowKernel = null, backgroundManager = null, specialists = [], concurrencyManager = null } = {}) {
    this.workflowKernel = workflowKernel;
    this.backgroundManager = backgroundManager;
    this.specialists = specialists;
    this.concurrencyManager = concurrencyManager;
  }

  planForTask(task) {
    const specialist = selectSpecialistForTask(task, this.specialists);
    const category = selectCategoryForTask(task);
    return {
      category,
      specialistId: specialist?.id ?? null,
      specialistName: specialist?.name ?? null,
      defaultModel: specialist?.defaultModel ?? null,
      concurrency: this.concurrencyManager?.describe?.() ?? null,
    };
  }

  dispatchReadyTask({ workItemId, requestedBy = 'MasterOrchestrator', owner = 'FullstackAgent', customStatePath = null }) {
    const taskListing = this.workflowKernel?.listTasks?.(workItemId, customStatePath);
    const tasks = taskListing?.tasks ?? [];
    const boardStage = taskListing?.board?.current_stage ?? null;
    const allocation = this.workflowKernel?.validateTaskAllocation?.(workItemId, customStatePath);
    const runtimeStatus = this.workflowKernel?.showRuntimeStatusRelaxed?.(customStatePath) ?? this.workflowKernel?.showRuntimeStatus?.(customStatePath) ?? null;
    const orchestrationHealth = runtimeStatus?.runtimeContext?.orchestrationHealth ?? null;
    const taskBoardSummary = runtimeStatus?.runtimeContext?.taskBoardSummary ?? null;
    const dependencyQueuedTask = findDependencyQueuedTask(tasks);
    const exclusiveQueuedTask = findQueuedExclusiveTask(tasks, taskBoardSummary);

    if (taskListing?.board && !allocation) {
      return {
        dispatched: false,
        reason: 'allocation-invalid',
        boardStage,
        tasks,
        orchestrationHealth,
      };
    }

    const readyTask = selectTaskForDispatch(tasks, orchestrationHealth, boardStage);

    if (!readyTask) {
      if (dependencyQueuedTask) {
        if ((dependencyQueuedTask.sequentialConstraintDependencies ?? []).length > 0) {
          return {
            dispatched: false,
            reason: 'queued-by-sequential-constraint',
            boardStage,
            taskId: dependencyQueuedTask.task.task_id,
            unresolvedDependencies: dependencyQueuedTask.sequentialConstraintDependencies,
            blockedBy: dependencyQueuedTask.task.blocked_by ?? [],
            tasks,
            orchestrationHealth,
          };
        }

        return {
          dispatched: false,
          reason: 'queued-by-dependencies',
          boardStage,
          taskId: dependencyQueuedTask.task.task_id,
          unresolvedDependencies: dependencyQueuedTask.unresolvedDependencies,
          blockedBy: dependencyQueuedTask.task.blocked_by ?? [],
          tasks,
          orchestrationHealth,
        };
      }

      if (exclusiveQueuedTask) {
        return {
          dispatched: false,
          reason: 'queued-by-exclusive-window',
          boardStage,
          taskId: exclusiveQueuedTask.task_id,
          tasks,
          orchestrationHealth,
        };
      }

      return describeUndispatchableBoard(orchestrationHealth, boardStage, tasks);
    }

    const plan = this.planForTask(readyTask);

    if (boardStage === 'full_qa' || readyTask.status === 'qa_ready' || readyTask.status === 'dev_done') {
      const qaOwner = owner === 'QAAgent' ? owner : 'QAAgent';
      this.workflowKernel?.assignQaOwner?.({
        workItemId,
        taskId: readyTask.task_id,
        qaOwner,
        requestedBy,
        customStatePath,
      });

      const taskAfterAssignment = this.workflowKernel?.listTasks?.(workItemId, customStatePath)?.tasks?.find(
        (task) => task.task_id === readyTask.task_id
      ) ?? readyTask;

      if (taskAfterAssignment.status === 'dev_done') {
        this.workflowKernel?.setTaskStatus({
          workItemId,
          taskId: readyTask.task_id,
          status: 'qa_ready',
          customStatePath,
        });
      }

      this.workflowKernel?.setTaskStatus({
        workItemId,
        taskId: readyTask.task_id,
        status: 'qa_in_progress',
        customStatePath,
      });

      return {
        dispatched: false,
        workItemId,
        taskId: readyTask.task_id,
        plan,
        qaOwner,
        boardStage,
        orchestrationHealth,
        allocation: buildAllocationSnapshot(allocation),
        mode: 'qa-handoff',
      };
    }

    this.workflowKernel?.claimTask({
      workItemId,
      taskId: readyTask.task_id,
      owner,
      requestedBy,
      customStatePath,
    });
    this.workflowKernel?.setTaskStatus({
      workItemId,
      taskId: readyTask.task_id,
      status: 'in_progress',
      customStatePath,
    });

    const run = this.backgroundManager?.spawn({
      title: `Task ${readyTask.task_id}: ${readyTask.title}`,
      payload: {
        execution: 'delegated-task',
        taskId: readyTask.task_id,
        workItemId,
        plan,
      },
      workItemId,
      taskId: readyTask.task_id,
      customStatePath,
    }) ?? null;

    return {
      dispatched: Boolean(run),
      workItemId,
      taskId: readyTask.task_id,
      plan,
      boardStage,
      orchestrationHealth,
      allocation: buildAllocationSnapshot(allocation),
      mode: 'implementation-run',
      run,
    };
  }
}
