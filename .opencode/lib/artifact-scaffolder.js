const fs = require("fs")
const path = require("path")

const SUPPORTED_SCAFFOLDS = {
  task_card: {
    templatePath: "docs/templates/quick-task-template.md",
    outputDir: "docs/tasks",
  },
  scope_package: {
    templatePath: "docs/templates/scope-package-template.md",
    outputDir: "docs/specs",
  },
  solution_package: {
    templatePath: "docs/templates/solution-package-template.md",
    outputDir: "docs/plans",
  },
  migration_report: {
    templatePath: "docs/templates/migration-report-template.md",
    outputDir: "docs/plans",
  },
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
    .replace(/docs\/architecture\/YYYY-MM-DD-[^\s]+\.md/g, values.sourceArchitecture)
    .replace(/docs\/plans\/YYYY-MM-DD-[^\s]+\.md/g, values.sourcePlan)
    .replace(/<Task Name>/g, values.title)
    .replace(/<Feature Name>/g, values.title)
    .replace(/<Migration Name>/g, values.title)
}

function scaffoldArtifact({ projectRoot, kind, mode, slug, featureId, featureSlug, sourceArchitecture, sourcePlan }) {
  const config = SUPPORTED_SCAFFOLDS[kind]
  if (!config) {
    throw new Error(`Unsupported scaffold kind '${kind}'`)
  }

  if (!SLUG_PATTERN.test(slug)) {
    throw new Error("artifact slug must use lowercase kebab-case")
  }

  const resolvedTemplatePath = config.templatePath
  const templatePath = path.join(projectRoot, resolvedTemplatePath)
  const outputDir = path.join(projectRoot, config.outputDir)

  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template not found for scaffold kind '${kind}': '${resolvedTemplatePath}'`)
  }

  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory does not exist for scaffold kind '${kind}': '${config.outputDir}'`)
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
    sourceArchitecture: sourceArchitecture ?? "docs/architecture/YYYY-MM-DD-<feature>.md",
    sourcePlan: sourcePlan ?? "docs/solution/YYYY-MM-DD-<migration>.md",
    title: titleFromSlug(slug),
  })

  fs.writeFileSync(resolvedOutputPath, content.endsWith("\n") ? content : `${content}\n`, "utf8")

  return {
    artifactPath: outputRelativePath,
    kind,
  }
}

module.exports = {
  SLUG_PATTERN,
  SUPPORTED_SCAFFOLDS,
  scaffoldArtifact,
}
