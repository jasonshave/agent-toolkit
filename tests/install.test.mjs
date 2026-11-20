import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, plan, install, uninstall } from '../scripts/install.mjs';
import { repo, skillRoot, fingerprint } from '../scripts/toolkit.mjs';

function fixture(t, args = []) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'jason-toolkit-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  return parseArgs(['install', '--home', home, '--skills', 'prune-tests', ...args]);
}
const quiet = () => {};
test('shared roots deduplicate Codex, Copilot and Grok while Claude receives roles', t => {
  const options = fixture(t);
  const entries = plan(options);
  assert.equal(entries.filter(e => e.kind === 'skill').length, 2);
  install(options, quiet);
  const shared = path.join(options.home, '.agents/skills/prune-tests');
  assert.equal(fingerprint(shared), fingerprint(path.join(skillRoot, 'prune-tests')));
  assert.ok(fs.existsSync(path.join(shared, 'references/roles/test-classifier.md')));
  assert.ok(fs.existsSync(path.join(options.home, '.claude/agents/test-prover.md')));
});
test('conflicts are detected before writing anything, including a later conflict', t => {
  const options = fixture(t);
  const destination = path.join(options.home, '.agents/skills/prune-tests');
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, 'mine'), 'keep me');
  assert.throws(() => install(options, quiet), /Existing or edited content/);
  assert.equal(fs.existsSync(path.join(options.home, '.claude')), false);
  assert.equal(fs.readFileSync(path.join(destination, 'mine'), 'utf8'), 'keep me');
});
test('replacement, repeated upgrades and uninstall preserve original skill and unrelated files', t => {
  const options = fixture(t, ['--replace']);
  const destination = path.join(options.home, '.claude/skills/prune-tests');
  fs.mkdirSync(destination, { recursive: true }); fs.writeFileSync(path.join(destination, 'original'), 'personal');
  const unrelated = path.join(options.home, '.claude/settings.json'); fs.writeFileSync(unrelated, '{"keep":true}');
  const receipt = install(options, quiet), originalBackup = receipt.entries.find(e => e.destination === destination).backup;
  assert.equal(fs.readFileSync(path.join(originalBackup, 'original'), 'utf8'), 'personal');
  options.replace = false;
  install(options, quiet); uninstall(options, quiet);
  assert.equal(fs.readFileSync(path.join(destination, 'original'), 'utf8'), 'personal');
  assert.equal(fs.readFileSync(unrelated, 'utf8'), '{"keep":true}');
});
test('local edits prevent upgrade and uninstall; replacement backs up those edits', t => {
  const options = fixture(t);
  install(options, quiet);
  const destination = path.join(options.home, '.agents/skills/prune-tests');
  fs.writeFileSync(path.join(destination, 'personal.md'), 'edited');
  assert.throws(() => install(options, quiet), /Existing or edited content/);
  assert.throws(() => uninstall(options, quiet), /Locally edited/);
  options.replace = true; install(options, quiet); uninstall(options, quiet);
  assert.equal(fs.readFileSync(path.join(destination, 'personal.md'), 'utf8'), 'edited');
});
test('links point at checkout and uninstall removes only the links', t => {
  const options = fixture(t, ['--mode', 'link']);
  install(options, quiet);
  const destination = path.join(options.home, '.agents/skills/prune-tests');
  assert.equal(fs.realpathSync(destination), fs.realpathSync(path.join(skillRoot, 'prune-tests')));
  install(options, quiet); uninstall(options, quiet);
  assert.equal(fs.existsSync(destination), false);
  assert.ok(fs.existsSync(path.join(skillRoot, 'prune-tests', 'SKILL.md')));
});
test('dry-run makes no filesystem changes', t => {
  const options = fixture(t, ['--dry-run']);
  install(options, quiet);
  assert.deepEqual(fs.readdirSync(options.home), []);
});
test('project scope selects platform-native directories without writing to home', t => {
  const options = fixture(t);
  const project = path.join(options.home, 'project with spaces'); fs.mkdirSync(project);
  const scoped = parseArgs(['--home', options.home, '--scope', 'project', '--project', project, '--agents', 'copilot,grok,codex', '--skills', 'prune-tests']);
  install(scoped, quiet);
  for (const root of ['.github', '.grok', '.agents']) assert.ok(fs.existsSync(path.join(project, root, 'skills/prune-tests/SKILL.md')));
  assert.equal(fs.existsSync(path.join(options.home, '.agents')), false);
});
test('third-party bridge preserves its source and restores an existing Claude copy', t => {
  const options = fixture(t, ['--include-existing', '--replace']);
  const source = path.join(options.home, '.agents/skills/vendor'); fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'vendor original');
  const destination = path.join(options.home, '.claude/skills/vendor'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'SKILL.md'), 'older vendor');
  install(options, quiet);
  assert.equal(fs.realpathSync(destination), fs.realpathSync(source));
  uninstall(options, quiet);
  assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'older vendor');
  assert.equal(fs.readFileSync(path.join(source, 'SKILL.md'), 'utf8'), 'vendor original');
});
test('refuses path escape and symlinked parents without touching external files', t => {
  const options = fixture(t);
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'toolkit-external-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.symlinkSync(external, path.join(options.home, '.agents'), process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => install(options, quiet), /Parent is a symlink/);
  assert.deepEqual(fs.readdirSync(external), []);
  assert.throws(() => plan(parseArgs(['--home', options.home, '--skills-dir', external])), /must be inside/);
});
test('invalid options are rejected before writes', () => {
  for (const args of [['--mode', 'bad'], ['--agents', 'unknown'], ['--scope', 'project'], ['--home'], ['--wat']]) assert.throws(() => parseArgs(args));
});
test('a vanished third-party source still uninstalls its dangling bridge and restores the original', t => {
  const options = fixture(t, ['--include-existing', '--replace']);
  const source = path.join(options.home, '.agents/skills/vendor'); fs.mkdirSync(source, { recursive: true });
  fs.writeFileSync(path.join(source, 'SKILL.md'), 'upstream');
  const destination = path.join(options.home, '.claude/skills/vendor'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'SKILL.md'), 'original');
  install(options, quiet); fs.rmSync(source, { recursive: true }); uninstall(options, quiet);
  assert.equal(fs.readFileSync(path.join(destination, 'SKILL.md'), 'utf8'), 'original');
});
test('uninstall uses the receipt even if its source catalog was removed', t => {
  const options = fixture(t, ['--replace']);
  const destination = path.join(options.home, '.agents/skills/prune-tests'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'mine'), 'original');
  const source = path.join(options.home, 'source-checkout'); fs.mkdirSync(source);
  for (const directory of ['scripts', 'plugins']) fs.cpSync(path.join(repo, directory), path.join(source, directory), { recursive: true });
  function run(...args) {
    const result = spawnSync(process.execPath, [path.join(source, 'scripts/install.mjs'), ...args, '--home', options.home], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  run('install', '--skills', 'prune-tests', '--replace');
  fs.rmSync(path.join(source, 'plugins/jason-toolkit/skills/prune-tests'), { recursive: true });
  const registry = path.join(source, 'scripts/toolkit.mjs');
  const before = fs.readFileSync(registry, 'utf8');
  const after = before.replace(/'prune-tests': \[[^\]]*\],\s*/, '');
  assert.notEqual(before, after);
  fs.writeFileSync(registry, after);
  run('install');
  run('uninstall', '--skills', 'prune-tests');
  assert.equal(fs.readFileSync(path.join(destination, 'mine'), 'utf8'), 'original');
  assert.equal(fs.existsSync(path.join(options.home, '.claude/skills/prune-tests')), false);
  for (const role of ['test-classifier', 'test-prover']) assert.equal(fs.existsSync(path.join(options.home, '.claude/agents', `${role}.md`)), false);
  run('uninstall');
});
test('a late filesystem failure rolls back earlier copies and preserves original files', t => {
  const options = fixture(t, ['--replace']);
  const destination = path.join(options.home, '.claude/skills/prune-tests'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'original'), 'keep');
  fs.writeFileSync(path.join(options.home, '.claude/agents'), 'this is an existing file, not a directory');
  assert.throws(() => install(options, quiet));
  assert.equal(fs.readFileSync(path.join(destination, 'original'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(options.home, '.agents/skills/prune-tests')), false);
});
test('selective uninstall retains a native worker shared by another installed skill', t => {
  const options = fixture(t, ['--agents', 'claude', '--skills', 'orchestrate,parallel-orchestrate']);
  install(options, quiet);
  const worker = path.join(options.home, '.claude/agents/parallel-worker.md');
  const removeOne = parseArgs(['uninstall', '--home', options.home, '--agents', 'claude', '--skills', 'orchestrate']);
  uninstall(removeOne, quiet);
  assert.equal(fs.existsSync(path.join(options.home, '.claude/skills/orchestrate')), false);
  assert.ok(fs.existsSync(path.join(options.home, '.claude/skills/parallel-orchestrate/SKILL.md')));
  assert.ok(fs.existsSync(worker));
  uninstall(parseArgs(['uninstall', '--home', options.home, '--agents', 'claude']), quiet);
  assert.equal(fs.existsSync(worker), false);
});
test('archive-originals removes an unwanted skill without reactivating its prior local copy', t => {
  const options = fixture(t, ['--replace']);
  const destination = path.join(options.home, '.claude/skills/prune-tests'); fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(path.join(destination, 'SKILL.md'), 'old personal version');
  install(options, quiet);
  options.archiveOriginals = true; uninstall(options, quiet);
  assert.equal(fs.existsSync(destination), false);
  const receipt = JSON.parse(fs.readFileSync(path.join(options.home, '.local/share/jason-toolkit/installations.json'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(receipt.archives[0].backup, 'SKILL.md'), 'utf8'), 'old personal version');
});
