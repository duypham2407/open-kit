import test from "node:test"
import assert from "node:assert/strict"

import { applyOpenKitMergePolicy } from "../../src/install/merge-policy.js"

test("applyOpenKitMergePolicy additively merges supported plugin and instructions fields", () => {
  const currentConfig = {
    $schema: "https://example.com/schema.json",
    plugin: ["existing-plugin"],
    instructions: ["local-note.md"],
  }

  const desiredConfig = {
    plugin: ["existing-plugin", "openkit-plugin"],
    instructions: ["local-note.md", "OPENKIT.md"],
  }

  const result = applyOpenKitMergePolicy({ currentConfig, desiredConfig })

  assert.deepEqual(result.config, {
    $schema: "https://example.com/schema.json",
    plugin: ["existing-plugin", "openkit-plugin"],
    instructions: ["local-note.md", "OPENKIT.md"],
  })
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.appliedFields, ["plugin", "instructions"])
})

test("applyOpenKitMergePolicy rejects unsupported top-level rewrites", () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      plugin: ["existing-plugin"],
      theme: "light",
    },
    desiredConfig: {
      plugin: ["existing-plugin", "openkit-plugin"],
      theme: "dark",
    },
  })

  assert.deepEqual(result.config, {
    plugin: ["existing-plugin", "openkit-plugin"],
    theme: "light",
  })
  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(result.conflicts[0], {
    field: "theme",
    reason: "unsupported-top-level-key",
    currentValue: "light",
    desiredValue: "dark",
  })
})

test("applyOpenKitMergePolicy rejects unclassified key additions", () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      plugin: [],
    },
    desiredConfig: {
      plugin: ["openkit-plugin"],
      wrappers: {
        managed: true,
      },
    },
  })

  assert.deepEqual(result.config, {
    plugin: ["openkit-plugin"],
  })
  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(result.conflicts[0], {
    field: "wrappers",
    reason: "unclassified-top-level-key",
    currentValue: undefined,
    desiredValue: {
      managed: true,
    },
  })
})

test("applyOpenKitMergePolicy preserves existing order while appending unique allowlisted values", () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      plugin: ["alpha", "beta"],
      instructions: ["LOCAL.md"],
    },
    desiredConfig: {
      plugin: ["beta", "gamma", "alpha"],
      instructions: ["OPENKIT.md", "LOCAL.md", "GUIDE.md"],
    },
  })

  assert.deepEqual(result.config, {
    plugin: ["alpha", "beta", "gamma"],
    instructions: ["LOCAL.md", "OPENKIT.md", "GUIDE.md"],
  })
  assert.deepEqual(result.conflicts, [])
})

test("applyOpenKitMergePolicy additively inserts allowed managed-install top-level keys", () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      plugin: ["existing-plugin"],
      instructions: ["LOCAL.md"],
      theme: "light",
    },
    desiredConfig: {
      installState: {
        path: ".openkit/openkit-install.json",
        schema: "openkit/install-state@1",
      },
      mcp: {
        openkit: {
          type: "local",
          command: ["node", "bin/openkit-mcp.js"],
          enabled: true,
          environment: {
            OPENKIT_PROJECT_ROOT: "{cwd}",
          },
        },
        "chrome-devtools": {
          type: "local",
          command: ["npx", "-y", "chrome-devtools-mcp@0.21.0"],
          enabled: true,
        },
      },
      permission: {
        read: "allow",
        write: "allow",
        rm: "ask",
      },
      productSurface: {
        current: "global-openkit-install",
        installReadiness: "managed",
        installationMode: "openkit-managed",
      },
    },
  })

  assert.deepEqual(result.config, {
    plugin: ["existing-plugin"],
    instructions: ["LOCAL.md"],
    theme: "light",
    installState: {
      path: ".openkit/openkit-install.json",
      schema: "openkit/install-state@1",
    },
    mcp: {
      openkit: {
        type: "local",
        command: ["node", "bin/openkit-mcp.js"],
        enabled: true,
        environment: {
          OPENKIT_PROJECT_ROOT: "{cwd}",
        },
      },
      "chrome-devtools": {
        type: "local",
        command: ["npx", "-y", "chrome-devtools-mcp@0.21.0"],
        enabled: true,
      },
    },
    permission: {
      read: "allow",
      write: "allow",
      rm: "ask",
    },
    productSurface: {
      current: "global-openkit-install",
      installReadiness: "managed",
      installationMode: "openkit-managed",
    },
  })
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.appliedFields, ["installState", "mcp", "permission", "productSurface"])
})

test("applyOpenKitMergePolicy treats allowlisted object fields as equal regardless of key order", () => {
  const result = applyOpenKitMergePolicy({
    currentConfig: {
      installState: {
        schema: "openkit/install-state@1",
        path: ".openkit/openkit-install.json",
      },
      permission: {
        rm: "ask",
        read: "allow",
      },
      productSurface: {
        installationMode: "openkit-managed",
        installReadiness: "managed",
        current: "global-openkit-install",
      },
    },
    desiredConfig: {
      installState: {
        path: ".openkit/openkit-install.json",
        schema: "openkit/install-state@1",
      },
      permission: {
        read: "allow",
        rm: "ask",
      },
      productSurface: {
        current: "global-openkit-install",
        installReadiness: "managed",
        installationMode: "openkit-managed",
      },
    },
  })

  assert.deepEqual(result.config, {
    installState: {
      schema: "openkit/install-state@1",
      path: ".openkit/openkit-install.json",
    },
    permission: {
      rm: "ask",
      read: "allow",
    },
    productSurface: {
      installationMode: "openkit-managed",
      installReadiness: "managed",
      current: "global-openkit-install",
    },
  })
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(result.appliedFields, ["installState", "permission", "productSurface"])
})
