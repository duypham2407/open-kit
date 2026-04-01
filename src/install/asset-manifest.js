import fs from "node:fs"
import path from "node:path"

const OPENKIT_OPENCODE_BUNDLED_ASSETS = [
  {
    id: "opencode.bundle.readme",
    assetClass: "bundle-metadata",
    sourcePath: "assets/install-bundle/opencode/README.md",
    bundledPath: "assets/install-bundle/opencode/README.md",
  },
  {
    id: "opencode.agent.CodeReviewer",
    assetClass: "agents",
    sourcePath: "agents/code-reviewer.md",
    bundledPath: "assets/install-bundle/opencode/agents/CodeReviewer.md",
    status: "active",
  },
  {
    id: "opencode.agent.FullstackAgent",
    assetClass: "agents",
    sourcePath: "agents/fullstack-agent.md",
    bundledPath: "assets/install-bundle/opencode/agents/FullstackAgent.md",
    status: "active",
  },
  {
    id: "opencode.agent.MasterOrchestrator",
    assetClass: "agents",
    sourcePath: "agents/master-orchestrator.md",
    bundledPath: "assets/install-bundle/opencode/agents/MasterOrchestrator.md",
    status: "active",
  },
  {
    id: "opencode.agent.ProductLead",
    assetClass: "agents",
    sourcePath: "agents/product-lead-agent.md",
    bundledPath: "assets/install-bundle/opencode/agents/ProductLead.md",
    status: "active",
  },
  {
    id: "opencode.agent.QAAgent",
    assetClass: "agents",
    sourcePath: "agents/qa-agent.md",
    bundledPath: "assets/install-bundle/opencode/agents/QAAgent.md",
    status: "active",
  },
  {
    id: "opencode.agent.QuickAgent",
    assetClass: "agents",
    sourcePath: "agents/quick-agent.md",
    bundledPath: "assets/install-bundle/opencode/agents/QuickAgent.md",
    status: "active",
  },
  {
    id: "opencode.agent.SolutionLead",
    assetClass: "agents",
    sourcePath: "agents/solution-lead-agent.md",
    bundledPath: "assets/install-bundle/opencode/agents/SolutionLead.md",
    status: "active",
  },
  {
    id: "opencode.command.brainstorm",
    assetClass: "commands",
    sourcePath: "commands/brainstorm.md",
    bundledPath: "assets/install-bundle/opencode/commands/brainstorm.md",
  },
  {
    id: "opencode.command.delivery",
    assetClass: "commands",
    sourcePath: "commands/delivery.md",
    bundledPath: "assets/install-bundle/opencode/commands/delivery.md",
  },
  {
    id: "opencode.command.execute-solution",
    assetClass: "commands",
    sourcePath: "commands/execute-solution.md",
    bundledPath: "assets/install-bundle/opencode/commands/execute-solution.md",
  },
  {
    id: "opencode.command.configure-agent-models",
    assetClass: "commands",
    sourcePath: "commands/configure-agent-models.md",
    bundledPath: "assets/install-bundle/opencode/commands/configure-agent-models.md",
  },
  {
    id: "opencode.command.switch",
    assetClass: "commands",
    sourcePath: "commands/switch.md",
    bundledPath: "assets/install-bundle/opencode/commands/switch.md",
  },
  {
    id: "opencode.command.migrate",
    assetClass: "commands",
    sourcePath: "commands/migrate.md",
    bundledPath: "assets/install-bundle/opencode/commands/migrate.md",
  },
  {
    id: "opencode.command.quick-task",
    assetClass: "commands",
    sourcePath: "commands/quick-task.md",
    bundledPath: "assets/install-bundle/opencode/commands/quick-task.md",
  },
  {
    id: "opencode.command.task",
    assetClass: "commands",
    sourcePath: "commands/task.md",
    bundledPath: "assets/install-bundle/opencode/commands/task.md",
  },
  {
    id: "opencode.command.write-solution",
    assetClass: "commands",
    sourcePath: "commands/write-solution.md",
    bundledPath: "assets/install-bundle/opencode/commands/write-solution.md",
  },
  {
    id: "opencode.context.lane-selection",
    assetClass: "context",
    sourcePath: "context/core/lane-selection.md",
    bundledPath: "assets/install-bundle/opencode/context/core/lane-selection.md",
  },
  {
    id: "opencode.skill.brainstorming",
    assetClass: "skills",
    sourcePath: "skills/brainstorming/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/brainstorming/SKILL.md",
  },
  {
    id: "opencode.skill.find-skills",
    assetClass: "skills",
    sourcePath: "skills/find-skills/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/find-skills/SKILL.md",
  },
  {
    id: "opencode.skill.code-review",
    assetClass: "skills",
    sourcePath: "skills/code-review/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/code-review/SKILL.md",
  },
  {
    id: "opencode.skill.vercel-composition-patterns",
    assetClass: "skills",
    sourcePath: "skills/vercel-composition-patterns/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/vercel-composition-patterns/SKILL.md",
  },
  {
    id: "opencode.skill.vercel-react-best-practices",
    assetClass: "skills",
    sourcePath: "skills/vercel-react-best-practices/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/vercel-react-best-practices/SKILL.md",
  },
  {
    id: "opencode.skill.vercel-react-native-skills",
    assetClass: "skills",
    sourcePath: "skills/vercel-react-native-skills/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/vercel-react-native-skills/SKILL.md",
  },
  {
    id: "opencode.skill.subagent-driven-development",
    assetClass: "skills",
    sourcePath: "skills/subagent-driven-development/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/subagent-driven-development/SKILL.md",
  },
  {
    id: "opencode.skill.systematic-debugging",
    assetClass: "skills",
    sourcePath: "skills/systematic-debugging/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/systematic-debugging/SKILL.md",
  },
  {
    id: "opencode.skill.test-driven-development",
    assetClass: "skills",
    sourcePath: "skills/test-driven-development/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/test-driven-development/SKILL.md",
  },
  {
    id: "opencode.skill.using-skills",
    assetClass: "skills",
    sourcePath: "skills/using-skills/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/using-skills/SKILL.md",
  },
  {
    id: "opencode.skill.verification-before-completion",
    assetClass: "skills",
    sourcePath: "skills/verification-before-completion/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/verification-before-completion/SKILL.md",
  },
  {
    id: "opencode.skill.writing-solution",
    assetClass: "skills",
    sourcePath: "skills/writing-solution/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/writing-solution/SKILL.md",
  },
  {
    id: "opencode.skill.writing-scope",
    assetClass: "skills",
    sourcePath: "skills/writing-scope/SKILL.md",
    bundledPath: "assets/install-bundle/opencode/skills/writing-scope/SKILL.md",
  },
]

export const OPENKIT_ASSET_MANIFEST = {
  schema: "openkit/asset-manifest@1",
  manifestVersion: 1,
  bundle: {
    namespace: "openkit",
    profile: "openkit-global-install",
    phase: 1,
    derivedFrom: ["agents/", "commands/", "skills/"],
    includedAssetClasses: ["agents", "commands", "context", "skills"],
    deferredAssetClasses: ["plugins", "package.json"],
    collisionPolicy: {
      installNamespace: "openkit",
      assetIdPrefix: "opencode",
      onCollision: "fail-closed-and-require-explicit-mapping",
      rationale:
        "Phase 1 ships an explicit namespaced bundle instead of overwriting unrelated OpenCode-native assets.",
    },
    assets: OPENKIT_OPENCODE_BUNDLED_ASSETS,
  },
  assets: [
    {
      id: "runtime.opencode-manifest",
      path: "opencode.json",
      kind: "template",
      templatePath: "assets/opencode.json.template",
      phase: 1,
      required: true,
      adoptionAllowed: true,
      description: "Managed install entrypoint manifest for OpenKit installs.",
    },
    {
      id: "runtime.install-state",
      path: ".openkit/openkit-install.json",
      kind: "template",
      templatePath: "assets/openkit-install.json.template",
      phase: 1,
      required: true,
      adoptionAllowed: false,
      description: "OpenKit-managed install state persisted in the target repository.",
    },
  ],
}

export function listManagedAssetIds() {
  return OPENKIT_ASSET_MANIFEST.assets.map((asset) => asset.id)
}

export function listBundledAssetIds() {
  return OPENKIT_ASSET_MANIFEST.bundle.assets.map((asset) => asset.id)
}

export function getManagedAsset(assetId) {
  return OPENKIT_ASSET_MANIFEST.assets.find((asset) => asset.id === assetId) ?? null
}

export function validateBundledAssetFiles(projectRoot) {
  const bundleRoot = path.join(projectRoot, "assets", "install-bundle", "opencode")
  const missingFiles = []
  const mismatchedFiles = []

  for (const asset of OPENKIT_ASSET_MANIFEST.bundle.assets) {
    const sourcePath = path.join(projectRoot, asset.sourcePath)
    const bundledPath = path.join(projectRoot, asset.bundledPath)
    const hasSourceFile = fs.existsSync(sourcePath)
    const hasBundledFile = fs.existsSync(bundledPath)

    if (!hasSourceFile) {
      missingFiles.push(asset.sourcePath)
    }

    if (!hasBundledFile) {
      missingFiles.push(asset.bundledPath)
    }

    if (hasSourceFile && hasBundledFile) {
      const sourceContents = fs.readFileSync(sourcePath, "utf8")
      const bundledContents = fs.readFileSync(bundledPath, "utf8")

      if (sourceContents !== bundledContents) {
        mismatchedFiles.push({
          id: asset.id,
          sourcePath: asset.sourcePath,
          bundledPath: asset.bundledPath,
        })
      }
    }
  }

  const bundledFiles = []

  function collectFiles(currentPath) {
    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      const entryPath = path.join(currentPath, entry.name)

      if (entry.isDirectory()) {
        collectFiles(entryPath)
        continue
      }

      bundledFiles.push(path.relative(projectRoot, entryPath))
    }
  }

  if (fs.existsSync(bundleRoot)) {
    collectFiles(bundleRoot)
  }

  const expectedBundledFiles = new Set(
    OPENKIT_ASSET_MANIFEST.bundle.assets.map((asset) => asset.bundledPath),
  )

  const extraBundledFiles = bundledFiles.filter((filePath) => !expectedBundledFiles.has(filePath))

  return {
    missingFiles,
    mismatchedFiles,
    bundleFileCount: OPENKIT_ASSET_MANIFEST.bundle.assets.length,
    expectedBundledFiles: [...expectedBundledFiles],
    actualBundledFiles: bundledFiles,
    extraBundledFiles,
  }
}
