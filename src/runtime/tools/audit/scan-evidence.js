import path from 'node:path';

export const VALID_SCAN_STATUSES = new Set([
  'ok',
  'unavailable',
  'degraded',
  'not_configured',
  'scan_failed',
  'invalid_path',
]);

export const VALID_TRIAGE_CLASSIFICATIONS = new Set([
  'blocking',
  'true_positive',
  'non_blocking_noise',
  'false_positive',
  'follow_up',
  'unclassified',
]);

export const DEFAULT_SCAN_FALLBACK =
  'Use an allowed substitute scan path if available, or record a manual_override evidence entry with the unavailable tool, reason, limitations, and actor before advancing the gate.';

export function createSemgrepUnavailableResult({
  toolId,
  scanKind,
  projectRoot,
  requestedPath,
  targetPath,
  rawConfig,
  resolvedConfig,
  ruleConfigSource,
  reason = 'Semgrep executable was not found in OpenKit managed tooling PATH or the current system PATH.',
} = {}) {
  return createScanResult({
    toolId,
    scanKind,
    projectRoot,
    requestedPath,
    targetPath,
    rawConfig,
    resolvedConfig,
    ruleConfigSource,
    status: 'unavailable',
    capabilityState: 'unavailable',
    resultState: 'unavailable',
    availability: {
      state: 'unavailable',
      reason,
      fallback: DEFAULT_SCAN_FALLBACK,
    },
    findings: [],
  });
}

export function createHighVolumeScanFailureResult({
  toolId,
  scanKind,
  projectRoot,
  requestedPath,
  targetPath,
  rawConfig,
  resolvedConfig,
  ruleConfigSource,
  reason = 'Semgrep produced more output than OpenKit could safely capture inline.',
  stdout = '',
  stderr = '',
  exitCode = null,
  artifactRefs = [],
} = {}) {
  return createScanResult({
    toolId,
    scanKind,
    projectRoot,
    requestedPath,
    targetPath,
    rawConfig,
    resolvedConfig,
    ruleConfigSource,
    status: 'scan_failed',
    capabilityState: 'degraded',
    resultState: 'failed',
    availability: {
      state: 'degraded',
      reason,
      fallback: 'Rerun Semgrep with output redirected to an artifact, then record substitute_scan or manual_override evidence with the artifact refs and high-volume output limitations.',
    },
    findings: [],
    exitCode,
    stderr,
    message: reason,
    artifactRefs,
    limitations: [
      'Semgrep output exceeded the inline capture buffer, so OpenKit did not classify the scan as unavailable.',
      'Raw findings are not inspectable from this tool result; rerun with output redirected to an artifact before using the result for a scan gate.',
    ],
    outputSummary: {
      stdoutBytes: byteLength(stdout),
      stderrBytes: byteLength(stderr),
      highVolume: true,
    },
  });
}

export function createInvalidPathResult({
  toolId,
  scanKind,
  projectRoot,
  requestedPath,
  rawConfig,
  resolvedConfig,
  ruleConfigSource,
} = {}) {
  return createScanResult({
    toolId,
    scanKind,
    projectRoot,
    requestedPath,
    targetPath: null,
    rawConfig,
    resolvedConfig,
    ruleConfigSource,
    status: 'invalid_path',
    capabilityState: 'available',
    resultState: 'failed',
    availability: {
      state: 'available',
      reason: `Requested scan path is outside the project root or could not be resolved: ${String(requestedPath ?? '')}`,
      fallback: 'Provide a valid project path, either project-relative or an in-project absolute path, before recording scan evidence.',
    },
    findings: [],
  });
}

export function createNotConfiguredResult({
  toolId,
  scanKind,
  projectRoot,
  requestedPath,
  targetPath,
  rawConfig,
  resolvedConfig,
  ruleConfigSource,
} = {}) {
  return createScanResult({
    toolId,
    scanKind,
    projectRoot,
    requestedPath,
    targetPath,
    rawConfig,
    resolvedConfig,
    ruleConfigSource,
    status: 'not_configured',
    capabilityState: 'not_configured',
    resultState: 'unavailable',
    availability: {
      state: 'not_configured',
      reason: 'A Semgrep config was requested but no usable config value was provided.',
      fallback: 'Provide a Semgrep config value or use the bundled auto/security-audit defaults before recording direct scan evidence.',
    },
    findings: [],
  });
}

export function normalizeSemgrepFindings(results = []) {
  return results.map((entry, index) => {
    const metadata = entry.extra?.metadata ?? {};
    const severity = String(entry.extra?.severity ?? 'INFO').toUpperCase();
    const category = resolveFindingCategory(entry);
    const relevance = resolveFindingRelevance(entry);

    return {
      index,
      checkId: entry.check_id ?? entry.rule_id ?? 'unknown-rule',
      path: entry.path,
      start: entry.start,
      end: entry.end,
      severity,
      category,
      relevance,
      message: entry.extra?.message ?? '',
      metadata,
      raw: entry,
    };
  });
}

export function createScanResult({
  toolId,
  scanKind,
  projectRoot,
  requestedPath,
  targetPath,
  rawConfig,
  resolvedConfig,
  ruleConfigSource,
  status,
  capabilityState,
  resultState,
  availability,
  findings = [],
  exitCode = null,
  stderr = '',
  message,
  artifactRefs = [],
  limitations = [],
  outputSummary = null,
} = {}) {
  const normalizedStatus = VALID_SCAN_STATUSES.has(status) ? status : 'degraded';
  const normalizedFindings = Array.isArray(findings) ? findings : [];
  const severitySummary = summarizeSeverity(normalizedFindings);
  const triageSummary = buildTriageSummary(normalizedFindings);
  const requestedConfig = stringifyConfig(rawConfig);
  const resolvedRuleConfig = stringifyConfig(resolvedConfig ?? rawConfig);

  const result = {
    status: normalizedStatus,
    capabilityState: capabilityState ?? capabilityStateForStatus(normalizedStatus),
    validationSurface: 'runtime_tooling',
    toolId,
    scanKind,
    provider: 'semgrep',
    availability: {
      state: availability?.state ?? capabilityStateForStatus(normalizedStatus),
      reason: availability?.reason ?? null,
      fallback: availability?.fallback ?? null,
    },
    target: {
      requestedPath: requestedPath ?? projectRoot ?? '',
      targetPath: targetPath ?? null,
      scopeSummary: summarizeTargetScope(projectRoot, targetPath),
    },
    ruleConfig: {
      requested: requestedConfig,
      resolved: resolvedRuleConfig,
      source: ruleConfigSource ?? 'custom',
    },
    resultState: resultState ?? resultStateForStatus(normalizedStatus),
    findingCount: normalizedFindings.length,
    severitySummary,
    findings: normalizedFindings,
    triageSummary,
    falsePositiveSummary: {
      count: 0,
      items: [],
    },
    evidenceHint: {
      evidenceType: 'direct_tool',
      source: toolId,
      kind: 'automated',
      validationSurface: 'runtime_tooling',
    },
    requestedPath: requestedPath ?? projectRoot ?? '',
    targetPath: targetPath ?? null,
    config: resolvedRuleConfig,
    exitCode,
    stderr,
    artifactRefs: Array.isArray(artifactRefs) ? artifactRefs : [],
    limitations: Array.isArray(limitations) ? limitations : [],
    outputSummary,
  };

  if (message) {
    result.message = message;
  }

  return result;
}

function byteLength(value) {
  if (typeof value !== 'string') {
    return 0;
  }

  return Buffer.byteLength(value, 'utf8');
}

export function applyTriageClassifications(scanResult, classifications = []) {
  const classificationEntries = Array.isArray(classifications) ? classifications : [];
  const classificationByGroup = new Map();

  for (const entry of classificationEntries) {
    const classification = normalizeClassification(entry.classification);
    const key = classificationMatchKey({
      ruleId: entry.ruleId ?? entry.rule_id ?? entry.checkId ?? entry.check_id,
      severity: entry.severity,
      category: entry.category,
      relevance: entry.relevance,
    });
    classificationByGroup.set(key, {
      ...entry,
      classification,
    });
  }

  const groups = (scanResult?.triageSummary?.groups ?? []).map((group) => {
    const override = findClassificationForGroup(group, classificationByGroup);
    if (!override) {
      return { ...group };
    }

    return {
      ...group,
      classification: override.classification,
      rationale: override.rationale ?? group.rationale ?? null,
      trace_ref: override.trace_ref ?? override.traceRef ?? group.trace_ref ?? null,
      follow_up: override.follow_up ?? override.followUp ?? group.follow_up ?? null,
      resolution: override.resolution ?? group.resolution ?? null,
      file: override.file ?? override.path ?? group.file ?? null,
      context: override.context ?? group.context ?? null,
      security_impact: override.security_impact ?? override.impact ?? group.security_impact ?? null,
    };
  });
  const falsePositiveItems = classificationEntries
    .filter((entry) => normalizeClassification(entry.classification) === 'false_positive')
    .map((entry) => normalizeFalsePositiveItem(entry.false_positive ?? entry.falsePositive ?? entry))
    .filter((entry) => Object.keys(entry).length > 0);

  return {
    ...scanResult,
    triageSummary: summarizeGroups(groups),
    falsePositiveSummary: {
      count: falsePositiveItems.length,
      items: falsePositiveItems,
    },
  };
}

export function resolveRuleConfigSource(rawConfig, resolvedConfig, aliases = {}) {
  if (Object.prototype.hasOwnProperty.call(aliases, rawConfig)) {
    return 'bundled';
  }

  if (typeof resolvedConfig === 'string' && path.isAbsolute(resolvedConfig)) {
    return 'custom';
  }

  if (typeof rawConfig === 'string' && rawConfig.startsWith('p/')) {
    return 'external';
  }

  return 'custom';
}

function summarizeSeverity(findings) {
  return findings.reduce((summary, finding) => {
    const severity = String(finding.severity ?? 'INFO').toUpperCase();
    summary[severity] = (summary[severity] ?? 0) + 1;
    return summary;
  }, {});
}

function buildTriageSummary(findings) {
  const groupsByKey = new Map();

  for (const finding of findings) {
    const ruleId = finding.checkId ?? 'unknown-rule';
    const severity = String(finding.severity ?? 'INFO').toUpperCase();
    const category = finding.category ?? 'uncategorized';
    const relevance = finding.relevance ?? 'unclassified';
    const key = `${ruleId}\u0000${severity}\u0000${category}\u0000${relevance}`;
    const group = groupsByKey.get(key) ?? {
      groupId: stableGroupId(ruleId, severity, category, relevance),
      ruleId,
      severity,
      category,
      relevance,
      classification: 'unclassified',
      count: 0,
      message: finding.message ?? '',
      sampleLocations: [],
      findingIndexes: [],
      rationale: null,
    };

    group.count += 1;
    group.findingIndexes.push(finding.index ?? group.findingIndexes.length);
    if (group.sampleLocations.length < 5) {
      group.sampleLocations.push({
        path: finding.path ?? null,
        start: finding.start ?? null,
        end: finding.end ?? null,
      });
    }
    groupsByKey.set(key, group);
  }

  const groups = [...groupsByKey.values()].sort((left, right) => {
    const severityDelta = severityRank(right.severity) - severityRank(left.severity);
    if (severityDelta !== 0) return severityDelta;
    return left.ruleId.localeCompare(right.ruleId);
  });

  return {
    groupCount: groups.length,
    blockingCount: countGroupsByClassification(groups, 'blocking') + countGroupsByClassification(groups, 'true_positive'),
    nonBlockingNoiseCount: countGroupsByClassification(groups, 'non_blocking_noise'),
    falsePositiveCount: countGroupsByClassification(groups, 'false_positive'),
    followUpCount: countGroupsByClassification(groups, 'follow_up'),
    unclassifiedCount: countGroupsByClassification(groups, 'unclassified'),
    groups,
  };
}

function resolveFindingCategory(entry) {
  const metadata = entry.extra?.metadata ?? {};
  const category = metadata.category ?? metadata.kind ?? metadata.type ?? metadata.impact ?? null;
  if (Array.isArray(category)) {
    return category[0] ?? 'uncategorized';
  }
  if (category) {
    return String(category);
  }
  return entry.extra?.metadata?.cwe ? 'security' : 'uncategorized';
}

function resolveFindingRelevance(entry) {
  const metadata = entry.extra?.metadata ?? {};
  return String(metadata.relevance ?? metadata.openkit_relevance ?? 'unclassified');
}

function stableGroupId(ruleId, severity, category, relevance) {
  return [ruleId, severity, category, relevance]
    .map((entry) => String(entry).toLowerCase().replace(/[^a-z0-9_.-]+/g, '-'))
    .join('|');
}

function severityRank(severity) {
  switch (String(severity).toUpperCase()) {
    case 'ERROR':
      return 4;
    case 'WARNING':
      return 3;
    case 'INFO':
      return 2;
    default:
      return 1;
  }
}

function countGroupsByClassification(groups, classification) {
  return groups.filter((group) => group.classification === classification).length;
}

function summarizeGroups(groups) {
  return {
    groupCount: groups.length,
    blockingCount: countGroupsByClassification(groups, 'blocking') + countGroupsByClassification(groups, 'true_positive'),
    nonBlockingNoiseCount: countGroupsByClassification(groups, 'non_blocking_noise'),
    falsePositiveCount: countGroupsByClassification(groups, 'false_positive'),
    followUpCount: countGroupsByClassification(groups, 'follow_up'),
    unclassifiedCount: countGroupsByClassification(groups, 'unclassified'),
    groups,
  };
}

function normalizeClassification(classification) {
  return VALID_TRIAGE_CLASSIFICATIONS.has(classification) ? classification : 'unclassified';
}

function classificationMatchKey({ ruleId, severity, category, relevance } = {}) {
  return [
    ruleId ?? '*',
    severity ? String(severity).toUpperCase() : '*',
    category ?? '*',
    relevance ?? '*',
  ].join('\u0000');
}

function findClassificationForGroup(group, classificationByGroup) {
  const candidates = [
    classificationMatchKey(group),
    classificationMatchKey({ ...group, relevance: undefined }),
    classificationMatchKey({ ...group, category: undefined }),
    classificationMatchKey({ ...group, category: undefined, relevance: undefined }),
    classificationMatchKey({ ruleId: group.ruleId }),
  ];

  for (const key of candidates) {
    if (classificationByGroup.has(key)) {
      return classificationByGroup.get(key);
    }
  }

  return null;
}

function normalizeFalsePositiveItem(item = {}) {
  const normalized = {
    rule_id: item.rule_id ?? item.ruleId ?? item.check_id ?? item.checkId,
    file: item.file ?? item.path ?? item.area,
    area: item.area,
    context: item.context,
    rationale: item.rationale,
    impact: item.impact ?? item.security_impact,
    security_impact: item.security_impact ?? item.impact,
    follow_up: item.follow_up ?? item.followUp,
  };

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => value !== undefined && value !== null));
}

function capabilityStateForStatus(status) {
  if (status === 'unavailable') return 'unavailable';
  if (status === 'not_configured') return 'not_configured';
  if (status === 'degraded') return 'degraded';
  return 'available';
}

function resultStateForStatus(status) {
  if (status === 'ok') return 'succeeded';
  if (status === 'unavailable' || status === 'not_configured') return 'unavailable';
  if (status === 'degraded') return 'degraded';
  return 'failed';
}

function summarizeTargetScope(projectRoot, targetPath) {
  if (!targetPath) {
    return 'No valid scan target resolved.';
  }

  const relative = projectRoot ? path.relative(projectRoot, targetPath) : '';
  if (!relative) {
    return 'entire project';
  }

  return `project path: ${relative}`;
}

function stringifyConfig(config) {
  if (typeof config === 'string') {
    return config;
  }
  if (config == null) {
    return '';
  }
  return String(config);
}
