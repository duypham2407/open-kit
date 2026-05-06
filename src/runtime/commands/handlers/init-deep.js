import fs from 'node:fs';
import path from 'node:path';

function readJsonIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function readFirstMarkdownHeading(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function detectPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) {
    return 'yarn';
  }
  if (fs.existsSync(path.join(projectRoot, 'bun.lockb')) || fs.existsSync(path.join(projectRoot, 'bun.lock'))) {
    return 'bun';
  }
  if (fs.existsSync(path.join(projectRoot, 'package-lock.json'))) {
    return 'npm';
  }
  return null;
}

function listImportantDirectories(projectRoot) {
  const candidates = ['src', 'tests', 'docs', 'commands', 'agents', 'skills', 'context', '.opencode', 'apps', 'packages'];
  return candidates.filter((entry) => fs.existsSync(path.join(projectRoot, entry)));
}

function summarizeValidationCommands(packageJson) {
  const scripts = packageJson?.scripts ?? {};
  return {
    build: typeof scripts.build === 'string' ? scripts.build : null,
    lint: typeof scripts.lint === 'string' ? scripts.lint : null,
    test: typeof scripts.test === 'string' ? scripts.test : null,
  };
}

function listTopLevelEntries(projectRoot) {
  try {
    return fs.readdirSync(projectRoot, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith('.git'))
      .map((entry) => `${entry.name}${entry.isDirectory() ? '/' : ''}`)
      .slice(0, 40);
  } catch {
    return [];
  }
}

function collectProjectMarkers(projectRoot) {
  const markers = [];
  const checks = [
    ['package.json', 'JavaScript/TypeScript package metadata present in `package.json`.'],
    ['tsconfig.json', 'TypeScript compiler configuration present in `tsconfig.json`.'],
    ['vite.config.ts', 'Vite configuration present in `vite.config.ts`.'],
    ['vite.config.js', 'Vite configuration present in `vite.config.js`.'],
    ['next.config.js', 'Next.js configuration present in `next.config.js`.'],
    ['next.config.mjs', 'Next.js configuration present in `next.config.mjs`.'],
    ['turbo.json', 'Turborepo configuration present in `turbo.json`.'],
    ['pnpm-workspace.yaml', 'pnpm workspace configuration present in `pnpm-workspace.yaml`.'],
    ['Cargo.toml', 'Rust package or workspace metadata present in `Cargo.toml`.'],
    ['go.mod', 'Go module metadata present in `go.mod`.'],
    ['pyproject.toml', 'Python project metadata present in `pyproject.toml`.'],
    ['Dockerfile', 'Container build instructions present in `Dockerfile`.'],
  ];

  for (const [relativePath, description] of checks) {
    if (fs.existsSync(path.join(projectRoot, relativePath))) {
      markers.push(description);
    }
  }

  return markers;
}

function extractExistingProjectSections(existingContent) {
  if (!existingContent) {
    return [];
  }

  const sectionMatches = [...existingContent.matchAll(/^##\s+.+$/gm)];
  const preserved = [];

  const titleMatch = existingContent.match(/^#\s+.+$/m);
  const preambleStart = titleMatch ? titleMatch.index + titleMatch[0].length : 0;
  const preambleEnd = sectionMatches.length > 0 ? sectionMatches[0].index : existingContent.length;
  const preamble = existingContent.slice(preambleStart, preambleEnd).trim();
  if (preamble) {
    preserved.push(preamble);
  }

  for (let index = 0; index < sectionMatches.length; index += 1) {
    const match = sectionMatches[index];
    const heading = match[0].trim();
    const start = match.index;
    const end = index + 1 < sectionMatches.length ? sectionMatches[index + 1].index : existingContent.length;
    const section = existingContent.slice(start, end).trim();

    if (!section) {
      continue;
    }

    if (heading === '## Preserved Project Notes') {
      const body = section.replace(/^## Preserved Project Notes\s*/m, '').trim();
      if (body) {
        preserved.push(body);
      }
      continue;
    }

    if (heading === '## OpenKit Workflow Overlay' || heading === '## Maintainer Notes') {
      continue;
    }

    preserved.push(section);
  }

  return preserved;
}

function inferProjectSummary({ projectRoot, packageJson, readmeHeading, importantDirectories }) {
  const packageName = typeof packageJson?.name === 'string' ? packageJson.name : path.basename(projectRoot);
  const summarySource = readmeHeading ?? packageJson?.description ?? null;
  const summary = summarySource
    ? `This repository is ${packageName}. ${summarySource.endsWith('.') ? summarySource : `${summarySource}.`}`
    : `This repository is ${packageName}. Document the exact product/domain summary here if README or package metadata is still incomplete.`;

  const stack = [];
  if (packageJson) {
    stack.push('Node.js repository with package metadata in `package.json`.');
  }

  const packageManager = detectPackageManager(projectRoot);
  if (packageManager) {
    stack.push(`Preferred package manager signal: \`${packageManager}\`.`);
  }

  if (importantDirectories.includes('src')) {
    stack.push('Application or runtime source lives under `src/`.');
  }
  if (importantDirectories.includes('tests')) {
    stack.push('Automated tests live under `tests/`.');
  }
  if (importantDirectories.includes('docs')) {
    stack.push('Repository documentation and workflow artifacts live under `docs/`.');
  }

  return { packageName, summary, stack };
}

function buildAgentsContent({ analysis, preservedSections = [] }) {
  const validation = analysis.validation;
  const topLevelEntries = analysis.topLevelEntries
    .map((entry) => `- \`${entry}\``)
    .join('\n');
  const importantDirectories = analysis.importantDirectories
    .map((entry) => `- \`${entry}/\``)
    .join('\n');
  const stackSignals = [...analysis.project.stack, ...analysis.projectMarkers];
  const stackLines = stackSignals.length > 0
    ? stackSignals.map((entry) => `- ${entry}`).join('\n')
    : '- Project stack signals are incomplete; inspect the repository before assuming frameworks or tooling.';

  const buildCommand = validation.build ? `\`${validation.build}\`` : 'Unavailable: no repository-native build command is currently defined.';
  const lintCommand = validation.lint ? `\`${validation.lint}\`` : 'Unavailable: no repository-native lint command is currently defined.';
  const testCommand = validation.test ? `\`${validation.test}\`` : 'Unavailable: no repository-native test command is currently defined.';

  const preservedBlock = preservedSections.length > 0
    ? `## Preserved Project Notes\n\n${preservedSections.join('\n\n')}\n\n`
    : '';

  return `# Project Agent Guide

## Project Identity

${analysis.project.summary}

## Current Repository Signals

${stackLines}

## Important Directories

${importantDirectories || '- Add important repository directories here once the project structure is established.'}

## Top-Level Entries

${topLevelEntries || '- Add notable top-level files and directories here once repository discovery is complete.'}

## Validation Commands

- Build: ${buildCommand}
- Lint: ${lintCommand}
- Test: ${testCommand}

## Working Rules

- Treat this root \`AGENTS.md\` as the project-owned agent briefing document that is safe to commit.
- Update this file when the repository's actual stack, commands, structure, or conventions change.
- Do not invent frameworks, package managers, CI behavior, or deployment steps that are not present in the working tree.
- Treat workflow mode or lane state as downstream execution context, not as a prerequisite for repository analysis.
- If validation tooling is missing, report that gap honestly instead of substituting OpenKit runtime checks as project-app validation.

${preservedBlock}## OpenKit Workflow Overlay

- Read OpenKit-managed workflow guidance from \`.opencode/openkit/AGENTS.md\` and the linked \`.opencode/openkit/context/...\` docs.
- Keep the source-of-truth order explicit: direct user instruction first, then this project-owned \`AGENTS.md\`, then canonical OpenKit workflow docs.
- Preserve the OpenKit path model: global kit/config root, managed workspace runtime-state root, project compatibility shim under \`.opencode/\`, and project source root are separate layers.
- Use \`/task\` as the default workflow entrypoint unless the lane is already obvious; use migration/full artifacts when the work is not a bounded quick task.
- Treat OpenKit runtime checks as \`global_cli\`, \`runtime_tooling\`, or \`compatibility_runtime\` evidence only; they do not prove target-project application behavior.

## Maintainer Notes

- Generated by OpenKit runtime-backed \`/init-deep\` from repository signals on demand.
- Re-run \`/init-deep\` after major project structure or tooling changes, then review and refine this file if the repository needs more domain-specific guidance.
`;
}

export function createInitDeepHandler() {
  return {
    id: 'runtime-command.init-deep',
    name: '/init-deep',
    description: 'Analyze project signals and refresh root AGENTS guidance.',
    executionPriority: 'direct-runtime',
    bypassLaneSelection: true,
    async execute({ projectRoot, commandName = '/init-deep' } = {}) {
      if (!projectRoot) {
        return {
          status: 'invalid-input',
          message: `${commandName} requires a project root.`,
          validation_surface: 'runtime_tooling',
        };
      }

      const packageJson = readJsonIfPresent(path.join(projectRoot, 'package.json'));
      const importantDirectories = listImportantDirectories(projectRoot);
      const analysis = {
        importantDirectories,
        topLevelEntries: listTopLevelEntries(projectRoot),
        projectMarkers: collectProjectMarkers(projectRoot),
        readmeHeading: readFirstMarkdownHeading(path.join(projectRoot, 'README.md')),
        validation: summarizeValidationCommands(packageJson),
      };
      analysis.project = inferProjectSummary({
        projectRoot,
        packageJson,
        readmeHeading: analysis.readmeHeading,
        importantDirectories,
      });

      const agentsPath = path.join(projectRoot, 'AGENTS.md');
      const existingContent = fs.existsSync(agentsPath) && fs.statSync(agentsPath).isFile()
        ? fs.readFileSync(agentsPath, 'utf8')
        : null;
      const preservedSections = extractExistingProjectSections(existingContent);
      const content = buildAgentsContent({ analysis, preservedSections });

      try {
        fs.writeFileSync(agentsPath, content, 'utf8');
      } catch (error) {
        return {
          status: 'error',
          command: commandName,
          agentsPath,
          validation_surface: 'runtime_tooling',
          message: `Failed to write root AGENTS.md: ${error.message}`,
        };
      }

      return {
        status: 'ok',
        command: commandName,
        agentsPath,
        analysis: {
          projectName: analysis.project.packageName,
          readmeHeading: analysis.readmeHeading,
          importantDirectories,
          topLevelEntries: analysis.topLevelEntries,
          projectMarkers: analysis.projectMarkers,
          preservedSectionCount: preservedSections.length,
          validation: analysis.validation,
        },
        validation_surface: 'runtime_tooling',
        message: 'Root AGENTS.md was refreshed from current project signals while preserving the OpenKit workflow overlay contract; workflow lanes were treated as downstream context rather than a prerequisite.',
      };
    },
  };
}
