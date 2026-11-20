import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const plugin = path.join(repo, 'plugins', 'jason-toolkit');
export const skillRoot = path.join(plugin, 'skills');
export const agentRoots = {
  claude: '.claude/skills', codex: '.agents/skills', copilot: '.agents/skills', grok: '.agents/skills',
  cursor: '.cursor/skills', gemini: '.gemini/skills', opencode: '.config/opencode/skills',
};
export const projectRoots = { ...agentRoots, copilot: '.github/skills', grok: '.grok/skills', opencode: '.opencode/skills' };
export const roleBundles = {
  'prune-tests': ['test-classifier', 'test-prover'], committee: ['committee-member', 'committee-member-web'],
  ship: ['ship-pr'], orchestrate: ['parallel-worker'],
};
export function cliCommand(name) {
  if (process.platform === 'win32' && name === 'codex') {
    const loader = (process.env.PATH || '').split(path.delimiter).map(p => path.join(p, 'node_modules/@openai/codex/bin/codex.js')).find(p => fs.existsSync(p));
    if (loader) return { binary: process.execPath, prefix: [loader] };
  }
  return { binary: name, prefix: [] };
}
export function exists(p) { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
export function within(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}
export function files(root) {
  return fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(e => {
    const p = path.join(root, e.name);
    if (e.isSymbolicLink()) throw new Error(`Unexpected symlink in source: ${p}`);
    return e.isDirectory() ? files(p) : [p];
  });
}
export function fingerprint(root) {
  const stat = fs.lstatSync(root);
  if (stat.isSymbolicLink()) return `link:${fs.readlinkSync(root)}`;
  const hash = crypto.createHash('sha256');
  function visit(p) {
    const item = fs.lstatSync(p);
    hash.update(path.relative(root, p).split(path.sep).join('/')); hash.update('\0');
    if (item.isSymbolicLink()) hash.update(`link:${fs.readlinkSync(p)}`);
    else if (item.isDirectory()) for (const name of fs.readdirSync(p).sort()) visit(path.join(p, name));
    else hash.update(fs.readFileSync(p));
    hash.update('\0');
  }
  visit(root);
  return hash.digest('hex');
}
export function skills() {
  return fs.readdirSync(skillRoot, { withFileTypes: true }).filter(e => e.isDirectory() && exists(path.join(skillRoot, e.name, 'SKILL.md'))).map(e => e.name).sort();
}
export function readJson(p, fallback) { return exists(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : fallback; }
export function writeJson(p, value) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const temp = `${p}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 }); fs.renameSync(temp, p);
}
export function parseFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) throw new Error(`Missing frontmatter: ${file}`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line) || /^\s/.test(line)) continue;
    const field = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!field) throw new Error(`Unsupported frontmatter line in ${file}: ${line}`);
    let value = field[2];
    if (value.startsWith('"')) value = JSON.parse(value);
    else if (value.startsWith("'")) {
      if (!value.endsWith("'")) throw new Error(`Unclosed YAML quote: ${file}`);
      value = value.slice(1, -1).replace(/''/g, "'");
    } else if (/:\s/.test(value)) throw new Error(`Quote YAML values containing colon-space: ${file}`);
    fields[field[1]] = value;
  }
  return { fields, frontmatter: match[0], body: text.slice(match[0].length) };
}
