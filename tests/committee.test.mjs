import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { launchArgs, repositoryState } from '../plugins/jason-toolkit/skills/committee/run-claude-member.mjs';
import { plugin } from '../scripts/toolkit.mjs';

test('Claude fresh and resumed sessions carry the same real tool and customization restrictions', () => {
  for (const session of ['-', 'fake-session']) {
    const args = launchArgs({ schema: '{}', session });
    assert.ok(args.includes('--restricted')); assert.ok(args.includes('--safe-mode'));
    assert.ok(args.includes('--strict-mcp-config'));
    assert.equal(args[args.indexOf('--tools') + 1], 'Read,Grep,Glob');
    assert.equal(args[args.indexOf('--permission-mode') + 1], 'dontAsk');
    assert.equal(args.includes('--resume'), session !== '-');
    assert.equal(args.some(a => /bypassPermissions|dangerously/.test(a)), false);
  }
});
test('review fingerprint detects file edits, deletion, additions and commits while ignoring unrelated ignored files', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'committee-fingerprint-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  function git(...args) { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); assert.equal(result.status, 0, result.stderr); }
  git('init', '-q'); fs.writeFileSync(path.join(root, 'readme'), 'original'); fs.writeFileSync(path.join(root, '.gitignore'), 'ignored\n');
  git('add', 'readme', '.gitignore'); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '-qm', 'fixture');
  const baseline = repositoryState(root);
  fs.writeFileSync(path.join(root, 'ignored'), 'ignored content'); assert.equal(repositoryState(root), baseline);
  fs.writeFileSync(path.join(root, 'readme'), 'changed'); assert.notEqual(repositoryState(root), baseline);
  fs.writeFileSync(path.join(root, 'readme'), 'original'); assert.equal(repositoryState(root), baseline);
  fs.unlinkSync(path.join(root, 'readme')); assert.notEqual(repositoryState(root), baseline);
  fs.writeFileSync(path.join(root, 'readme'), 'original'); fs.writeFileSync(path.join(root, 'new'), 'new'); assert.notEqual(repositoryState(root), baseline);
  fs.unlinkSync(path.join(root, 'new')); git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-qm', 'changed head');
  assert.notEqual(repositoryState(root), baseline);
});
test('member answer extraction validates real schema fields and refuses malformed answers', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'committee-answer-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const input = path.join(root, 'answer'), output = path.join(root, 'parsed.json');
  const answer = { seat: 'A', verdict: 'pass', summary: 'Checked', scores: [{ criterion: 'Correctness', score: 8, why: 'Verified' }], blockers: [], responses: [], position_changes: [], open_questions: [] };
  function parse(value) { fs.writeFileSync(input, value); return spawnSync(process.execPath, [path.join(plugin, 'skills/committee/extract-answer.js'), input, output], { encoding: 'utf8' }); }
  assert.equal(parse('Commentary\n```json\n' + JSON.stringify(answer) + '\n```').status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), answer);
  assert.notEqual(parse(JSON.stringify({ ...answer, scores: [{ criterion: 'x', score: 99, why: 'bad' }] })).status, 0);
  assert.notEqual(parse(JSON.stringify({ ...answer, unknown: 'unexpected' })).status, 0);
});
