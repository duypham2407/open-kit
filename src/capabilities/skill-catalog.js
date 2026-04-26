import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '../..');

function skill(name, options = {}) {
  const relativePath = options.path ?? `skills/${name}/SKILL.md`;
  return {
    schema: 'openkit/skill-catalog-entry@1',
    id: `skill.${name}`,
    name,
    path: relativePath,
    category: options.category ?? 'workflow',
    lifecycle: options.lifecycle ?? 'stable',
    triggerHints: options.triggerHints ?? [],
    roleHints: options.roleHints ?? ['FullstackAgent'],
    modeHints: options.modeHints ?? ['quick', 'migration', 'full'],
    mcpRefs: options.mcpRefs ?? [],
    optionalMcpRefs: options.optionalMcpRefs ?? [],
    limitations: options.limitations ?? [],
    docs: {
      source: relativePath,
    },
  };
}

const SKILL_CATALOG = [
  skill('using-skills', { category: 'workflow', roleHints: ['all'] }),
  skill('brainstorming', { category: 'workflow', roleHints: ['ProductLead', 'SolutionLead'], modeHints: ['migration', 'full'] }),
  skill('writing-scope', { category: 'workflow', roleHints: ['ProductLead'], modeHints: ['full'] }),
  skill('writing-solution', { category: 'workflow', roleHints: ['SolutionLead'], modeHints: ['migration', 'full'] }),
  skill('subagent-driven-development', { category: 'workflow', roleHints: ['FullstackAgent'], modeHints: ['full'] }),
  skill('test-driven-development', { category: 'workflow', roleHints: ['FullstackAgent'], modeHints: ['full'] }),
  skill('systematic-debugging', { category: 'workflow', roleHints: ['FullstackAgent', 'QAAgent'] }),
  skill('code-review', { category: 'workflow', roleHints: ['CodeReviewer'], modeHints: ['migration', 'full'] }),
  skill('verification-before-completion', { category: 'workflow', roleHints: ['FullstackAgent', 'QAAgent'] }),
  skill('find-skills', { category: 'workflow', roleHints: ['all'] }),
  skill('codebase-exploration', { category: 'code-intelligence', mcpRefs: ['openkit'], optionalMcpRefs: ['augment_context_engine'] }),
  skill('deep-research', { category: 'research', optionalMcpRefs: ['context7', 'grep_app', 'websearch'] }),
  skill('refactoring', { category: 'code-intelligence', mcpRefs: ['openkit'], optionalMcpRefs: ['augment_context_engine'] }),
  skill('rust-code-navigator', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('rust-refactor-helper', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('rust-call-graph', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('rust-symbol-analyzer', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('rust-trait-explorer', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('rust-deps-visualizer', { category: 'code-intelligence', lifecycle: 'preview', mcpRefs: ['openkit'] }),
  skill('building-components', { category: 'frontend', optionalMcpRefs: ['chrome-devtools', 'playwright'] }),
  skill('frontend-ui-ux', { category: 'frontend', optionalMcpRefs: ['chrome-devtools', 'playwright'] }),
  skill('web-design-guidelines', { category: 'frontend', optionalMcpRefs: ['chrome-devtools', 'playwright'] }),
  skill('dev-browser', { category: 'browser', mcpRefs: ['chrome-devtools'], optionalMcpRefs: ['playwright'] }),
  skill('browser-automation', { category: 'browser', mcpRefs: ['playwright'], optionalMcpRefs: ['chrome-devtools'] }),
  skill('deploy-to-vercel', { category: 'deployment' }),
  skill('mui', { category: 'frontend' }),
  skill('vercel-react-best-practices', { category: 'frontend', optionalMcpRefs: ['chrome-devtools', 'playwright', 'context7'] }),
  skill('vercel-composition-patterns', { category: 'frontend' }),
  skill('vercel-react-native-skills', { category: 'frontend' }),
  skill('nextjs', { category: 'frontend', optionalMcpRefs: ['context7'] }),
  skill('next-best-practices', { category: 'frontend', optionalMcpRefs: ['context7'] }),
  skill('next-cache-components', { category: 'frontend', lifecycle: 'preview', optionalMcpRefs: ['context7'] }),
  skill('next-upgrade', { category: 'frontend', optionalMcpRefs: ['context7'] }),
  skill('rust-router', { category: 'rust' }),
  skill('rust-learner', { category: 'rust', optionalMcpRefs: ['context7', 'websearch'] }),
  skill('coding-guidelines', { category: 'rust' }),
  skill('unsafe-checker', { category: 'rust' }),
  skill('m01-ownership', { category: 'rust' }),
  skill('m02-resource', { category: 'rust' }),
  skill('m03-mutability', { category: 'rust' }),
  skill('m04-zero-cost', { category: 'rust' }),
  skill('m05-type-driven', { category: 'rust' }),
  skill('m06-error-handling', { category: 'rust' }),
  skill('m07-concurrency', { category: 'rust' }),
  skill('m09-domain', { category: 'rust' }),
  skill('m10-performance', { category: 'rust' }),
  skill('m11-ecosystem', { category: 'rust', optionalMcpRefs: ['context7'] }),
  skill('m12-lifecycle', { category: 'rust' }),
  skill('m13-domain-error', { category: 'rust' }),
  skill('m14-mental-model', { category: 'rust' }),
  skill('m15-anti-pattern', { category: 'rust' }),
];

function decorateSkill(entry) {
  const bundled = fs.existsSync(path.join(PACKAGE_ROOT, entry.path));
  const lifecycleStatus = entry.lifecycle === 'preview' || entry.lifecycle === 'experimental' ? 'preview' : 'available';
  return {
    ...entry,
    bundled,
    status: bundled ? lifecycleStatus : 'unavailable',
    limitations: bundled
      ? [...entry.limitations]
      : [...entry.limitations, `Skill file ${entry.path} is not currently packaged; catalog entry is discoverable but unavailable.`],
  };
}

export function listBundledSkills() {
  return SKILL_CATALOG.map((entry) => decorateSkill(structuredClone(entry)));
}

export function getBundledSkill(nameOrId) {
  const normalized = String(nameOrId ?? '').replace(/^skill\./, '');
  return listBundledSkills().find((entry) => entry.name === normalized) ?? null;
}
