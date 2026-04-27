import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SKILL_CATALOG_VERSION,
  SKILL_MATURITY_STATUSES,
  SKILL_SUPPORT_LEVELS,
  getBundledSkill,
  listBundledSkills,
  listCanonicalSkillMetadata,
  validateSkillCatalogEntries,
} from '../../src/capabilities/skill-catalog.js';
import { STANDARD_CAPABILITY_STATES, VALIDATION_SURFACES } from '../../src/capabilities/status.js';

const REQUIRED_SKILLS = [
  'brainstorming',
  'writing-scope',
  'writing-solution',
  'subagent-driven-development',
  'test-driven-development',
  'systematic-debugging',
  'code-review',
  'verification-before-completion',
  'codebase-exploration',
  'deep-research',
  'refactoring',
  'frontend-ui-ux',
  'dev-browser',
  'browser-automation',
  'git-master',
  'building-components',
  'web-design-guidelines',
  'deploy-to-vercel',
  'mui',
  'vercel-react-best-practices',
  'vercel-composition-patterns',
  'vercel-react-native-skills',
  'nextjs',
  'next-best-practices',
  'next-cache-components',
  'next-upgrade',
  'rust-router',
  'rust-learner',
  'coding-guidelines',
  'unsafe-checker',
  'm01-ownership',
  'm03-mutability',
  'm04-zero-cost',
  'm06-error-handling',
  'm07-concurrency',
  'm10-performance',
  'm11-ecosystem',
  'm15-anti-pattern',
];

const REQUIRED_V2_FIELDS = [
  'schema',
  'catalogVersion',
  'id',
  'name',
  'displayName',
  'description',
  'path',
  'status',
  'tags',
  'roles',
  'stages',
  'triggers',
  'recommended_mcps',
  'source',
  'support_level',
  'packaging',
  'limitations',
  'docs',
];

test('skill catalog lists required OpenKit workflow, frontend, Next, React Native, and Rust skills', () => {
  const skills = listBundledSkills();
  const byName = new Map(skills.map((entry) => [entry.name, entry]));

  for (const skillName of REQUIRED_SKILLS) {
    assert.ok(byName.has(skillName), `expected skill catalog to include ${skillName}`);
  }

  assert.ok(skills.some((entry) => entry.category === 'workflow'));
  assert.ok(skills.some((entry) => entry.category === 'frontend'));
  assert.ok(skills.some((entry) => entry.category === 'rust'));
});

test('canonical skill catalog exposes the v2 governed metadata contract', () => {
  const validation = validateSkillCatalogEntries();

  assert.equal(SKILL_CATALOG_VERSION, 2);
  assert.deepEqual(SKILL_MATURITY_STATUSES, ['stable', 'preview', 'experimental']);
  assert.ok(SKILL_SUPPORT_LEVELS.includes('maintained'));
  assert.ok(SKILL_SUPPORT_LEVELS.includes('stub'));
  assert.ok(VALIDATION_SURFACES.includes('package'));
  assert.deepEqual(validation.errors, []);

  for (const skill of listCanonicalSkillMetadata()) {
    for (const field of REQUIRED_V2_FIELDS) {
      assert.ok(Object.hasOwn(skill, field), `${skill.name} missing ${field}`);
    }

    assert.equal(skill.schema, 'openkit/skill-catalog-entry@2');
    assert.equal(skill.catalogVersion, SKILL_CATALOG_VERSION);
    assert.equal(skill.id, `skill.${skill.name}`);
    assert.ok(SKILL_MATURITY_STATUSES.includes(skill.status), `${skill.name} has invalid maturity status`);
    assert.ok(SKILL_SUPPORT_LEVELS.includes(skill.support_level), `${skill.name} has invalid support level`);
    assert.ok(Array.isArray(skill.roles), `${skill.name} roles must be an array`);
    assert.ok(Array.isArray(skill.stages), `${skill.name} stages must be an array`);
    assert.ok(Array.isArray(skill.triggers), `${skill.name} triggers must be an array`);
    assert.ok(Array.isArray(skill.recommended_mcps), `${skill.name} recommended_mcps must be an array`);
  }
});

test('skill catalog keeps skill maturity status separate from runtime capability state', () => {
  const skills = listBundledSkills();

  const presentSkill = skills.find((entry) => entry.name === 'verification-before-completion');
  assert.equal(presentSkill.status, 'stable');
  assert.equal(presentSkill.capabilityState, 'available');
  assert.equal(presentSkill.bundled, true);
  assert.equal(presentSkill.support_level, 'maintained');

  const missingSkill = skills.find((entry) => entry.name === 'rust-router');
  assert.ok(['preview', 'experimental'].includes(missingSkill.status));
  assert.equal(missingSkill.capabilityState, 'unavailable');
  assert.equal(missingSkill.bundled, false);
  assert.equal(missingSkill.packaging.source, 'metadata_only');
  assert.match(missingSkill.limitations.join('\n'), /no bundled skill file/i);
});

test('skill catalog uses standard capability-state vocabulary and redacted MCP references only', () => {
  for (const skill of listBundledSkills()) {
    assert.ok(SKILL_MATURITY_STATUSES.includes(skill.status), `${skill.name} has non-standard skill maturity status`);
    assert.ok(STANDARD_CAPABILITY_STATES.includes(skill.capabilityState), `${skill.name} has non-standard capability state`);
    assert.ok(skill.id.startsWith('skill.'));
    assert.equal(skill.path.includes('~'), false);
    assert.equal(JSON.stringify(skill).includes('API_KEY='), false);
  }
});

test('validator rejects unsupported maturity status and stable stub records', () => {
  const [base] = listCanonicalSkillMetadata();

  assert.deepEqual(
    validateSkillCatalogEntries([{ ...base, status: 'available' }]).errors.map((error) => error.field),
    ['status']
  );

  const stableStub = {
    ...base,
    id: 'skill.example-stub',
    name: 'example-stub',
    path: 'skills/example-stub/SKILL.md',
    status: 'stable',
    source: { ...base.source, kind: 'stub' },
    support_level: 'stub',
    packaging: { source: 'metadata_only', installBundle: false, bundledPath: null, exclusionReason: 'metadata-only fixture' },
  };

  assert.ok(
    validateSkillCatalogEntries([stableStub]).errors.some((error) => error.field === 'status'),
    'stable metadata-only/stub records must be rejected'
  );
});

test('getBundledSkill returns v2 metadata with compatibility aliases', () => {
  const skill = getBundledSkill('verification-before-completion');

  assert.equal(skill.catalogVersion, 2);
  assert.equal(skill.status, 'stable');
  assert.equal(skill.capabilityState, 'available');
  assert.deepEqual(skill.roleHints, skill.roles);
  assert.deepEqual(skill.triggerHints, skill.triggers.map((trigger) => trigger.value));
});
