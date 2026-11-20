import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, plugin, skills, skillRoot, parseFrontmatter } from '../scripts/toolkit.mjs';
import { install, parseArgs, uninstall } from '../scripts/install.mjs';

test('every skill survives a standalone copy with its runtime and worker roles', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'toolkit-package-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  install(parseArgs(['--home', home, '--agents', 'codex']), () => {});
  for (const name of skills()) {
    const root = path.join(home, '.agents/skills', name);
    assert.ok(fs.existsSync(path.join(root, 'SKILL.md')));
    assert.ok(fs.existsSync(path.join(root, 'references/host-runtime.md')));
    for (const match of fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8').matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(fs.existsSync(path.join(root, match[1])), `${name}: ${match[1]}`);
  }
});
test('legacy migration removes duplicate manifests, retains resource entrypoints and is reversible', t => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'toolkit-legacy-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const legacy = path.join(home, '.codex/skills/prune-tests'); fs.mkdirSync(legacy, { recursive: true });
  fs.writeFileSync(path.join(legacy, 'SKILL.md'), 'original manifest');
  const options = parseArgs(['--home', home, '--agents', 'codex', '--skills', 'prune-tests', '--replace', '--migrate-legacy']);
  install(options, () => {}); install(options, () => {});
  assert.equal(fs.existsSync(path.join(legacy, 'SKILL.md')), false);
  assert.equal(fs.realpathSync(path.join(legacy, 'references/rubric.md')), fs.realpathSync(path.join(skillRoot, 'prune-tests/references/rubric.md')));
  uninstall(options, () => {});
  assert.equal(fs.readFileSync(path.join(legacy, 'SKILL.md'), 'utf8'), 'original manifest');
});
test('both marketplace catalogs resolve the same self-contained plugin', () => {
  for (const file of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
    const manifest = JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
    const entry = manifest.plugins.find(p => p.name === 'jason-toolkit');
    assert.equal(path.resolve(repo, typeof entry.source === 'string' ? entry.source : entry.source.path), plugin);
  }
  const { fields } = parseFrontmatter(path.join(skillRoot, 'orchestrate/SKILL.md'));
  for (const option of ['--one-pr', '--per-worker-pr', '--help']) {
    assert.ok(fields['argument-hint']?.includes(option), `Native argument hint missing ${option}`);
  }
});
test('all JavaScript helper and installer code parses with the installed Node runtime', () => {
  const result = spawnSync(process.execPath, ['scripts/validate.mjs'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});
