import test from 'node:test';
import assert from 'node:assert/strict';

import { listBundledSkills } from '../../src/capabilities/skill-catalog.js';
import { STANDARD_CAPABILITY_STATES } from '../../src/capabilities/status.js';

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

test('skill catalog reports missing package-owned skill files honestly', () => {
  const skills = listBundledSkills();

  const presentSkill = skills.find((entry) => entry.name === 'verification-before-completion');
  assert.equal(presentSkill.status, 'available');
  assert.equal(presentSkill.bundled, true);

  const missingSkill = skills.find((entry) => entry.name === 'rust-router');
  assert.equal(missingSkill.status, 'unavailable');
  assert.equal(missingSkill.bundled, false);
  assert.match(missingSkill.limitations.join('\n'), /not currently packaged/i);
});

test('skill catalog uses standard status vocabulary and redacted MCP references only', () => {
  for (const skill of listBundledSkills()) {
    assert.ok(STANDARD_CAPABILITY_STATES.includes(skill.status), `${skill.name} has non-standard status`);
    assert.ok(skill.id.startsWith('skill.'));
    assert.equal(skill.path.includes('~'), false);
    assert.equal(JSON.stringify(skill).includes('API_KEY='), false);
  }
});
