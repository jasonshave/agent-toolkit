#!/usr/bin/env node
// A committee chair on any host can launch a genuinely tool-restricted Claude seat.
// Usage: node run-claude-member.mjs <prompt> <out.json> <repo> [session|-] [material-dir]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export function repositoryState(root) {
  const result = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8', windowsHide: true });
  const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0 || head.status !== 0) throw new Error('Cannot fingerprint reviewed repository');
  const hash = crypto.createHash('sha256').update(head.stdout.trim());
  for (const file of [...new Set(result.stdout.split('\0').filter(Boolean))].sort()) {
    hash.update(file); hash.update('\0');
    try {
      const full = path.join(root, file), stat = fs.lstatSync(full);
      hash.update(stat.isSymbolicLink() ? fs.readlinkSync(full) : stat.isFile() ? fs.readFileSync(full) : 'directory');
    } catch (e) { if (e.code === 'ENOENT') hash.update('deleted'); else throw e; }
    hash.update('\0');
  }
  return hash.digest('hex');
}
export function launchArgs({ schema, session, material, web = false }) {
  const tools = web ? 'Read,Grep,Glob,WebSearch,WebFetch' : 'Read,Grep,Glob';
  const args = ['--print', '--restricted', '--safe-mode', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--tools', tools, '--allowedTools', tools, '--permission-mode', 'dontAsk', '--permission-prompts', 'none',
    '--output-format', 'json', '--model', process.env.COMMITTEE_CLAUDE_MODEL || 'opus',
    '--effort', process.env.COMMITTEE_CLAUDE_EFFORT || 'high', '--json-schema', schema];
  if (session && session !== '-') args.push('--resume', session);
  if (material) args.push('--add-dir', path.resolve(material));
  return args;
}
export function run(argv = process.argv.slice(2)) {
  const [prompt, out, root, session = '-', material] = argv;
  if (!prompt || !out || !root) throw new Error('Usage: run-claude-member.mjs <prompt> <out.json> <repo> [session|-] [material-dir]');
  const schema = fs.readFileSync(path.join(here, 'member-response.schema.json'), 'utf8');
  const before = repositoryState(root);
  const args = launchArgs({ schema, session, material, web: process.env.COMMITTEE_WEB === '1' });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const env = { ...process.env }; delete env.CLAUDECODE;
  const result = spawnSync('claude', args, {
    cwd: root, env, input: fs.readFileSync(prompt, 'utf8'), encoding: 'utf8', windowsHide: true,
    timeout: Number(process.env.COMMITTEE_TIMEOUT || 1200) * 1000, maxBuffer: 16 * 1024 * 1024,
  });
  fs.writeFileSync(`${out}.events`, result.stdout || ''); fs.writeFileSync(`${out}.log`, result.stderr || '');
  if (repositoryState(root) !== before) { console.error('STOP: reviewed repository changed during Claude review'); return 5; }
  if (result.error?.code === 'ENOENT') { console.error('Claude CLI missing; install and sign in before seating a Claude member'); return 2; }
  if (result.error?.code === 'ETIMEDOUT') { console.error('Claude member timed out'); return 3; }
  if (result.status !== 0) { console.error(`Claude member failed; see ${out}.log`); return 4; }
  let response;
  try { response = JSON.parse(result.stdout); } catch { console.error(`Invalid Claude response; see ${out}.events`); return 4; }
  if (response.is_error) { console.error(`Claude member returned an error; see ${out}.events`); return 4; }
  const raw = response.structured_output ? JSON.stringify(response.structured_output) : response.result || '';
  fs.writeFileSync(`${out}.raw`, raw);
  const parsed = spawnSync(process.execPath, [path.join(here, 'extract-answer.js'), `${out}.raw`, out], { encoding: 'utf8', windowsHide: true });
  if (parsed.status !== 0) { console.error(`Invalid committee answer: ${parsed.stderr}`); return 4; }
  if (response.session_id) fs.writeFileSync(`${out}.session`, response.session_id);
  console.log(`claude ok -> ${out}`); return 0;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { process.exitCode = run(); } catch (e) { console.error(e.message); process.exitCode = 4; }
}
