#!/usr/bin/env node
// Explicit opt-in provider smoke test. Uses only a synthetic, disposable repository.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { install, parseArgs } from './install.mjs';
import { skills } from './toolkit.mjs';

const host = process.argv[2];
if (!['claude', 'codex', 'copilot', 'grok'].includes(host)) {
  console.error('Usage: node scripts/smoke-hosts.mjs <claude|codex|copilot|grok> [output-directory]'); process.exit(2);
}
const output = path.resolve(process.argv[3] || 'artifacts/host-smoke'); fs.mkdirSync(output, { recursive: true });
const root = fs.mkdtempSync(path.join(os.tmpdir(), `toolkit-${host}-smoke-`));
console.log(`Testing ${host} in disposable ${root}; logs: ${output}`);
try {
  function command(binary, args, options = {}) {
    const result = spawnSync(binary, args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 300000, maxBuffer: 16 * 1024 * 1024, ...options });
    if (result.error) throw result.error; return result;
  }
  command('git', ['init', '-q']);
  fs.writeFileSync(path.join(root, 'package.json'), '{"type":"module","scripts":{"test":"node --test tests/*.test.mjs"}}\n');
  fs.mkdirSync(path.join(root, 'src')); fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'src/access.mjs'), 'export function canRead(owner, caller) { return owner === caller; }\n');
  fs.writeFileSync(path.join(root, 'tests/access.test.mjs'), `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canRead } from '../src/access.mjs';
test('owner can read', () => assert.equal(canRead('alice','alice'), true));
test('owner can read duplicate', () => assert.equal(canRead('alice','alice'), true));
test('another account cannot read', () => assert.equal(canRead('alice','bob'), false));
`);
  const baseline = command(process.execPath, ['--test', 'tests/access.test.mjs']);
  if (baseline.status !== 0) throw new Error(baseline.stderr);
  fs.writeFileSync(path.join(root, 'baseline.txt'), baseline.stdout);
  fs.writeFileSync(path.join(root, 'AGENTS.md'), 'Synthetic skill acceptance fixture. Read-only report only: no file changes, issues, PRs, installs or delegation. Baseline is baseline.txt. CI runs node --test tests/access.test.mjs. All work must stay in this fixture.\n');
  install(parseArgs(['--home', root, '--scope', 'project', '--project', root, '--agents', host]), () => {});
  command('git', ['add', '.']); command('git', ['-c', 'user.name=Smoke', '-c', 'user.email=smoke@example.invalid', 'commit', '-qm', 'fixture']);
  const prompt = `Use the available prune-tests skill in --report-only mode on tests/access.test.mjs. This synthetic acceptance run explicitly uses sequential classification without subagents or writes. Read the skill and rubric. The real passing baseline is baseline.txt; do not rerun tests or create a branch, ledger, issue or PR. Read the production function and all three tests. Reply ONLY JSON with keys toolkitSkills (sorted names of the ${skills().length} jason-toolkit skills you can discover), candidate (the exact redundant test name), survivor (exact kept owner test name), securityGuard (the exact kept cross-account test name), reason (evidence), executionMode (sequential). Do not classify a security boundary as redundant because only the positive case survives.`;
  let binary = host, args, options = {};
  if (host === 'claude') {
    args = ['--print', '--restricted', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', 'Read,Grep,Glob,Skill', '--allowedTools', 'Read,Grep,Glob,Skill', '--permission-mode', 'dontAsk', '--permission-prompts', 'none', '--output-format', 'json'];
    const env = { ...process.env }; delete env.CLAUDECODE; options = { input: prompt, env };
  } else if (host === 'codex') {
    args = ['exec', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '-c', 'approval_policy=never', '-c', 'windows.sandbox=elevated', '-s', 'read-only', '--disable', 'apps', '--disable', 'plugins', '--disable', 'remote_plugin', '--disable', 'multi_agent', '--json', '-o', path.join(output, 'codex-final.txt'), '-'];
    options = { input: prompt };
    const loader = process.env.TOOLKIT_CODEX_CLI || (process.platform === 'win32'
      ? (process.env.PATH || '').split(path.delimiter).map(p => path.join(p, 'node_modules/@openai/codex/bin/codex.js')).find(p => fs.existsSync(p)) : null);
    if (loader) { binary = process.execPath; args.unshift(loader); }
  } else if (host === 'grok') {
    fs.writeFileSync(path.join(output, 'grok-prompt.txt'), prompt);
    args = ['--output-format', 'json', '--tools', 'read_file,grep,list_dir', '--deny', 'MCPTool(*)', '--no-subagents', '--permission-mode', 'dontAsk', '--max-turns', '30', '--cwd', root, '--prompt-file', path.join(output, 'grok-prompt.txt')];
  } else {
    // Override with a local executable or npm loader for acceptance without a global CLI install.
    binary = process.env.TOOLKIT_COPILOT_CLI || 'copilot';
    args = ['--trust-folder', '--no-ask-user', '--disable-builtin-mcps', '--available-tools', 'view', 'glob', 'grep', 'skill', '--allow-tool', 'read', '--deny-tool', 'write', 'shell', '-p', prompt, '--silent'];
    if (binary.endsWith('.js')) { args.unshift(binary); binary = process.execPath; }
  }
  // Discovery does not require a model request and is saved separately from behavioral evidence.
  if (host === 'grok') {
    const discovery = command('grok', ['inspect', '--json']); fs.writeFileSync(path.join(output, 'grok-discovery.json'), discovery.stdout);
    if (discovery.status !== 0 || skills().some(name => !discovery.stdout.includes(name))) throw new Error('Grok discovery missing toolkit skills');
  }
  if (host === 'copilot') {
    const prefix = binary === process.execPath ? [process.env.TOOLKIT_COPILOT_CLI] : [];
    const discovery = command(binary, [...prefix, 'skill', 'list', '--json']); fs.writeFileSync(path.join(output, 'copilot-discovery.json'), discovery.stdout);
    if (discovery.status !== 0 || skills().some(name => !discovery.stdout.includes(name))) throw new Error('Copilot discovery missing toolkit skills');
  }
  const result = command(binary, args, options);
  fs.writeFileSync(path.join(output, `${host}.stdout`), result.stdout || ''); fs.writeFileSync(path.join(output, `${host}.stderr`), result.stderr || '');
  if (result.status !== 0) throw new Error(`${host} exited ${result.status}; inspect ${host}.stderr`);
  let text = result.stdout;
  if (host === 'claude') text = JSON.parse(text).result;
  if (host === 'codex') text = fs.readFileSync(path.join(output, 'codex-final.txt'), 'utf8');
  if (host === 'grok') text = JSON.parse(text).text;
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  const answer = JSON.parse(text.slice(start, end + 1));
  if (JSON.stringify([...answer.toolkitSkills].sort()) !== JSON.stringify(skills())) throw new Error(`${host} did not discover exactly the toolkit catalog`);
  if (answer.candidate !== 'owner can read duplicate' || answer.survivor !== 'owner can read' || answer.securityGuard !== 'another account cannot read') throw new Error(`${host} did not preserve unique positive/security behavior: ${JSON.stringify(answer)}`);
  const status = command('git', ['status', '--porcelain']);
  if (status.status !== 0 || status.stdout.trim()) throw new Error(`${host} modified the report-only fixture: ${status.stdout}`);
  fs.writeFileSync(path.join(output, `${host}-verified.json`), JSON.stringify({ host, checkedAt: new Date().toISOString(), answer }, null, 2) + '\n');
  console.log(`PASS ${host}: all ${skills().length} skills discovered; prune-tests identified the duplicate, preserved the security boundary, and left the fixture unchanged.`);
} catch (e) { console.error(e.message); process.exitCode = 1; }
finally { fs.rmSync(root, { recursive: true, force: true }); console.log(`Removed ${root}`); }
