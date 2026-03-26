const fs = require("fs")
const path = require("path")

function fail(message) {
  const error = new Error(message)
  error.isReleaseStoreError = true
  throw error
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function readJson(filePath, missingMessage) {
  let raw
  try {
    raw = fs.readFileSync(filePath, "utf8")
  } catch (error) {
    if (error.code === "ENOENT" && missingMessage) {
      fail(missingMessage)
    }
    fail(`Unable to read JSON at '${filePath}': ${error.message}`)
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    fail(`Malformed JSON at '${filePath}': ${error.message}`)
  }
}

function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath))
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function resolveReleasePaths(projectRoot) {
  const releasesDir = path.join(projectRoot, ".opencode", "releases")
  return {
    releasesDir,
    indexPath: path.join(releasesDir, "index.json"),
  }
}

function resolveReleaseCandidatePaths(projectRoot, releaseId) {
  const paths = resolveReleasePaths(projectRoot)
  const releaseDir = path.join(paths.releasesDir, releaseId)
  return {
    ...paths,
    releaseDir,
    releasePath: path.join(releaseDir, "release.json"),
    relativeReleasePath: path.posix.join(".opencode", "releases", releaseId, "release.json"),
  }
}

function createEmptyReleaseIndex() {
  return {
    active_release_id: null,
    releases: [],
  }
}

function bootstrapReleaseStore(projectRoot) {
  const paths = resolveReleasePaths(projectRoot)
  ensureDir(paths.releasesDir)
  if (!fs.existsSync(paths.indexPath)) {
    writeJson(paths.indexPath, createEmptyReleaseIndex())
  }
  return readReleaseIndex(projectRoot)
}

function readReleaseIndex(projectRoot) {
  return readJson(resolveReleasePaths(projectRoot).indexPath, "Release index missing")
}

function writeReleaseIndex(projectRoot, index) {
  writeJson(resolveReleasePaths(projectRoot).indexPath, index)
  return index
}

function readReleaseCandidate(projectRoot, releaseId) {
  return readJson(resolveReleaseCandidatePaths(projectRoot, releaseId).releasePath, `Release candidate '${releaseId}' missing`)
}

function writeReleaseCandidate(projectRoot, releaseId, candidate) {
  writeJson(resolveReleaseCandidatePaths(projectRoot, releaseId).releasePath, candidate)
  return candidate
}

function upsertReleaseIndexEntry(index, candidate, releaseId, relativeReleasePath) {
  const nextEntry = {
    release_id: releaseId,
    title: candidate.title,
    status: candidate.status,
    risk_level: candidate.risk_level,
    release_path: relativeReleasePath,
    target_window: candidate.target_window,
  }

  const existingIndex = index.releases.findIndex((entry) => entry.release_id === releaseId)
  if (existingIndex === -1) {
    index.releases.push(nextEntry)
  } else {
    index.releases[existingIndex] = nextEntry
  }

  return nextEntry
}

module.exports = {
  bootstrapReleaseStore,
  readReleaseCandidate,
  readReleaseIndex,
  resolveReleaseCandidatePaths,
  resolveReleasePaths,
  upsertReleaseIndexEntry,
  writeReleaseCandidate,
  writeReleaseIndex,
}
