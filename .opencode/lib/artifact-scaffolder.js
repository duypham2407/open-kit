import fs from "node:fs"
import path from "node:path"

export const SUPPORTED_SCAFFOLDS = {
  task_card: {
    templatePath: "docs/templates/quick-task-template.md",
    outputDir: "docs/tasks",
  },
  scope_package: {
    templatePath: "docs/templates/scope-package-template.md",
    outputDir: "docs/scope",
  },
  solution_package: {
    templatePath: "docs/templates/solution-package-template.md",
    outputDir: "docs/solution",
  },
  migration_report: {
    templatePath: "docs/templates/migration-report-template.md",
    outputDir: "docs/solution",
  },
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function titleFromSlug(slug) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function replaceTemplatePlaceholders(template, values) {
  return template
    .replace(/TASK-000/g, values.featureId)
    .replace(/FEATURE-000/g, values.featureId)
    .replace(/example-task/g, values.featureSlug)
    .replace(/example-feature/g, values.featureSlug)
    .replace(/example-migration/g, values.featureSlug)
    .replace(/docs\/scope\/YYYY-MM-DD-[^\s]+\.md/g, values.sourceScopePackage)
    .replace(/docs\/solution\/YYYY-MM-DD-[^\s]+\.md/g, values.sourceSolutionPackage)
    .replace(/<Task Name>/g, values.title)
    .replace(/<Feature Name>/g, values.title)
    .replace(/<Migration Name>/g, values.title)
}

function resolveTemplatePath(kind, mode) {
  if (kind === "solution_package" && mode === "migration") {
    return "docs/templates/migration-solution-package-template.md"
  }

  return SUPPORTED_SCAFFOLDS[kind]?.templatePath ?? null
}

function resolveTemplateCandidatePaths({ projectRoot, templateRelativePath, kitRoot }) {
  const candidates = []

  if (projectRoot) {
    candidates.push(path.join(projectRoot, templateRelativePath))
    candidates.push(path.join(projectRoot, ".opencode", "openkit", templateRelativePath))
  }

  if (kitRoot) {
    candidates.push(path.join(kitRoot, templateRelativePath))
  }

  return candidates
}

function findExistingTemplatePath(candidatePaths) {
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function scaffoldArtifact({ projectRoot, kitRoot, kind, mode, slug, featureId, featureSlug, sourceScopePackage, sourceSolutionPackage }) {
  const config = SUPPORTED_SCAFFOLDS[kind]
  if (!config) {
    throw new Error(`Unsupported scaffold kind '${kind}'`)
  }

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("artifact slug must use lowercase kebab-case")
  }

  const resolvedTemplatePath = resolveTemplatePath(kind, mode)
  const templateCandidates = resolveTemplateCandidatePaths({
    projectRoot,
    templateRelativePath: resolvedTemplatePath,
    kitRoot,
  })
  const templatePath = findExistingTemplatePath(templateCandidates)
  const outputDir = path.join(projectRoot, config.outputDir)

  if (!templatePath) {
    throw new Error(`Template not found for scaffold kind '${kind}': '${resolvedTemplatePath}'`)
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const date = formatDate()
  const outputRelativePath = path.posix.join(config.outputDir, `${date}-${slug}.md`)
  const outputPath = path.join(projectRoot, outputRelativePath)
  const resolvedOutputDir = path.resolve(outputDir)
  const resolvedOutputPath = path.resolve(outputPath)

  if (!resolvedOutputPath.startsWith(`${resolvedOutputDir}${path.sep}`)) {
    throw new Error(`artifact path escapes output directory for kind '${kind}'`)
  }

  if (fs.existsSync(resolvedOutputPath)) {
    throw new Error(`Artifact already exists at '${outputRelativePath}'`)
  }

  const template = fs.readFileSync(templatePath, "utf8")
  const content = replaceTemplatePlaceholders(template, {
    date,
    featureId,
    featureSlug,
    sourceScopePackage: sourceScopePackage ?? "docs/scope/YYYY-MM-DD-<feature>.md",
    sourceSolutionPackage: sourceSolutionPackage ?? "docs/solution/YYYY-MM-DD-<feature>.md",
    title: titleFromSlug(slug),
  })

  fs.writeFileSync(resolvedOutputPath, content.endsWith("\n") ? content : `${content}\n`, "utf8")

  return {
    artifactPath: outputRelativePath,
    kind,
  }
}
