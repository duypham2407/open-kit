const MUTATION_INTENTS = new Set([
  'approve',
  'approval',
  'approve_gate',
  'advance',
  'advance_stage',
  'close',
  'transition',
  'set_stage',
  'change_stage',
  'stage_transition',
  'update_task',
  'task_update',
  'task_board_update',
  'task_board_status',
  'task_board_assignment',
  'set_task_status',
  'task_status',
  'assign_task',
  'reassign_task',
  'claim_task',
  'release_task',
  'assign_qa_owner',
  'mark_qa_done',
  'complete_qa',
  'qa_done',
  'qa_complete',
  'close_review',
  'review_complete',
  'complete_review',
  'mark_review_done',
  'mutate_state',
  'record_evidence',
  'record_verification_evidence',
  'add_evidence',
  'create_issue',
  'record_issue',
  'update_issue',
  'update_issue_status',
  'close_issue',
  'resolve_issue',
  'reopen_issue',
  'issue_lifecycle',
]);

const EXECUTION_INTENTS = new Set([
  'execute',
  'run_command',
  'shell',
  'bash',
  'edit_file',
  'write_file',
  'delete_file',
  'create_commit',
]);

const MUTATION_PATTERNS = [
  {
    boundary: 'approval_mutation',
    reason: 'OpenClaw cannot approve or mutate OpenKit approval gates.',
    pattern: /\b(approve|approved|set|change|update)\b[\s_-]+\b(approval|gate|qa_to_done|fullstack_to_code_review|code_review_to_qa)\b|\bset[\s_-]*approval\b|\bapproval[\s_-]*(status|gate|approved|rejected)\b/,
  },
  {
    boundary: 'stage_mutation',
    reason: 'OpenClaw cannot advance, transition, or mutate OpenKit workflow stages.',
    pattern: /\b(advance|transition|set|change|move|update)\b[\s_-]+\b(stage|workflow[\s_-]*stage|current[\s_-]*stage)\b|\badvance[\s_-]*stage\b|\bset[\s_-]*stage\b|\bstage[\s_-]*(transition|mutation|change)\b/,
  },
  {
    boundary: 'task_board_mutation',
    reason: 'OpenClaw cannot update OpenKit task boards, task status, or task assignment.',
    pattern: /\b(update|set|change|assign|reassign|claim|release|mark)\b[\s_-]+\b(task|task[\s_-]*status|task[\s_-]*board|task[\s_-]*assignment)\b|\bupdate[\s_-]*task\b|\bset[\s_-]*task[\s_-]*status\b|\btask[\s_-]*board[\s_-]*(update|status|assignment|assign)\b|\btask[\s_-]*status[\s_-]*(to|as|=|:|update|assignment|done|blocked|ready)\b/,
  },
  {
    boundary: 'qa_completion',
    reason: 'OpenClaw cannot mark QA complete or mutate QA completion state.',
    pattern: /\bmark[\s_-]*qa[\s_-]*done\b|\bcomplete[\s_-]*qa\b|\bqa[\s_-]*(done|complete|completed|passed|approved)\b|\bpass[\s_-]*qa\b/,
  },
  {
    boundary: 'review_completion',
    reason: 'OpenClaw cannot close review or mark review complete.',
    pattern: /\bclose[\s_-]*review\b|\breview[\s_-]*(complete|completed|done|passed|approved)\b|\bcomplete[\s_-]*review\b|\bmark[\s_-]*review[\s_-]*done\b/,
  },
  {
    boundary: 'evidence_recording',
    reason: 'OpenClaw cannot record OpenKit verification evidence.',
    pattern: /\b(record|add|append|create)\b[\s_-]+\b(verification[\s_-]*)?evidence\b|\brecord[\s_-]*(verification[\s_-]*)?evidence\b|\bverification[\s_-]*evidence[\s_-]*(record|add|append|create)\b/,
  },
  {
    boundary: 'issue_lifecycle',
    reason: 'OpenClaw cannot create, update, close, resolve, reopen, or otherwise mutate OpenKit issue lifecycle state.',
    pattern: /\b(create|record|update|close|resolve|reopen)\b[\s_-]+\b(issue|blocker)\b|\bupdate[\s_-]*issue[\s_-]*status\b|\bissue[\s_-]*(lifecycle|status|closure|resolution)\b|\bclose[\s_-]*blocker\b/,
  },
  {
    boundary: 'workflow_state_mutation',
    reason: 'OpenClaw cannot mutate OpenKit workflow state.',
    pattern: /\b(mutate|change|update|write|set)\b[\s_-]+\b(workflow[\s_-]*state|state)\b|\bmutate[\s_-]*state\b/,
  },
];

function normalizeToken(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function normalizeBody(value) {
  return String(value ?? '').toLowerCase();
}

function detectMutationBoundary(intent, body) {
  const normalizedIntent = normalizeToken(intent);
  if (MUTATION_INTENTS.has(normalizedIntent)) {
    return {
      boundary: normalizedIntent,
      reason: 'OpenClaw cannot mutate OpenKit workflow, task, evidence, issue, review, or QA state.',
    };
  }

  for (const candidate of MUTATION_PATTERNS) {
    if (candidate.pattern.test(body)) {
      return candidate;
    }
  }

  return null;
}

function detectsExecutionBoundary(intent, body) {
  const normalizedIntent = normalizeToken(intent);
  return EXECUTION_INTENTS.has(normalizedIntent) || /\b(run|execute|edit|write|delete|commit)\b/.test(body);
}

export function adjudicateInboundMessage(message) {
  const intent = normalizeToken(message?.intent) || null;
  const type = normalizeToken(message?.type) || 'message';
  const body = normalizeBody(message?.body);
  const impliesExecution = detectsExecutionBoundary(intent, body);
  const mutationBoundary = detectMutationBoundary(intent, body);

  if (impliesExecution || mutationBoundary) {
    return {
      disposition: 'rejected_authority_boundary',
      reason: impliesExecution
        ? 'OpenClaw cannot execute code or filesystem operations.'
        : mutationBoundary.reason,
      details: {
        intent,
        type,
        boundary: impliesExecution ? 'execution_or_filesystem' : mutationBoundary.boundary,
        openkit_authority_required: true,
      },
    };
  }

  const missingFields = [];
  if (!intent) {
    missingFields.push('intent');
  }
  if (!message?.target) {
    missingFields.push('target');
  }
  if (!message?.body) {
    missingFields.push('body');
  }
  if (missingFields.length > 0) {
    return {
      disposition: 'invalid_rejected',
      reason: 'OpenClaw message is missing minimum inbound information.',
      details: { intent, type, missing_fields: missingFields },
    };
  }

  if (type === 'attention' || intent === 'attention' || message?.severity === 'high') {
    return {
      disposition: 'attention_required',
      reason: 'OpenClaw requested operator attention.',
      details: { intent, type, target: message?.target ?? null },
    };
  }

  if (type === 'ack' || intent === 'ack' || intent === 'acknowledge') {
    return {
      disposition: 'acknowledged',
      reason: 'OpenClaw acknowledgement recorded.',
      details: { intent, type },
    };
  }

  if (type === 'concern' || intent === 'concern') {
    return {
      disposition: 'concern_recorded',
      reason: 'OpenClaw concern recorded for OpenKit operator review.',
      details: { intent, type, target: message?.target ?? null },
    };
  }

  return {
    disposition: 'recorded_suggestion',
    reason: 'OpenClaw dialogue recorded for OpenKit operator review.',
    details: { intent, type, target: message?.target ?? null },
  };
}
