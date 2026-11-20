import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { repo, plugin, skillRoot, skills, files, parseFrontmatter } from './toolkit.mjs';

const problems = [], names = skills();
const runtime = fs.readFileSync(path.join(repo, 'authoring/host-runtime.md'), 'utf8');
for (const name of names) {
  const root = path.join(skillRoot, name);
  try {
    const { fields, body } = parseFrontmatter(path.join(root, 'SKILL.md'));
    if (fields.name !== name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) problems.push(`${name}: invalid name`);
    if (!fields.description || fields.description.length > 1024) problems.push(`${name}: missing or oversized description`);
    if (!body.includes('(references/host-runtime.md)')) problems.push(`${name}: runtime guidance not linked`);
    if (fs.readFileSync(path.join(root, 'references/host-runtime.md'), 'utf8') !== runtime) problems.push(`${name}: generated runtime differs; run npm run build`);
  } catch (e) { problems.push(e.message); }
  for (const file of files(root)) {
    if (/\.(bak|tmp|tgz|pyc)$/.test(file)) problems.push(`Unexpected artifact: ${file}`);
    if (file.endsWith('.md')) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
        const link = match[1].split('#')[0];
        if (!link || /^(https?:|mailto:|\/|<)/.test(link)) continue;
        const target = path.resolve(path.dirname(file), link);
        if (!fs.existsSync(target)) problems.push(`${path.relative(repo, file)}: broken link ${link}`);
      }
    }
    if (/\.(m?js)$/.test(file)) {
      const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
      if (check.status !== 0) problems.push(check.stderr);
    }
  }
}
for (const file of files(path.join(repo, 'scripts')).filter(f => f.endsWith('.mjs'))) {
  const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
  if (check.status !== 0) problems.push(check.stderr);
}
const manifests = ['plugin.json', '.claude-plugin/plugin.json', '.codex-plugin/plugin.json'].map(p => JSON.parse(fs.readFileSync(path.join(plugin, p), 'utf8')));
if (manifests.some(m => m.name !== 'jason-toolkit' || m.version !== '2.0.0')) problems.push('Plugin identities/versions disagree');
for (const file of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json']) {
  const m = JSON.parse(fs.readFileSync(path.join(repo, file), 'utf8'));
  const entry = m.plugins.find(p => p.name === 'jason-toolkit');
  const source = typeof entry?.source === 'string' ? entry.source : entry?.source?.path;
  if (!source || path.resolve(repo, source) !== plugin) problems.push(`Invalid plugin source: ${file}`);
}
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${names.length} skills, resource links, JavaScript syntax and both marketplace formats.`);
