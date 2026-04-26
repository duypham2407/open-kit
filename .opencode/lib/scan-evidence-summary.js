function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {}
}

function getVerificationEvidence(state) {
  return Array.isArray(state?.verification_evidence) ? state.verification_evidence : []
}

function readScanEvidence(entry) {
  const details = readObject(entry?.details)
  const scanEvidence = readObject(details.scan_evidence)

  if (Object.keys(scanEvidence).length === 0) {
    return null
  }

  return { details, scanEvidence }
}

function normalizeFindingCounts(scanEvidence) {
  const findingCounts = readObject(scanEvidence.finding_counts)
  const total = scanEvidence.finding_count ?? scanEvidence.findingCount ?? findingCounts.total ?? findingCounts.findings ?? 0

  return {
    ...findingCounts,
    total,
  }
}

function normalizeClassificationSummary(scanEvidence) {
  const triage = readObject(scanEvidence.triage_summary)

  return {
    group_count: triage.groupCount ?? triage.group_count ?? 0,
    blocking_count: triage.blockingCount ?? triage.blocking_count ?? 0,
    non_blocking_noise_count: triage.nonBlockingNoiseCount ?? triage.non_blocking_noise_count ?? 0,
    false_positive_count: triage.falsePositiveCount ?? triage.false_positive_count ?? 0,
    follow_up_count: triage.followUpCount ?? triage.follow_up_count ?? 0,
    unclassified_count: triage.unclassifiedCount ?? triage.unclassified_count ?? 0,
  }
}

function summarizeFalsePositiveEvidence(scanEvidence) {
  const summary = readObject(scanEvidence.false_positive_summary)
  const items = Array.isArray(summary.items)
    ? summary.items
    : Array.isArray(summary.false_positives)
      ? summary.false_positives
      : []

  return {
    ...summary,
    count: summary.count ?? items.length,
    items,
  }
}

function formatCounts(counts = {}) {
  const orderedKeys = ["total", "blocking", "non_blocking_noise", "false_positive", "unclassified", "follow_up"]
  const parts = []

  for (const key of orderedKeys) {
    if (counts[key] !== undefined && counts[key] !== null) {
      parts.push(`${key}=${counts[key]}`)
    }
  }

  for (const [key, value] of Object.entries(counts)) {
    if (!orderedKeys.includes(key) && value !== undefined && value !== null) {
      parts.push(`${key}=${value}`)
    }
  }

  return parts.join(",")
}

function summarizeScanEvidence(state) {
  return getVerificationEvidence(state)
    .map((entry) => {
      const payload = readScanEvidence(entry)
      if (!payload) {
        return null
      }

      const { details, scanEvidence } = payload
      const directTool = readObject(scanEvidence.direct_tool)
      const substitute = scanEvidence.substitute === null ? null : readObject(scanEvidence.substitute)
      const manualOverride = scanEvidence.manual_override === null ? null : readObject(scanEvidence.manual_override)

      return {
        evidence_id: entry.id,
        kind: entry.kind,
        scope: entry.scope,
        summary: entry.summary,
        source: entry.source,
        validation_surface: details.validation_surface ?? scanEvidence.validation_surface ?? null,
        evidence_type: scanEvidence.evidence_type ?? null,
        scan_kind: scanEvidence.scan_kind ?? null,
        target_scope_summary: scanEvidence.target_scope_summary ?? null,
        rule_config_source: scanEvidence.rule_config_source ?? null,
        direct_tool: {
          tool_id: directTool.tool_id ?? null,
          availability_state: directTool.availability_state ?? null,
          result_state: directTool.result_state ?? null,
          reason: directTool.reason ?? null,
        },
        substitute,
        finding_counts: normalizeFindingCounts(scanEvidence),
        severity_summary: readObject(scanEvidence.severity_summary),
        classification_summary: normalizeClassificationSummary(scanEvidence),
        false_positive_summary: summarizeFalsePositiveEvidence(scanEvidence),
        manual_override: manualOverride,
        artifact_refs: Array.isArray(entry.artifact_refs) ? entry.artifact_refs : [],
      }
    })
    .filter(Boolean)
}

function describeScanEvidence(entry) {
  const directTool = entry.direct_tool ?? {}
  const directStatus = directTool.tool_id
    ? `direct ${directTool.tool_id} ${directTool.availability_state ?? "unknown"}/${directTool.result_state ?? "unknown"}`
    : "direct none"
  const substitute = entry.substitute
  const substituteStatus = substitute && Object.keys(substitute).length > 0
    ? `substitute ${substitute.command_or_tool ?? "unnamed"} ${substitute.ran === true ? "ran" : "not-run"}`
    : "substitute none"
  const manualOverride = entry.manual_override
  const manualStatus = manualOverride && Object.keys(manualOverride).length > 0
    ? `manual override for ${manualOverride.target_stage ?? "unknown-stage"}: ${manualOverride.unavailable_tool ?? directTool.tool_id ?? "unknown-tool"}${manualOverride.caveat ? ` (${manualOverride.caveat})` : ""}`
    : "manual override none"
  const classification = entry.classification_summary ?? {}
  const falsePositive = entry.false_positive_summary ?? {}
  const artifactRefs = Array.isArray(entry.artifact_refs) && entry.artifact_refs.length > 0
    ? ` | artifacts ${entry.artifact_refs.join(",")}`
    : ""

  return [
    `scan evidence: ${entry.evidence_id}`,
    entry.evidence_type === "manual_override" ? manualStatus : null,
    entry.evidence_type === "substitute_scan" ? substituteStatus : directStatus,
    entry.evidence_type === "substitute_scan" ? directStatus : null,
    entry.evidence_type !== "substitute_scan" && substituteStatus !== "substitute none" ? substituteStatus : null,
    `surface ${entry.validation_surface ?? "unknown"}`,
    `findings ${formatCounts(entry.finding_counts)}`,
    `classifications groups=${classification.group_count ?? 0},blocking=${classification.blocking_count ?? 0},noise=${classification.non_blocking_noise_count ?? 0},false_positive=${classification.false_positive_count ?? 0},unclassified=${classification.unclassified_count ?? 0}`,
    `false-positive count=${falsePositive.count ?? 0}`,
  ].filter(Boolean).join(" | ") + artifactRefs
}

function summarizeScanEvidenceLines(state) {
  return summarizeScanEvidence(state).map(describeScanEvidence)
}

export {
  describeScanEvidence,
  formatCounts,
  summarizeScanEvidence,
  summarizeScanEvidenceLines,
}
