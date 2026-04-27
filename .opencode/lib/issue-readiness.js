const OPEN_ISSUE_STATUSES = new Set(["open", "in_progress"])
const TERMINAL_ISSUE_STATUSES = new Set(["resolved", "closed"])

function normalizeIssueStatus(status) {
  return typeof status === "string" ? status.toLowerCase() : ""
}

function isOpenIssueStatus(status) {
  return OPEN_ISSUE_STATUSES.has(normalizeIssueStatus(status))
}

function isTerminalIssueStatus(status) {
  return TERMINAL_ISSUE_STATUSES.has(normalizeIssueStatus(status))
}

function getOpenIssues(issues) {
  return Array.isArray(issues) ? issues.filter((issue) => isOpenIssueStatus(issue?.current_status)) : []
}

function getResolvedIssueHistory(issues) {
  return Array.isArray(issues) ? issues.filter((issue) => isTerminalIssueStatus(issue?.current_status)) : []
}

export {
  getOpenIssues,
  getResolvedIssueHistory,
  isOpenIssueStatus,
  isTerminalIssueStatus,
}
