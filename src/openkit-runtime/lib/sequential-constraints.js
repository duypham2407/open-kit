export function parseSequentialConstraintChain(constraint) {
  if (typeof constraint !== "string" || constraint.trim().length === 0) {
    throw new Error("parallelization.sequential_constraints[] must be a non-empty string")
  }

  const taskIds = constraint
    .split("->")
    .map((entry) => entry.trim())
    .filter(Boolean)

  if (taskIds.length < 2) {
    throw new Error(
      `parallelization.sequential_constraints entry '${constraint}' must describe an ordered task chain like 'TASK-A -> TASK-B'`,
    )
  }

  return taskIds
}

export function getSequentialConstraintChains(parallelization) {
  const sequentialConstraints = Array.isArray(parallelization?.sequential_constraints)
    ? parallelization.sequential_constraints
    : []

  return sequentialConstraints.map(parseSequentialConstraintChain)
}

export function applySequentialConstraintsToTasks(tasks, parallelization) {
  const normalizedTasks = JSON.parse(JSON.stringify(Array.isArray(tasks) ? tasks : []))
  const taskIndex = new Map(normalizedTasks.map((task) => [task.task_id, task]))

  for (const chain of getSequentialConstraintChains(parallelization)) {
    for (const taskId of chain) {
      if (!taskIndex.has(taskId)) {
        throw new Error(`parallelization.sequential_constraints references unknown task '${taskId}'`)
      }
    }

    for (let index = 1; index < chain.length; index += 1) {
      const previousTaskId = chain[index - 1]
      const task = taskIndex.get(chain[index])
      task.depends_on = [...new Set([...(task.depends_on ?? []), previousTaskId])]
      task.blocked_by = [...new Set([...(task.blocked_by ?? []), previousTaskId])]
      task.sequential_constraint_dependencies = [
        ...new Set([...(task.sequential_constraint_dependencies ?? []), previousTaskId]),
      ]
    }
  }

  return normalizedTasks
}
