/**
 * Advance Stage Tool
 *
 * MCP tool that the AI model MUST call to transition between workflow stages.
 * Validates transitions via the FSM and gate requirements before updating state.
 *
 * Input:
 *   { targetStage, evidence?, handoffContext?, gateOverrides? }
 *
 * Output:
 *   On success: { status: 'ok', newStage, newOwner, validNextStages, guidance }
 *   On block:   { status: 'blocked', reason, validNextStages, missingGates, guidance }
 */

import { isValidTransition, getValidNextStages, getStageOwner } from '../../workflow/state-machine.js';
import { checkGateRequirements, recordGateMet } from '../../workflow/gate-requirements.js';

export function createAdvanceStageTool({ workflowKernel }) {
  return {
    id: 'tool.advance-stage',
    description: 'Advance the workflow to the next stage. Validates transitions and gate requirements. Model MUST call this to change stages.',
    family: 'workflow',
    stage: 'foundation',
    status: 'active',
    capabilityState: 'available',
    validationSurface: 'runtime_tooling',
    execute(input = {}) {
      const { targetStage, evidence = {}, handoffContext = null, gateOverrides = {} } = typeof input === 'string' ? { targetStage: input } : input;

      if (!targetStage) {
        return {
          status: 'error',
          reason: 'targetStage is required. Specify the stage you want to transition to.',
        };
      }

      // Read current state
      const stateResult = workflowKernel?.showState?.() ?? null;
      const state = stateResult?.state ?? stateResult ?? null;

      if (!state) {
        return {
          status: 'error',
          reason: 'No workflow state found. Initialize a workflow first via /task, /quick-task, /migrate, or /delivery.',
        };
      }

      const { mode, current_stage: currentStage, current_owner: currentOwner } = state;

      if (!mode || !currentStage) {
        return {
          status: 'error',
          reason: 'Workflow state is incomplete. Missing mode or current_stage.',
          state: { mode, currentStage, currentOwner },
        };
      }

      // 1. Validate transition via FSM
      if (!isValidTransition(mode, currentStage, targetStage)) {
        const validTargets = getValidNextStages(mode, currentStage);
        return {
          status: 'blocked',
          reason: `Invalid transition: ${currentStage} → ${targetStage} is not allowed in ${mode} mode.`,
          currentStage,
          currentOwner,
          validNextStages: validTargets,
          guidance: validTargets.length > 0
            ? `From ${currentStage}, you can only advance to: ${validTargets.join(', ')}. Call tool.advance-stage with one of those targets.`
            : `${currentStage} is a terminal stage. No further transitions are possible.`,
        };
      }

      // 2. Check gate requirements
      const gateResult = checkGateRequirements(mode, currentStage, targetStage, state, { ...evidence, ...gateOverrides });
      if (!gateResult.passed) {
        return {
          status: 'blocked',
          reason: `Gate requirements not met for ${currentStage} → ${targetStage}.`,
          gateDescription: gateResult.gateDescription,
          missingGates: gateResult.missing,
          currentStage,
          currentOwner,
          validNextStages: getValidNextStages(mode, currentStage),
          guidance: `Before advancing to ${targetStage}, you must satisfy: ${gateResult.missing.map((g) => `${g.requirement} (${g.detail})`).join('; ')}.`,
        };
      }

      // 3. Determine new owner
      const newOwner = getStageOwner(mode, targetStage);
      const validNextFromTarget = getValidNextStages(mode, targetStage);

      // 4. Build stage transition record
      const transition = {
        from: currentStage,
        to: targetStage,
        previousOwner: currentOwner,
        newOwner,
        timestamp: new Date().toISOString(),
        evidence: Object.keys(evidence).length > 0 ? evidence : undefined,
        handoffContext: handoffContext ?? undefined,
      };

      // 5. Attempt to update workflow state
      const updateResult = updateWorkflowState(workflowKernel, state, targetStage, newOwner, transition);

      if (!updateResult.success) {
        return {
          status: 'error',
          reason: `Failed to update workflow state: ${updateResult.reason}`,
          transition,
        };
      }

      // 6. Return success with guidance for the new role
      return {
        status: 'ok',
        transition,
        newStage: targetStage,
        newOwner,
        mode,
        validNextStages: validNextFromTarget,
        guidance: buildStageGuidance(mode, targetStage, newOwner, validNextFromTarget),
      };
    },
  };
}

function updateWorkflowState(workflowKernel, currentState, targetStage, newOwner, transition) {
  // Use the workflow kernel's underlying controller if available
  // The kernel adapter wraps workflow-state-controller.js which handles state mutations
  try {
    // Record the transition as verification evidence for audit
    workflowKernel.recordVerificationEvidence?.({
      type: 'stage_transition',
      description: `${transition.from} → ${transition.to} (${transition.previousOwner} → ${newOwner})`,
      artifact_refs: [],
      transition,
    });

    return { success: true };
  } catch (err) {
    return { success: false, reason: err?.message ?? String(err) };
  }
}

function buildStageGuidance(mode, stage, owner, nextStages) {
  const lines = [];
  lines.push(`You are now ${owner} in stage ${stage} (${mode} mode).`);
  lines.push(`Read openkit://active-role-instructions for your role-specific instructions.`);

  if (nextStages.length > 0) {
    lines.push(`When this stage is complete, advance to one of: ${nextStages.join(', ')}.`);
  } else {
    lines.push('This is the final stage. No further transitions are available.');
  }

  // Role-specific hints
  const hints = {
    MasterOrchestrator: 'You coordinate and dispatch. Do NOT write code, create files, or run tests.',
    QuickAgent: 'You own the entire quick lifecycle. Follow the stage contract strictly.',
    ProductLead: 'Define scope, acceptance criteria, and user stories. Do NOT write code.',
    SolutionLead: 'Choose technical approach and define the solution design. Do NOT implement.',
    FullstackAgent: 'Implement the approved solution. Follow the solution package.',
    CodeReviewer: 'Review code for quality and scope compliance. Do NOT modify code.',
    QAAgent: 'Verify behavior, run tests, capture evidence. Do NOT modify code.',
  };

  if (hints[owner]) {
    lines.push(`ROLE RULE: ${hints[owner]}`);
  }

  return lines.join(' ');
}
