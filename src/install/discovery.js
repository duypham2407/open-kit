import fs from "node:fs"
import path from "node:path"

function fileExists(filePath) {
  return fs.existsSync(filePath)
}

function safeReadJson(filePath) {
  if (!fileExists(filePath)) {
    return {
      exists: false,
      value: null,
      malformed: false,
    }
  }

  try {
    return {
      exists: true,
      value: JSON.parse(fs.readFileSync(filePath, "utf8")),
      malformed: false,
    }
  } catch {
    return {
      exists: true,
      value: null,
      malformed: true,
    }
  }
}

function classifyProjectShape({
  hasRuntimeManifest,
  hasRootInstallEntrypoint,
  hasInstallManifest,
  hasRegistry,
  installManifest,
  registry,
  malformedMetadata,
}) {
  const notes = []

  if (malformedMetadata.installManifest) {
    notes.push("Install manifest metadata is malformed and could not be parsed.")
  }

  if (malformedMetadata.registry) {
    notes.push("Registry metadata is malformed and could not be parsed.")
  }

  if (hasRuntimeManifest && hasRootInstallEntrypoint) {
    return {
      classification: "mixed-install-surfaces",
      notes: [
        ...notes,
        "Detected both repository-local runtime and root install entrypoint surfaces; treat install adoption as mixed and review manually.",
      ],
    }
  }

  const installMode = installManifest?.installation?.mode
  const emergingSurface = registry?.kit?.productSurface?.emerging

  if (
    hasRuntimeManifest &&
    hasInstallManifest &&
    hasRegistry &&
    installMode === "additive-non-destructive" &&
    emergingSurface === "global-openkit-install"
  ) {
    return {
      classification: "openkit-additive-local-metadata",
      notes,
    }
  }

  if (hasRuntimeManifest && !hasInstallManifest && !hasRegistry) {
    return {
      classification: "opencode-runtime-only",
      notes,
    }
  }

  if (!hasRuntimeManifest && !hasRootInstallEntrypoint) {
    return {
      classification: "unknown",
      notes: [...notes, "No recognized runtime manifest or install entrypoint was found."],
    }
  }

  return {
    classification: "unclassified",
    notes: [...notes, "Detected a partial or unsupported runtime surface combination."],
  }
}

export function discoverProjectShape(projectRoot) {
  const runtimeManifestPath = path.join(projectRoot, ".opencode", "opencode.json")
  const rootInstallEntrypointPath = path.join(projectRoot, "opencode.json")
  const installManifestPath = path.join(projectRoot, ".opencode", "install-manifest.json")
  const registryPath = path.join(projectRoot, "registry.json")

  const hasRuntimeManifest = fileExists(runtimeManifestPath)
  const hasRootInstallEntrypoint = fileExists(rootInstallEntrypointPath)
  const hasInstallManifest = fileExists(installManifestPath)
  const hasRegistry = fileExists(registryPath)

  const installManifestResult = safeReadJson(installManifestPath)
  const registryResult = safeReadJson(registryPath)
  const malformedMetadata = {
    installManifest: installManifestResult.malformed,
    registry: registryResult.malformed,
  }
  const classification = classifyProjectShape({
    hasRuntimeManifest,
    hasRootInstallEntrypoint,
    hasInstallManifest,
    hasRegistry,
    installManifest: installManifestResult.value,
    registry: registryResult.value,
    malformedMetadata,
  })

  return {
    projectRoot,
    runtimeManifestPath,
    rootInstallEntrypointPath,
    installManifestPath,
    registryPath,
    hasRuntimeManifest,
    hasRootInstallEntrypoint,
    hasInstallManifest,
    hasRegistry,
    malformedMetadata,
    classification: classification.classification,
    notes: classification.notes,
  }
}
