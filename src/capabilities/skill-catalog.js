import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listMcpCatalogIds } from './mcp-catalog.js';
import { STANDARD_CAPABILITY_STATES } from './status.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');

export const SKILL_CATALOG_VERSION = 2;
export const SKILL_CATALOG_ENTRY_SCHEMA = 'openkit/skill-catalog-entry@2';
export const SKILL_MATURITY_STATUSES = ['stable', 'preview', 'experimental'];
export const SKILL_SUPPORT_LEVELS = ['maintained', 'best_effort', 'compatibility_only', 'stub'];
export const SKILL_SOURCE_KINDS = ['openkit_authored', 'upstream_imported', 'adapted', 'compatibility', 'stub'];
export const SKILL_TRIGGER_KINDS = ['keyword', 'phrase', 'command', 'file_pattern', 'domain', 'error_code', 'request_pattern'];
export const SKILL_MCP_RELATIONSHIPS = ['primary', 'supporting', 'optional'];
export const SKILL_PACKAGING_SOURCES = ['repo', 'metadata_only', 'external_reference'];

export const SKILL_ROLE_LABELS = [
  'MasterOrchestrator',
  'ProductLead',
  'SolutionLead',
  'FullstackAgent',
  'CodeReviewer',
  'QAAgent',
  'QuickAgent',
  'operator',
  'maintainer',
  'in_session_agent',
  'all',
];

export const SKILL_STAGE_LABELS = [
  'quick_intake',
  'quick_brainstorm',
  'quick_plan',
  'quick_implement',
  'quick_test',
  'quick_done',
  'migration_intake',
  'migration_baseline',
  'migration_strategy',
  'migration_upgrade',
  'migration_code_review',
  'migration_verify',
  'migration_done',
  'full_intake',
  'full_product',
  'full_solution',
  'full_implementation',
  'full_code_review',
  'full_qa',
  'full_done',
  'all',
];

const ALL_MODES = ['quick', 'migration', 'full'];
const STAGES_BY_MODE = {
  quick: ['quick_intake', 'quick_brainstorm', 'quick_plan', 'quick_implement', 'quick_test', 'quick_done'],
  migration: ['migration_intake', 'migration_baseline', 'migration_strategy', 'migration_upgrade', 'migration_code_review', 'migration_verify', 'migration_done'],
  full: ['full_intake', 'full_product', 'full_solution', 'full_implementation', 'full_code_review', 'full_qa', 'full_done'],
};

const DESCRIPTION_BY_NAME = {
  'using-skills': 'Session-start meta-skill that teaches agents how to discover, evaluate, and invoke skills.',
  brainstorming: 'Socratic design refinement process for clarifying intent before writing specs or code.',
  'writing-scope': 'Converts requirements into structured scope packages with concrete acceptance criteria.',
  'writing-solution': 'Converts approved scope into execution-ready solution packages and validation plans.',
  'subagent-driven-development': 'Dispatches focused subagents while preserving OpenKit delivery and review discipline.',
  'test-driven-development': 'Applies a RED-GREEN-REFACTOR loop for implementation slices with working test tooling.',
  'systematic-debugging': 'Uses a four-phase root-cause process for bugs and failures instead of blind guessing.',
  'code-review': 'Guides two-stage review: scope compliance first, then code quality.',
  'verification-before-completion': 'Requires fresh verification evidence before completion, fix, or passing claims.',
  'find-skills': 'Helps users discover installable skills when a requested capability is not bundled or obvious.',
  'codebase-exploration': 'Locates code, traces behavior, and maps repository structure using OpenKit intelligence tools.',
  'deep-research': 'Gathers evidence across repository context, documentation, and external references.',
  refactoring: 'Guides behavior-preserving structure changes with dependency tracing and preview-first edits.',
  'rust-code-navigator': 'Metadata placeholder for Rust LSP-oriented definition/reference navigation guidance.',
  'rust-refactor-helper': 'Metadata placeholder for safe Rust refactoring guidance with LSP analysis.',
  'rust-call-graph': 'Metadata placeholder for Rust call hierarchy and call graph visualization guidance.',
  'rust-symbol-analyzer': 'Metadata placeholder for Rust project structure and symbol analysis guidance.',
  'rust-trait-explorer': 'Metadata placeholder for exploring Rust trait implementations and relationships.',
  'rust-deps-visualizer': 'Metadata placeholder for Rust dependency graph visualization guidance.',
  'building-components': 'Metadata-only frontend component-building guidance for accessible composable APIs.',
  'frontend-ui-ux': 'Guides UI composition, styling, layout quality, and frontend UX polish.',
  'web-design-guidelines': 'Metadata-only web interface review guidance for accessibility and UX best practices.',
  'dev-browser': 'Guides local browser-assisted debugging, preview inspection, and dev-browser workflows.',
  'browser-automation': 'Guides browser automation, page inspection, and UI flows that need a browser runtime.',
  'git-master': 'Guides safe git hygiene, atomic commits, and structured repository operations.',
  'deploy-to-vercel': 'Metadata-only deployment guidance for Vercel previews and production releases.',
  mui: 'Metadata-only Material UI component and theme guidance.',
  'vercel-react-best-practices': 'React and Next.js performance optimization guidance from Vercel Engineering patterns.',
  'vercel-composition-patterns': 'React composition pattern guidance for scalable reusable component APIs.',
  'vercel-react-native-skills': 'React Native and Expo guidance for performant mobile app work.',
  nextjs: 'Metadata-only Next.js App Router guidance for routing, rendering, and data patterns.',
  'next-best-practices': 'Metadata-only Next.js best-practices guidance for conventions, data, metadata, and optimization.',
  'next-cache-components': 'Metadata-only preview guidance for Next.js Cache Components and related cache APIs.',
  'next-upgrade': 'Metadata-only Next.js upgrade guidance for codemods and migration steps.',
  'rust-router': 'Metadata-only router for Rust questions across errors, design, async, ownership, and ecosystem topics.',
  'rust-learner': 'Metadata-only Rust version, crate, changelog, and documentation lookup guidance.',
  'coding-guidelines': 'Metadata-only Rust code style, naming, formatting, and best-practice guidance.',
  'unsafe-checker': 'Metadata-only unsafe Rust, FFI, raw pointer, and soundness review guidance.',
  'm01-ownership': 'Metadata-only Rust ownership, borrowing, and lifetime issue guidance.',
  'm02-resource': 'Metadata-only Rust smart pointer and resource management guidance.',
  'm03-mutability': 'Metadata-only Rust mutability and interior mutability guidance.',
  'm04-zero-cost': 'Metadata-only Rust generics, traits, and zero-cost abstraction guidance.',
  'm05-type-driven': 'Metadata-only Rust type-state, newtype, and compile-time invariant guidance.',
  'm06-error-handling': 'Metadata-only Rust Result, Option, panic, and custom error guidance.',
  'm07-concurrency': 'Metadata-only Rust concurrency, async, Send/Sync, and deadlock guidance.',
  'm09-domain': 'Metadata-only Rust domain modeling and DDD guidance.',
  'm10-performance': 'Metadata-only Rust performance, benchmarking, and profiling guidance.',
  'm11-ecosystem': 'Metadata-only Rust crate integration, Cargo, feature flag, and interop guidance.',
  'm12-lifecycle': 'Metadata-only Rust RAII, Drop, cleanup, and resource lifecycle guidance.',
  'm13-domain-error': 'Metadata-only domain error hierarchy, retry, fallback, and resilience guidance.',
  'm14-mental-model': 'Metadata-only Rust learning, mental model, and misconception guidance.',
  'm15-anti-pattern': 'Metadata-only Rust anti-pattern, pitfall, and idiomatic refactoring guidance.',
};

const DISPLAY_NAME_OVERRIDES = {
  mui: 'Material UI',
  nextjs: 'Next.js',
  'm01-ownership': 'Rust Ownership',
  'm02-resource': 'Rust Resource Management',
  'm03-mutability': 'Rust Mutability',
  'm04-zero-cost': 'Rust Zero-Cost Abstractions',
  'm05-type-driven': 'Rust Type-Driven Design',
  'm06-error-handling': 'Rust Error Handling',
  'm07-concurrency': 'Rust Concurrency',
  'm09-domain': 'Rust Domain Modeling',
  'm10-performance': 'Rust Performance',
  'm11-ecosystem': 'Rust Ecosystem',
  'm12-lifecycle': 'Rust Resource Lifecycle',
  'm13-domain-error': 'Rust Domain Error Handling',
  'm14-mental-model': 'Rust Mental Model',
  'm15-anti-pattern': 'Rust Anti-Patterns',
};

function unique(values = []) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.length > 0))];
}

function displayNameFor(name) {
  return DISPLAY_NAME_OVERRIDES[name] ?? name.split('-').map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ');
}

function stagesForModes(modes = ALL_MODES) {
  const normalizedModes = modes.includes('all') ? ALL_MODES : modes;
  return unique(normalizedModes.flatMap((mode) => STAGES_BY_MODE[mode] ?? []));
}

function trigger(kind, value) {
  return { kind, value };
}

function recommendedMcp(id, relationship = 'supporting', reason = `Supports ${id}-backed workflows for this skill.`) {
  return { id, relationship, reason };
}

function defaultSource(source = {}) {
  return {
    kind: source.kind ?? 'openkit_authored',
    origin: source.origin ?? 'openkit',
    license: source.license ?? null,
    notes: source.notes ?? 'Bundled OpenKit skill metadata.',
  };
}

function createEntry(name, options = {}) {
  const relativePath = options.path ?? `skills/${name}/SKILL.md`;
  const packagingSource = options.packaging?.source ?? (options.metadataOnly ? 'metadata_only' : 'repo');
  const installBundle = options.packaging?.installBundle ?? false;
  const bundledPath = installBundle ? `assets/install-bundle/opencode/skills/${name}/SKILL.md` : null;
  const modes = unique(options.modes ?? ALL_MODES);
  const stages = unique(options.stages ?? stagesForModes(modes));
  const supportLevel = options.support_level ?? (packagingSource === 'metadata_only' ? 'stub' : 'maintained');
  const sourceKind = options.source?.kind ?? (packagingSource === 'metadata_only' ? 'stub' : 'openkit_authored');
  const status = options.status ?? (supportLevel === 'stub' ? 'preview' : 'stable');
  const limitations = [...(options.limitations ?? [])];

  if (packagingSource === 'metadata_only') {
    limitations.push(`No bundled skill file is currently shipped for ${name}; this metadata-only record is discoverable but unavailable until content is added.`);
  }

  return {
    schema: SKILL_CATALOG_ENTRY_SCHEMA,
    catalogVersion: SKILL_CATALOG_VERSION,
    id: `skill.${name}`,
    name,
    displayName: options.displayName ?? displayNameFor(name),
    description: options.description ?? DESCRIPTION_BY_NAME[name] ?? `${displayNameFor(name)} skill metadata.`,
    path: relativePath,
    status,
    tags: unique(options.tags ?? [options.category ?? 'workflow']),
    roles: unique(options.roles ?? ['FullstackAgent']),
    stages,
    triggers: options.triggers ?? [trigger('keyword', name)],
    recommended_mcps: options.recommended_mcps ?? [],
    source: defaultSource({ ...options.source, kind: sourceKind }),
    support_level: supportLevel,
    packaging: {
      source: packagingSource,
      installBundle,
      bundledPath,
      exclusionReason: installBundle ? null : (options.packaging?.exclusionReason ?? (packagingSource === 'metadata_only' ? 'metadata-only catalog entry; no repository skill file is shipped' : null)),
    },
    limitations: unique(limitations),
    docs: {
      source: relativePath,
      governance: 'docs/governance/skill-metadata.md',
      ...(options.docs ?? {}),
    },
  };
}

const WORKFLOW_SKILLS = [
  createEntry('using-skills', {
    tags: ['workflow', 'meta-skill', 'skill-selection'],
    roles: ['all'],
    triggers: [trigger('phrase', 'session start'), trigger('keyword', 'skill'), trigger('phrase', 'how to use skills')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Exposes bundled skill metadata and runtime inventory for skill discovery.')],
    packaging: { installBundle: true },
  }),
  createEntry('brainstorming', {
    tags: ['workflow', 'planning', 'clarification'],
    roles: ['ProductLead', 'SolutionLead', 'QuickAgent', 'in_session_agent'],
    modes: ['quick', 'migration', 'full'],
    stages: ['quick_brainstorm', 'migration_baseline', 'migration_strategy', 'full_product', 'full_solution'],
    triggers: [trigger('keyword', 'brainstorm'), trigger('phrase', 'clarify intent'), trigger('phrase', 'explore options')],
    recommended_mcps: [recommendedMcp('sequential-thinking', 'optional', 'Can support structured multi-step ideation when available.')],
    packaging: { installBundle: true },
  }),
  createEntry('writing-scope', {
    tags: ['workflow', 'scope', 'product'],
    roles: ['ProductLead'],
    modes: ['full'],
    stages: ['full_product'],
    triggers: [trigger('phrase', 'write scope'), trigger('keyword', 'scope package'), trigger('phrase', 'acceptance criteria')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Links Product Lead scope artifacts to workflow state.')],
    packaging: { installBundle: true },
  }),
  createEntry('writing-solution', {
    tags: ['workflow', 'solution', 'planning'],
    roles: ['SolutionLead'],
    modes: ['migration', 'full'],
    stages: ['migration_strategy', 'full_solution'],
    triggers: [trigger('phrase', 'write solution'), trigger('keyword', 'solution package'), trigger('phrase', 'validation plan')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Links solution artifacts and validation evidence to workflow state.')],
    packaging: { installBundle: true },
  }),
  createEntry('subagent-driven-development', {
    tags: ['workflow', 'delegation', 'full-delivery'],
    roles: ['FullstackAgent', 'SolutionLead'],
    modes: ['full'],
    stages: ['full_implementation'],
    triggers: [trigger('keyword', 'subagent'), trigger('phrase', 'parallel task'), trigger('phrase', 'delegate implementation')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Provides task-board and runtime state tools for bounded delegation.')],
    packaging: { installBundle: true },
  }),
  createEntry('test-driven-development', {
    tags: ['workflow', 'testing', 'implementation'],
    roles: ['FullstackAgent'],
    modes: ['full'],
    stages: ['full_implementation'],
    triggers: [trigger('keyword', 'TDD'), trigger('phrase', 'test first'), trigger('phrase', 'red green refactor')],
    recommended_mcps: [recommendedMcp('openkit', 'supporting', 'Records verification evidence after focused test runs.')],
    packaging: { installBundle: true },
  }),
  createEntry('systematic-debugging', {
    tags: ['workflow', 'debugging', 'root-cause'],
    roles: ['FullstackAgent', 'QAAgent', 'QuickAgent'],
    stages: ['quick_implement', 'quick_test', 'migration_upgrade', 'migration_verify', 'full_implementation', 'full_qa'],
    triggers: [trigger('keyword', 'debug'), trigger('phrase', 'root cause'), trigger('phrase', 'test failure')],
    recommended_mcps: [recommendedMcp('openkit', 'supporting', 'Provides graph, syntax, and evidence tools for debugging.'), recommendedMcp('sequential-thinking', 'optional', 'Can support structured debugging reasoning.')],
    packaging: { installBundle: true },
  }),
  createEntry('code-review', {
    tags: ['workflow', 'review', 'quality'],
    roles: ['CodeReviewer', 'FullstackAgent'],
    modes: ['migration', 'full'],
    stages: ['migration_code_review', 'full_code_review'],
    triggers: [trigger('keyword', 'review'), trigger('phrase', 'code quality'), trigger('phrase', 'scope compliance')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Provides rule scan, dependency, and workflow evidence tooling for review.')],
    packaging: { installBundle: true },
  }),
  createEntry('verification-before-completion', {
    tags: ['workflow', 'verification', 'evidence'],
    roles: ['FullstackAgent', 'QAAgent', 'QuickAgent', 'CodeReviewer'],
    stages: ['quick_test', 'migration_upgrade', 'migration_verify', 'full_implementation', 'full_qa'],
    triggers: [trigger('phrase', 'before claiming work is complete'), trigger('keyword', 'verification evidence'), trigger('phrase', 'tests pass')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Records workflow verification evidence through OpenKit runtime tools.')],
    packaging: { installBundle: true },
  }),
  createEntry('find-skills', {
    tags: ['workflow', 'discovery', 'skills'],
    roles: ['all', 'operator', 'maintainer'],
    stages: ['all'],
    triggers: [trigger('phrase', 'find a skill'), trigger('phrase', 'is there a skill'), trigger('phrase', 'how do I do')],
    recommended_mcps: [recommendedMcp('websearch', 'optional', 'Can search external skill ecosystems when configured.')],
    source: { kind: 'adapted', notes: 'Bundled metadata for an adapted skill-discovery workflow.' },
    support_level: 'best_effort',
    packaging: { installBundle: true },
  }),
];

const SOURCE_ONLY_SKILLS = [
  createEntry('codebase-exploration', {
    tags: ['code-intelligence', 'navigation', 'repository'],
    roles: ['MasterOrchestrator', 'SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QuickAgent'],
    stages: ['quick_brainstorm', 'quick_plan', 'migration_baseline', 'migration_strategy', 'migration_upgrade', 'full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'explore'), trigger('phrase', 'locate code'), trigger('phrase', 'trace behavior')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Provides graph, semantic search, syntax, and AST tools.'), recommendedMcp('augment_context_engine', 'optional', 'Optional dependency-aware context engine when locally available.')],
    packaging: { installBundle: true },
  }),
  createEntry('deep-research', {
    tags: ['research', 'documentation', 'evidence'],
    roles: ['ProductLead', 'SolutionLead', 'FullstackAgent', 'QAAgent'],
    stages: ['quick_brainstorm', 'migration_baseline', 'migration_strategy', 'full_product', 'full_solution', 'full_qa'],
    triggers: [trigger('keyword', 'research'), trigger('phrase', 'external references'), trigger('phrase', 'evidence-based')],
    recommended_mcps: [recommendedMcp('context7', 'supporting', 'Retrieves library docs and code examples when configured.'), recommendedMcp('grep_app', 'optional', 'Searches public code examples when configured.'), recommendedMcp('websearch', 'optional', 'Finds current external references when configured.')],
    packaging: { installBundle: true },
  }),
  createEntry('refactoring', {
    tags: ['code-intelligence', 'refactoring', 'safe-editing'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer'],
    stages: ['quick_plan', 'quick_implement', 'migration_strategy', 'migration_upgrade', 'full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'refactor'), trigger('phrase', 'rename symbol'), trigger('phrase', 'change structure')],
    recommended_mcps: [recommendedMcp('openkit', 'primary', 'Provides graph, syntax, and codemod preview/apply tools.'), recommendedMcp('augment_context_engine', 'optional', 'Optional dependency-aware context engine when locally available.')],
    packaging: { installBundle: true },
  }),
  createEntry('frontend-ui-ux', {
    tags: ['frontend', 'ui', 'ux'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent'],
    stages: ['quick_plan', 'quick_implement', 'quick_test', 'full_solution', 'full_implementation', 'full_code_review', 'full_qa'],
    triggers: [trigger('keyword', 'UI'), trigger('keyword', 'UX'), trigger('phrase', 'frontend polish')],
    recommended_mcps: [recommendedMcp('chrome-devtools', 'supporting', 'Supports browser inspection and visual debugging.'), recommendedMcp('playwright', 'optional', 'Supports browser automation and smoke checks.')],
    packaging: { installBundle: true },
  }),
  createEntry('dev-browser', {
    tags: ['browser', 'debugging', 'frontend'],
    roles: ['FullstackAgent', 'QAAgent', 'QuickAgent'],
    stages: ['quick_implement', 'quick_test', 'full_implementation', 'full_qa', 'migration_verify'],
    triggers: [trigger('keyword', 'browser'), trigger('phrase', 'dev browser'), trigger('phrase', 'preview inspection')],
    recommended_mcps: [recommendedMcp('chrome-devtools', 'primary', 'Primary browser debugging and inspection MCP.'), recommendedMcp('playwright', 'optional', 'Useful for browser automation where scripted checks help.')],
    packaging: { installBundle: true },
  }),
  createEntry('browser-automation', {
    tags: ['browser', 'automation', 'testing'],
    roles: ['FullstackAgent', 'QAAgent', 'QuickAgent'],
    stages: ['quick_test', 'full_implementation', 'full_qa', 'migration_verify'],
    triggers: [trigger('phrase', 'browser automation'), trigger('keyword', 'Playwright'), trigger('phrase', 'UI flow')],
    recommended_mcps: [recommendedMcp('playwright', 'primary', 'Primary browser automation MCP.'), recommendedMcp('chrome-devtools', 'supporting', 'Useful for inspection and debugging during browser verification.')],
    packaging: { installBundle: true },
  }),
  createEntry('git-master', {
    tags: ['source-control', 'git', 'safety'],
    roles: ['FullstackAgent', 'CodeReviewer', 'maintainer'],
    stages: ['quick_implement', 'migration_upgrade', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'git'), trigger('keyword', 'commit'), trigger('phrase', 'branch hygiene')],
    recommended_mcps: [recommendedMcp('git', 'optional', 'Policy-gated git MCP may help inspect repository state when explicitly enabled.')],
    status: 'preview',
    source: { kind: 'compatibility', notes: 'Small compatibility skill retained for safe git workflow reminders.' },
    support_level: 'compatibility_only',
    limitations: ['Git MCP support is policy-gated; destructive git operations remain confirmation-gated and are never silently allowed.'],
    packaging: { installBundle: true },
  }),
];

const FRONTEND_AND_PLATFORM_SKILLS = [
  createEntry('building-components', {
    metadataOnly: true,
    tags: ['frontend', 'components', 'accessibility'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer'],
    stages: ['full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('phrase', 'build component'), trigger('keyword', 'accessibility'), trigger('keyword', 'design tokens')],
    recommended_mcps: [recommendedMcp('chrome-devtools', 'optional', 'Can inspect component behavior in browser contexts.'), recommendedMcp('playwright', 'optional', 'Can support component or UI smoke checks.')],
  }),
  createEntry('web-design-guidelines', {
    metadataOnly: true,
    tags: ['frontend', 'accessibility', 'design-review'],
    roles: ['CodeReviewer', 'QAAgent', 'FullstackAgent'],
    stages: ['quick_test', 'full_code_review', 'full_qa'],
    triggers: [trigger('phrase', 'review UI'), trigger('keyword', 'accessibility'), trigger('phrase', 'audit design')],
    recommended_mcps: [recommendedMcp('chrome-devtools', 'supporting', 'Supports page inspection and accessibility-oriented review.'), recommendedMcp('playwright', 'optional', 'Can support browser smoke checks.')],
  }),
  createEntry('deploy-to-vercel', {
    metadataOnly: true,
    tags: ['deployment', 'vercel', 'global-cli'],
    roles: ['FullstackAgent', 'operator'],
    stages: ['quick_implement', 'full_implementation', 'full_qa'],
    triggers: [trigger('keyword', 'deploy'), trigger('keyword', 'Vercel'), trigger('phrase', 'preview deployment')],
    recommended_mcps: [],
  }),
  createEntry('mui', {
    metadataOnly: true,
    tags: ['frontend', 'mui', 'components'],
    roles: ['FullstackAgent', 'CodeReviewer'],
    stages: ['quick_implement', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'MUI'), trigger('keyword', 'Material UI'), trigger('phrase', 'sx prop')],
    recommended_mcps: [recommendedMcp('context7', 'optional', 'Can retrieve current Material UI docs when configured.')],
  }),
  createEntry('vercel-react-best-practices', {
    tags: ['frontend', 'react', 'performance', 'nextjs'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent'],
    stages: ['quick_plan', 'quick_implement', 'quick_test', 'full_solution', 'full_implementation', 'full_code_review', 'full_qa'],
    triggers: [trigger('keyword', 'React'), trigger('keyword', 'Next.js'), trigger('keyword', 'performance')],
    recommended_mcps: [recommendedMcp('chrome-devtools', 'supporting', 'Supports browser performance inspection.'), recommendedMcp('playwright', 'optional', 'Supports UI smoke and interaction checks.'), recommendedMcp('context7', 'optional', 'Can retrieve current React/Next.js docs when configured.')],
    source: { kind: 'adapted', notes: 'Bundled OpenKit adaptation of Vercel Engineering React guidance.' },
    support_level: 'best_effort',
    packaging: { installBundle: true },
  }),
  createEntry('vercel-composition-patterns', {
    tags: ['frontend', 'react', 'composition'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer'],
    stages: ['full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('phrase', 'compound components'), trigger('phrase', 'render props'), trigger('phrase', 'component architecture')],
    recommended_mcps: [recommendedMcp('context7', 'optional', 'Can retrieve current React API references when configured.')],
    source: { kind: 'adapted', notes: 'Bundled OpenKit adaptation of React composition guidance.' },
    support_level: 'best_effort',
    packaging: { installBundle: true },
  }),
  createEntry('vercel-react-native-skills', {
    tags: ['frontend', 'react-native', 'mobile'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer', 'QAAgent'],
    stages: ['quick_plan', 'quick_implement', 'full_solution', 'full_implementation', 'full_code_review', 'full_qa'],
    triggers: [trigger('keyword', 'React Native'), trigger('keyword', 'Expo'), trigger('keyword', 'mobile')],
    recommended_mcps: [recommendedMcp('context7', 'optional', 'Can retrieve current React Native or Expo docs when configured.')],
    source: { kind: 'adapted', notes: 'Bundled OpenKit adaptation of React Native and Expo guidance.' },
    support_level: 'best_effort',
    packaging: { installBundle: true },
  }),
  createEntry('nextjs', {
    metadataOnly: true,
    tags: ['frontend', 'nextjs', 'app-router'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer'],
    stages: ['quick_plan', 'quick_implement', 'full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'Next.js'), trigger('phrase', 'App Router'), trigger('phrase', 'Server Components')],
    recommended_mcps: [recommendedMcp('context7', 'supporting', 'Can retrieve current Next.js documentation when configured.')],
  }),
  createEntry('next-best-practices', {
    metadataOnly: true,
    tags: ['frontend', 'nextjs', 'best-practices'],
    roles: ['SolutionLead', 'FullstackAgent', 'CodeReviewer'],
    stages: ['quick_plan', 'quick_implement', 'full_solution', 'full_implementation', 'full_code_review'],
    triggers: [trigger('keyword', 'Next.js'), trigger('phrase', 'best practices'), trigger('phrase', 'file conventions')],
    recommended_mcps: [recommendedMcp('context7', 'supporting', 'Can retrieve current Next.js docs when configured.')],
  }),
  createEntry('next-cache-components', {
    metadataOnly: true,
    status: 'experimental',
    tags: ['frontend', 'nextjs', 'cache-components'],
    roles: ['SolutionLead', 'FullstackAgent'],
    stages: ['full_solution', 'full_implementation'],
    triggers: [trigger('phrase', 'Cache Components'), trigger('keyword', 'cacheLife'), trigger('keyword', 'cacheTag')],
    recommended_mcps: [recommendedMcp('context7', 'supporting', 'Can retrieve current experimental Next.js docs when configured.')],
    limitations: ['Experimental metadata-only guidance; do not treat as a stable default route.'],
  }),
  createEntry('next-upgrade', {
    metadataOnly: true,
    tags: ['frontend', 'nextjs', 'migration'],
    roles: ['SolutionLead', 'FullstackAgent'],
    stages: ['migration_strategy', 'migration_upgrade'],
    triggers: [trigger('phrase', 'upgrade Next.js'), trigger('keyword', 'codemod'), trigger('keyword', 'migration')],
    recommended_mcps: [recommendedMcp('context7', 'supporting', 'Can retrieve current Next.js migration docs when configured.')],
  }),
];

function rustSkill(name, description, triggers, options = {}) {
  return createEntry(name, {
    metadataOnly: true,
    tags: unique(['rust', ...(options.tags ?? [])]),
    roles: options.roles ?? ['FullstackAgent', 'CodeReviewer', 'in_session_agent'],
    stages: options.stages ?? ['quick_implement', 'full_implementation', 'full_code_review', 'migration_upgrade'],
    triggers,
    description,
    recommended_mcps: options.recommended_mcps ?? [],
    source: { kind: 'stub', notes: 'Rust skill is declared in bundled metadata but the SKILL.md body is not shipped in this repository yet.' },
    support_level: 'stub',
    status: options.status ?? 'preview',
  });
}

const RUST_SKILLS = [
  rustSkill('rust-router', DESCRIPTION_BY_NAME['rust-router'], [trigger('keyword', 'Rust'), trigger('keyword', 'cargo'), trigger('phrase', 'borrow checker')], { roles: ['all', 'in_session_agent'], tags: ['router'] }),
  rustSkill('rust-learner', DESCRIPTION_BY_NAME['rust-learner'], [trigger('phrase', 'Rust version'), trigger('keyword', 'crate'), trigger('keyword', 'docs.rs')], { recommended_mcps: [recommendedMcp('context7', 'optional', 'Can retrieve library docs when configured.'), recommendedMcp('websearch', 'optional', 'Can retrieve current release notes when configured.')] }),
  rustSkill('coding-guidelines', DESCRIPTION_BY_NAME['coding-guidelines'], [trigger('keyword', 'clippy'), trigger('keyword', 'rustfmt'), trigger('phrase', 'naming convention')]),
  rustSkill('unsafe-checker', DESCRIPTION_BY_NAME['unsafe-checker'], [trigger('keyword', 'unsafe'), trigger('keyword', 'FFI'), trigger('keyword', 'UB')]),
  rustSkill('m01-ownership', DESCRIPTION_BY_NAME['m01-ownership'], [trigger('error_code', 'E0382'), trigger('error_code', 'E0597'), trigger('keyword', 'ownership')]),
  rustSkill('m02-resource', DESCRIPTION_BY_NAME['m02-resource'], [trigger('keyword', 'Box'), trigger('keyword', 'Arc'), trigger('keyword', 'RefCell')]),
  rustSkill('m03-mutability', DESCRIPTION_BY_NAME['m03-mutability'], [trigger('error_code', 'E0499'), trigger('error_code', 'E0502'), trigger('keyword', 'mutability')]),
  rustSkill('m04-zero-cost', DESCRIPTION_BY_NAME['m04-zero-cost'], [trigger('error_code', 'E0277'), trigger('error_code', 'E0308'), trigger('keyword', 'trait')]),
  rustSkill('m05-type-driven', DESCRIPTION_BY_NAME['m05-type-driven'], [trigger('phrase', 'type state'), trigger('keyword', 'PhantomData'), trigger('keyword', 'newtype')]),
  rustSkill('m06-error-handling', DESCRIPTION_BY_NAME['m06-error-handling'], [trigger('keyword', 'Result'), trigger('keyword', 'Option'), trigger('keyword', 'panic')]),
  rustSkill('m07-concurrency', DESCRIPTION_BY_NAME['m07-concurrency'], [trigger('keyword', 'async'), trigger('keyword', 'Send'), trigger('keyword', 'Sync')]),
  rustSkill('m09-domain', DESCRIPTION_BY_NAME['m09-domain'], [trigger('phrase', 'domain model'), trigger('keyword', 'DDD'), trigger('keyword', 'aggregate')]),
  rustSkill('m10-performance', DESCRIPTION_BY_NAME['m10-performance'], [trigger('keyword', 'performance'), trigger('keyword', 'benchmark'), trigger('keyword', 'profiling')]),
  rustSkill('m11-ecosystem', DESCRIPTION_BY_NAME['m11-ecosystem'], [trigger('keyword', 'Cargo.toml'), trigger('keyword', 'crate'), trigger('keyword', 'feature flag')], { recommended_mcps: [recommendedMcp('context7', 'optional', 'Can retrieve crate docs when configured.')] }),
  rustSkill('m12-lifecycle', DESCRIPTION_BY_NAME['m12-lifecycle'], [trigger('keyword', 'RAII'), trigger('keyword', 'Drop'), trigger('phrase', 'resource cleanup')]),
  rustSkill('m13-domain-error', DESCRIPTION_BY_NAME['m13-domain-error'], [trigger('phrase', 'domain error'), trigger('keyword', 'retry'), trigger('keyword', 'fallback')]),
  rustSkill('m14-mental-model', DESCRIPTION_BY_NAME['m14-mental-model'], [trigger('phrase', 'mental model'), trigger('phrase', 'help me understand'), trigger('keyword', 'ELI5')]),
  rustSkill('m15-anti-pattern', DESCRIPTION_BY_NAME['m15-anti-pattern'], [trigger('keyword', 'anti-pattern'), trigger('phrase', 'code smell'), trigger('phrase', 'idiomatic way')]),
  rustSkill('rust-code-navigator', DESCRIPTION_BY_NAME['rust-code-navigator'], [trigger('command', '/navigate'), trigger('phrase', 'go to definition'), trigger('phrase', 'find references')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit graph/LSP tools provide navigation support.')] }),
  rustSkill('rust-refactor-helper', DESCRIPTION_BY_NAME['rust-refactor-helper'], [trigger('command', '/refactor'), trigger('phrase', 'rename symbol'), trigger('phrase', 'extract function')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit graph rename and codemod tools support refactoring.')] }),
  rustSkill('rust-call-graph', DESCRIPTION_BY_NAME['rust-call-graph'], [trigger('command', '/call-graph'), trigger('phrase', 'who calls'), trigger('phrase', 'call hierarchy')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit graph call hierarchy tools support call tracing.')] }),
  rustSkill('rust-symbol-analyzer', DESCRIPTION_BY_NAME['rust-symbol-analyzer'], [trigger('command', '/symbols'), trigger('phrase', 'project structure'), trigger('phrase', 'list structs')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit symbol tools support project symbol maps.')] }),
  rustSkill('rust-trait-explorer', DESCRIPTION_BY_NAME['rust-trait-explorer'], [trigger('command', '/trait-impl'), trigger('phrase', 'find implementations'), trigger('phrase', 'who implements')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit graph tools support reference exploration.')] }),
  rustSkill('rust-deps-visualizer', DESCRIPTION_BY_NAME['rust-deps-visualizer'], [trigger('command', '/deps-viz'), trigger('phrase', 'dependency graph'), trigger('phrase', 'visualize deps')], { recommended_mcps: [recommendedMcp('openkit', 'primary', 'OpenKit dependency tools support graph traversal.')] }),
];

const SKILL_CATALOG = [
  ...WORKFLOW_SKILLS,
  ...SOURCE_ONLY_SKILLS,
  ...FRONTEND_AND_PLATFORM_SKILLS,
  ...RUST_SKILLS,
];

function clone(value) {
  return structuredClone(value);
}

function exists(relativePath) {
  return fs.existsSync(path.join(PACKAGE_ROOT, relativePath));
}

function capabilityStateFor(entry) {
  if (entry.packaging.source === 'metadata_only' || !exists(entry.path)) {
    return 'unavailable';
  }
  if (entry.support_level === 'compatibility_only') {
    return 'compatibility_only';
  }
  if (entry.status === 'preview' || entry.status === 'experimental') {
    return 'preview';
  }
  return 'available';
}

function modesForStages(stages = []) {
  if (stages.includes('all')) {
    return ALL_MODES;
  }
  return unique(stages.map((stage) => stage.split('_')[0]).filter((mode) => ALL_MODES.includes(mode)));
}

function decorateSkill(entry) {
  const sourceExists = exists(entry.path);
  const bundleExists = Boolean(entry.packaging.bundledPath && exists(entry.packaging.bundledPath));
  const bundled = sourceExists && (entry.packaging.installBundle ? bundleExists : true);
  const capabilityState = capabilityStateFor(entry);
  const limitations = [...entry.limitations];

  if (!sourceExists && entry.packaging.source !== 'metadata_only') {
    limitations.push(`Skill file ${entry.path} is missing; catalog entry is discoverable but unavailable.`);
  }
  if (entry.packaging.installBundle && !bundleExists) {
    limitations.push(`Install-bundle skill file ${entry.packaging.bundledPath} is missing until sync runs.`);
  }

  const mcpRefs = entry.recommended_mcps.filter((ref) => ref.relationship !== 'optional').map((ref) => ref.id);
  const optionalMcpRefs = entry.recommended_mcps.filter((ref) => ref.relationship === 'optional').map((ref) => ref.id);

  return {
    ...clone(entry),
    bundled,
    sourceExists,
    bundleExists,
    capabilityState,
    validationSurface: 'runtime_tooling',
    limitations: unique(limitations),

    // v1 compatibility aliases derived from the canonical v2 contract.
    category: entry.tags[0] ?? 'workflow',
    lifecycle: entry.status,
    triggerHints: entry.triggers.map((triggerEntry) => triggerEntry.value),
    roleHints: [...entry.roles],
    modeHints: modesForStages(entry.stages),
    mcpRefs,
    optionalMcpRefs,
  };
}

export function listCanonicalSkillMetadata() {
  return SKILL_CATALOG.map(clone);
}

export function listBundledSkills() {
  return listCanonicalSkillMetadata().map((entry) => decorateSkill(entry));
}

export function getBundledSkill(nameOrId) {
  const normalized = String(nameOrId ?? '').replace(/^skill\./, '');
  return listBundledSkills().find((entry) => entry.name === normalized || entry.id === nameOrId) ?? null;
}

export function listInstallBundleSkillMetadata() {
  return listCanonicalSkillMetadata()
    .filter((entry) => entry.packaging.installBundle === true)
    .map((entry) => decorateSkill(entry));
}

function validationError(entry, field, message, allowedValues = null, actualValue = entry?.[field]) {
  return {
    skillId: entry?.id ?? null,
    skillName: entry?.name ?? null,
    field,
    actualValue,
    allowedValues,
    message,
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasSecretLikeValue(value) {
  return /API_KEY=|TOKEN=|SECRET=|sk-[A-Za-z0-9_-]{8,}/.test(String(value ?? ''));
}

function validateEntry(entry, { knownMcpIds }) {
  const errors = [];
  const requiredFields = ['schema', 'catalogVersion', 'id', 'name', 'displayName', 'description', 'path', 'status', 'tags', 'roles', 'stages', 'triggers', 'recommended_mcps', 'source', 'support_level', 'packaging', 'limitations', 'docs'];

  for (const field of requiredFields) {
    if (!Object.hasOwn(entry ?? {}, field)) {
      errors.push(validationError(entry, field, `Skill catalog entry is missing required field '${field}'.`));
    }
  }

  if (!isPlainObject(entry)) {
    return [validationError(entry, 'entry', 'Skill catalog entry must be an object.')];
  }
  if (entry.schema !== SKILL_CATALOG_ENTRY_SCHEMA) {
    errors.push(validationError(entry, 'schema', `Skill schema must be ${SKILL_CATALOG_ENTRY_SCHEMA}.`, [SKILL_CATALOG_ENTRY_SCHEMA]));
  }
  if (entry.catalogVersion !== SKILL_CATALOG_VERSION) {
    errors.push(validationError(entry, 'catalogVersion', `Skill catalogVersion must be ${SKILL_CATALOG_VERSION}.`, [SKILL_CATALOG_VERSION]));
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.name ?? '')) {
    errors.push(validationError(entry, 'name', 'Skill name must be a normalized kebab-case slug.'));
  }
  if (entry.id !== `skill.${entry.name}`) {
    errors.push(validationError(entry, 'id', 'Skill id must equal skill.${name}.'));
  }
  if (typeof entry.description !== 'string' || entry.description.trim().length === 0) {
    errors.push(validationError(entry, 'description', 'Skill description must be non-empty.'));
  }
  if (path.isAbsolute(entry.path ?? '') || String(entry.path ?? '').includes('..') || String(entry.path ?? '').includes('~')) {
    errors.push(validationError(entry, 'path', 'Skill path must be repo-relative and must not contain absolute, parent, or home references.'));
  }
  if (entry.packaging?.source === 'repo' && entry.path !== `skills/${entry.name}/SKILL.md`) {
    errors.push(validationError(entry, 'path', 'Repo-backed skill path must match skills/<name>/SKILL.md.'));
  }
  if (!SKILL_MATURITY_STATUSES.includes(entry.status)) {
    errors.push(validationError(entry, 'status', `Unsupported skill maturity status '${entry.status}'.`, SKILL_MATURITY_STATUSES));
  }
  if ((entry.source?.kind === 'stub' || entry.packaging?.source === 'metadata_only' || entry.support_level === 'stub') && entry.status === 'stable') {
    errors.push(validationError(entry, 'status', 'Stub, metadata-only, and stub-support records must not be labeled stable.', ['preview', 'experimental']));
  }
  if (!Array.isArray(entry.tags) || entry.tags.some((tag) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(tag))) {
    errors.push(validationError(entry, 'tags', 'Skill tags must be normalized lower-kebab labels.'));
  }
  if (!Array.isArray(entry.roles) || entry.roles.some((role) => !SKILL_ROLE_LABELS.includes(role))) {
    errors.push(validationError(entry, 'roles', 'Skill roles must use canonical OpenKit role/audience labels.', SKILL_ROLE_LABELS));
  }
  if (!Array.isArray(entry.stages) || entry.stages.some((stage) => !SKILL_STAGE_LABELS.includes(stage))) {
    errors.push(validationError(entry, 'stages', 'Skill stages must use canonical workflow stage labels or metadata wildcard all.', SKILL_STAGE_LABELS));
  }
  if (!Array.isArray(entry.triggers) || entry.triggers.some((triggerEntry) => !isPlainObject(triggerEntry) || !SKILL_TRIGGER_KINDS.includes(triggerEntry.kind) || typeof triggerEntry.value !== 'string' || triggerEntry.value.trim().length === 0)) {
    errors.push(validationError(entry, 'triggers', 'Skill triggers must be structured objects with supported kind and non-empty value.', SKILL_TRIGGER_KINDS));
  }
  if (!Array.isArray(entry.recommended_mcps)) {
    errors.push(validationError(entry, 'recommended_mcps', 'Skill recommended_mcps must be an array.'));
  } else {
    for (const ref of entry.recommended_mcps) {
      if (!isPlainObject(ref) || typeof ref.id !== 'string' || !SKILL_MCP_RELATIONSHIPS.includes(ref.relationship)) {
        errors.push(validationError(entry, 'recommended_mcps', 'Recommended MCP entries must include id and supported relationship.', SKILL_MCP_RELATIONSHIPS));
        continue;
      }
      const isCustomPlaceholder = ref.id.startsWith('custom:') || ref.id.startsWith('custom-');
      if (!knownMcpIds.has(ref.id) && !isCustomPlaceholder) {
        errors.push(validationError(entry, 'recommended_mcps', `Unknown recommended MCP id '${ref.id}'.`, [...knownMcpIds, 'custom:<id>'], ref.id));
      }
      if (hasSecretLikeValue(JSON.stringify(ref))) {
        errors.push(validationError(entry, 'recommended_mcps', 'Recommended MCP metadata must not contain raw secrets or user-specific config.'));
      }
    }
  }
  if (!isPlainObject(entry.source) || !SKILL_SOURCE_KINDS.includes(entry.source.kind)) {
    errors.push(validationError(entry, 'source.kind', 'Skill provenance source.kind is unsupported.', SKILL_SOURCE_KINDS, entry.source?.kind));
  }
  if (!SKILL_SUPPORT_LEVELS.includes(entry.support_level)) {
    errors.push(validationError(entry, 'support_level', 'Skill support_level is unsupported.', SKILL_SUPPORT_LEVELS));
  }
  if (!isPlainObject(entry.packaging) || !SKILL_PACKAGING_SOURCES.includes(entry.packaging.source)) {
    errors.push(validationError(entry, 'packaging.source', 'Skill packaging.source is unsupported.', SKILL_PACKAGING_SOURCES, entry.packaging?.source));
  }
  if (entry.packaging?.source === 'metadata_only' && entry.packaging?.installBundle === true) {
    errors.push(validationError(entry, 'packaging.installBundle', 'Metadata-only skill records must not be install-bundled.'));
  }
  if (entry.packaging?.installBundle === true && typeof entry.packaging.bundledPath !== 'string') {
    errors.push(validationError(entry, 'packaging.bundledPath', 'Install-bundled skill records require bundledPath.'));
  }
  if (!Array.isArray(entry.limitations)) {
    errors.push(validationError(entry, 'limitations', 'Skill limitations must be an array.'));
  }
  if (!isPlainObject(entry.docs) || typeof entry.docs.source !== 'string' || typeof entry.docs.governance !== 'string') {
    errors.push(validationError(entry, 'docs', 'Skill docs must include source and governance refs.'));
  }

  return errors;
}

export function validateSkillCatalogEntries(entries = listCanonicalSkillMetadata()) {
  const knownMcpIds = new Set(listMcpCatalogIds());
  const errors = [];
  const byId = new Set();
  const byName = new Set();

  for (const entry of entries) {
    if (entry?.id) {
      if (byId.has(entry.id)) {
        errors.push(validationError(entry, 'id', `Duplicate skill id '${entry.id}'.`));
      }
      byId.add(entry.id);
    }
    if (entry?.name) {
      if (byName.has(entry.name)) {
        errors.push(validationError(entry, 'name', `Duplicate skill name '${entry.name}'.`));
      }
      byName.add(entry.name);
    }
    errors.push(...validateEntry(entry, { knownMcpIds }));
  }

  return { valid: errors.length === 0, errors };
}

export function assertSkillCatalogEntry(entry) {
  const validation = validateSkillCatalogEntries([entry]);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`Skill catalog entry '${first.skillName ?? first.skillId ?? 'unknown'}' invalid field '${first.field}': ${first.message}`);
  }
  return entry;
}

export function assertSkillCatalogValid(entries = listCanonicalSkillMetadata()) {
  const validation = validateSkillCatalogEntries(entries);
  if (!validation.valid) {
    const first = validation.errors[0];
    throw new Error(`Skill catalog validation failed for '${first.skillName ?? first.skillId ?? 'unknown'}' field '${first.field}': ${first.message}`);
  }
  return entries;
}

export function summarizeSkillCatalog(entries = listBundledSkills()) {
  const summary = {
    total: 0,
    maturity: Object.fromEntries(SKILL_MATURITY_STATUSES.map((status) => [status, 0])),
    capabilityStates: Object.fromEntries(STANDARD_CAPABILITY_STATES.map((state) => [state, 0])),
    supportLevels: Object.fromEntries(SKILL_SUPPORT_LEVELS.map((level) => [level, 0])),
  };

  for (const entry of entries) {
    summary.total += 1;
    summary.maturity[entry.status] = (summary.maturity[entry.status] ?? 0) + 1;
    summary.capabilityStates[entry.capabilityState] = (summary.capabilityStates[entry.capabilityState] ?? 0) + 1;
    summary.supportLevels[entry.support_level] = (summary.supportLevels[entry.support_level] ?? 0) + 1;
  }

  return summary;
}
