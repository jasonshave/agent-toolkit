#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { repo, plugin, skillRoot, agentRoots, projectRoots, roleBundles, cliCommand, exists, within, fingerprint, skills, readJson, writeJson } from './toolkit.mjs';

export function parseArgs(args) {
  const options = { command: 'install', home: os.homedir(), agents: ['claude', 'codex', 'copilot', 'grok'], mode: 'copy', scope: 'user', replace: false, dryRun: false, includeExisting: false };
  if (args[0] && !args[0].startsWith('-')) options.command = args.shift();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (key === '--replace') options.replace = true;
    else if (key === '--dry-run') options.dryRun = true;
    else if (key === '--include-existing') options.includeExisting = true;
    else if (key === '--migrate-legacy') options.migrateLegacy = true;
    else if (key === '--archive-originals') options.archiveOriginals = true;
    else if (key === '--help' || key === '-h') options.command = 'help';
    else if (['--home', '--agents', '--mode', '--scope', '--project', '--skills', '--skills-dir'].includes(key)) {
      const value = args[++i]; if (!value || value.startsWith('--')) throw new Error(`Missing value for ${key}`);
      options[{ '--home': 'home', '--agents': 'agents', '--mode': 'mode', '--scope': 'scope', '--project': 'project', '--skills': 'selected', '--skills-dir': 'skillsDir' }[key]] = ['--agents', '--skills'].includes(key) ? value.split(',') : value;
    } else throw new Error(`Unknown option: ${key}`);
  }
  if (!['install', 'uninstall', 'doctor', 'list', 'help'].includes(options.command)) throw new Error(`Unknown command: ${options.command}`);
  if (!['copy', 'link'].includes(options.mode)) throw new Error('Mode must be copy or link');
  if (!['user', 'project'].includes(options.scope)) throw new Error('Scope must be user or project');
  if (options.scope === 'project' && !options.project) throw new Error('--scope project requires --project PATH');
  for (const agent of options.agents) if (!agentRoots[agent]) throw new Error(`Unknown agent: ${agent}`);
  for (const name of options.selected ?? []) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 64) throw new Error(`Invalid skill name: ${name}`);
  options.home = path.resolve(options.home);
  options.root = options.scope === 'project' ? path.resolve(options.project) : options.home;
  if (options.skillsDir) options.skillsDir = path.resolve(options.skillsDir);
  return options;
}
function statePaths(options) {
  const root = options.scope === 'project' ? path.join(options.root, '.jason-toolkit') : path.join(options.home, '.local', 'share', 'jason-toolkit');
  return { root, receipt: path.join(root, 'installations.json') };
}
function assertDestination(root, destination) {
  if (!within(root, destination)) throw new Error(`Destination outside install root: ${destination}`);
  for (let p = path.dirname(destination); within(root, p); p = path.dirname(p)) {
    if (exists(p) && fs.lstatSync(p).isSymbolicLink()) throw new Error(`Parent is a symlink; choose its real root explicitly: ${p}`);
  }
}
function removeEntry(root, destination) {
  assertDestination(root, destination);
  if (fs.lstatSync(destination).isSymbolicLink()) fs.unlinkSync(destination);
  else fs.rmSync(destination, { recursive: true });
}
function roleOwners(entry, receipt, root) {
  if (Array.isArray(entry.owners)) return entry.owners;
  const role = path.basename(entry.destination, '.md');
  return receipt.entries.filter(e => e.kind === 'skill' && path.dirname(e.destination) === path.join(root, '.claude/skills') &&
    (e.requiredRoles ?? roleBundles[path.basename(e.destination)] ?? []).includes(role)).map(e => path.basename(e.destination));
}
export function plan(options) {
  const names = skills();
  if (options.selected) for (const name of options.selected) if (!names.includes(name)) throw new Error(`Unknown skill: ${name}`);
  const selected = options.selected ?? names;
  const roots = options.skillsDir ? [options.skillsDir] : [...new Set(options.agents.map(a => path.resolve(options.root, (options.scope === 'project' ? projectRoots : agentRoots)[a])))];
  if (options.skillsDir && !within(options.root, options.skillsDir)) throw new Error('--skills-dir must be inside --home or --project');
  const entries = roots.flatMap(root => selected.map(name => ({ source: path.join(skillRoot, name), destination: path.join(root, name), kind: 'skill', requiredRoles: roleBundles[name] ?? [] })));
  if (!options.skillsDir && options.agents.includes('claude')) {
    const root = path.join(options.root, '.claude', 'agents');
    const wantedRoles = new Set(selected.flatMap(name => roleBundles[name] ?? []));
    for (const file of fs.readdirSync(path.join(plugin, 'agents')).filter(f => wantedRoles.has(f.replace(/\.md$/, '')))) entries.push({ source: path.join(plugin, 'agents', file), destination: path.join(root, file), kind: 'agent', owners: selected.filter(name => (roleBundles[name] ?? []).includes(file.replace(/\.md$/, ''))) });
  }
  // Make already-installed shared third-party skills visible to Claude without vendoring or altering them.
  if (options.includeExisting && options.agents.includes('claude') && !options.skillsDir) {
    const shared = path.join(options.root, '.agents', 'skills');
    if (exists(shared)) for (const name of fs.readdirSync(shared)) {
      const source = path.join(shared, name);
      if (!names.includes(name) && exists(path.join(source, 'SKILL.md'))) entries.push({ source, destination: path.join(options.root, '.claude', 'skills', name), kind: 'external-skill', link: true });
    }
  }
  if (options.migrateLegacy && options.scope === 'user' && !options.skillsDir) {
    for (const agent of options.agents.filter(a => ['codex', 'copilot', 'grok'].includes(a))) {
      for (const name of selected) {
        const destination = path.join(options.home, `.${agent}`, 'skills', name);
        // A non-discoverable compatibility directory keeps old script entrypoints usable.
        const recorded = readJson(statePaths(options).receipt, { entries: [] }).entries.some(e => e.destination === destination && e.kind === 'legacy-alias');
        if (exists(destination) || recorded) entries.push({ source: path.join(skillRoot, name), destination, kind: 'legacy-alias' });
      }
    }
  }
  for (const entry of entries) assertDestination(options.root, entry.destination);
  return entries;
}
export function install(options, log = console.log) {
  const state = statePaths(options);
  assertDestination(options.root, state.receipt);
  const receipt = readJson(state.receipt, { version: 1, entries: [] });
  if (receipt.version !== 1 || !Array.isArray(receipt.entries)) throw new Error('Unrecognized installation receipt');
  const entries = plan(options);
  for (const entry of entries) {
    const previous = receipt.entries.find(e => e.destination === entry.destination);
    if (exists(entry.destination) && !(previous && fingerprint(entry.destination) === previous.fingerprint) && !options.replace) {
      throw new Error(`Existing or edited content: ${entry.destination}. Review it, then use --replace to preserve it in a backup.`);
    }
  }
  const backups = path.join(state.root, 'backups', `${new Date().toISOString().replace(/[:.]/g, '-')}-${process.pid}`);
  assertDestination(options.root, path.join(backups, 'entry'));
  const applied = [];
  try {
    for (const [index, entry] of entries.entries()) {
      const previous = receipt.entries.find(e => e.destination === entry.destination);
      const mode = entry.kind === 'legacy-alias' ? 'alias' : entry.kind === 'agent' ? 'copy' : entry.link ? 'link' : options.mode;
      log(`${options.dryRun ? 'WOULD ' : ''}${mode}: ${entry.destination} <- ${entry.source}`);
      if (options.dryRun) continue;
      fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
      const rollback = { ...entry, previous, saved: null };
      if (exists(entry.destination)) {
        rollback.saved = path.join(backups, String(index)); fs.mkdirSync(backups, { recursive: true });
        fs.renameSync(entry.destination, rollback.saved);
      }
      applied.push(rollback);
      if (mode === 'alias') {
        fs.mkdirSync(entry.destination);
        for (const name of ['scripts', 'references', 'assets']) {
          const source = path.join(entry.source, name);
          if (exists(source)) fs.symlinkSync(source, path.join(entry.destination, name), process.platform === 'win32' ? 'junction' : 'dir');
        }
        fs.writeFileSync(path.join(entry.destination, 'MOVED.md'), `This skill is maintained at ${entry.source}. Its SKILL.md is discovered through ~/.agents/skills.\n`);
      } else if (mode === 'link') fs.symlinkSync(entry.source, entry.destination, fs.statSync(entry.source).isDirectory() ? (process.platform === 'win32' ? 'junction' : 'dir') : 'file');
      else fs.cpSync(entry.source, entry.destination, { recursive: true, errorOnExist: true, force: false });
      const edited = previous && rollback.saved && fingerprint(rollback.saved) !== previous.fingerprint;
      const backup = !previous || edited ? rollback.saved : previous.backup;
      const owners = entry.kind === 'agent' ? [...new Set([...(previous ? roleOwners(previous, receipt, options.root) : []), ...entry.owners])] : undefined;
      receipt.entries = receipt.entries.filter(e => e.destination !== entry.destination);
      receipt.entries.push({ ...entry, ...(owners ? { owners } : {}), mode, fingerprint: fingerprint(entry.destination), backup: backup ?? null });
    }
    if (!options.dryRun) writeJson(state.receipt, receipt);
  } catch (error) {
    for (const entry of applied.reverse()) {
      if (exists(entry.destination)) removeEntry(options.root, entry.destination);
      if (entry.saved) fs.renameSync(entry.saved, entry.destination);
    }
    throw error;
  }
  // Discard only superseded toolkit-owned outputs; preserve original files and locally edited copies.
  if (!options.dryRun) for (const entry of applied) if (entry.saved && !receipt.entries.some(e => e.backup === entry.saved)) removeEntry(options.root, entry.saved);
  if (!options.dryRun) log(`Installed ${entries.length} entries. Receipt: ${state.receipt}`);
  return receipt;
}
export function uninstall(options, log = console.log) {
  const state = statePaths(options), receipt = readJson(state.receipt, { version: 1, entries: [] });
  if (receipt.version !== 1 || !Array.isArray(receipt.entries)) throw new Error('Unrecognized installation receipt');
  const roots = new Set(options.skillsDir ? [options.skillsDir] : options.agents.map(a => path.resolve(options.root, (options.scope === 'project' ? projectRoots : agentRoots)[a])));
  if (options.scope === 'user' && !options.skillsDir) for (const agent of options.agents.filter(a => ['codex', 'copilot', 'grok'].includes(a))) roots.add(path.join(options.home, `.${agent}`, 'skills'));
  const agentRoot = path.join(options.root, '.claude/agents');
  // Installed state, not today's source tree, is authoritative. Broken external links and skills
  // removed from later releases still need their original files restored during uninstall.
  let selected = receipt.entries.filter(entry => {
    if (entry.kind === 'agent') return !options.skillsDir && options.agents.includes('claude') && path.dirname(entry.destination) === agentRoot && (!options.selected || roleOwners(entry, receipt, options.root).some(name => options.selected.includes(name)));
    if (entry.kind === 'external-skill') return roots.has(path.dirname(entry.destination)) && (options.includeExisting || !options.selected || options.selected.includes(path.basename(entry.destination)));
    return roots.has(path.dirname(entry.destination)) && (!options.selected || options.selected.includes(path.basename(entry.destination)));
  });
  const removing = new Set(selected.map(entry => entry.destination));
  const remainingNames = new Set(receipt.entries
    .filter(entry => entry.kind === 'skill' && path.dirname(entry.destination) === path.join(options.root, '.claude/skills') && !removing.has(entry.destination))
    .map(entry => path.basename(entry.destination)));
  const remainingRoles = new Set(receipt.entries.filter(entry => entry.kind === 'agent' && roleOwners(entry, receipt, options.root).some(name => remainingNames.has(name))).map(entry => path.basename(entry.destination, '.md')));
  selected = selected.filter(entry => entry.kind !== 'agent' || !remainingRoles.has(path.basename(entry.destination, '.md')));
  for (const entry of selected) {
    assertDestination(options.root, entry.destination);
    if (entry.backup) assertDestination(options.root, entry.backup);
    if (exists(entry.destination) && fingerprint(entry.destination) !== entry.fingerprint) throw new Error(`Locally edited; preserving ${entry.destination}`);
    if (entry.backup && !exists(entry.backup)) throw new Error(`Backup missing; preserving ${entry.destination}`);
  }
  for (const entry of selected) {
    log(`${options.dryRun ? 'WOULD ' : ''}uninstall: ${entry.destination}`);
    if (options.dryRun) continue;
    if (exists(entry.destination)) removeEntry(options.root, entry.destination);
    if (entry.backup && options.archiveOriginals) {
      receipt.archives ??= [];
      receipt.archives.push({ destination: entry.destination, backup: entry.backup, archivedAt: new Date().toISOString() });
      log(`Original kept inactive in backup: ${entry.backup}`);
    } else if (entry.backup) fs.renameSync(entry.backup, entry.destination);
    receipt.entries = receipt.entries.filter(e => e.destination !== entry.destination);
  }
  if (!options.dryRun) writeJson(state.receipt, receipt);
}
export function doctor(options, log = console.log) {
  let missing = 0;
  for (const entry of plan(options)) {
    const present = exists(entry.destination);
    const same = present && (entry.kind === 'legacy-alias'
      ? !exists(path.join(entry.destination, 'SKILL.md')) && ['scripts', 'references', 'assets'].every(name => !exists(path.join(entry.source, name)) || (exists(path.join(entry.destination, name)) && fs.realpathSync(path.join(entry.destination, name)) === fs.realpathSync(path.join(entry.source, name))))
      : fs.lstatSync(entry.destination).isSymbolicLink()
      ? fs.realpathSync(entry.destination) === fs.realpathSync(entry.source)
      : fingerprint(entry.destination) === fingerprint(entry.source));
    log(`${same ? 'OK' : present ? 'DRIFT' : 'MISSING'} ${entry.destination}`);
    if (!same) missing++;
  }
  for (const tool of ['node', 'git', 'gh', 'claude', 'codex', 'copilot', 'grok']) {
    const command = cliCommand(tool);
    const result = spawnSync(command.binary, [...command.prefix, '--version'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    log(`${result.status === 0 ? 'CLI' : 'OPTIONAL CLI unavailable'} ${tool}: ${(result.stdout || result.stderr || result.error?.message || '').split(/\r?\n/)[0]}`);
  }
  log('Authentication and workflow-specific tools (Azure, fal.ai, Python/Cargo) are checked when the relevant skill runs.');
  return missing === 0;
}
export function main(args = process.argv.slice(2)) {
  const options = parseArgs([...args]);
  if (options.command === 'help') return console.log('node scripts/install.mjs [install|uninstall|doctor|list] [--agents claude,codex,copilot,grok,cursor,gemini,opencode] [--home PATH] [--scope project --project PATH] [--skills NAME,...] [--skills-dir PATH] [--mode copy|link] [--replace] [--include-existing] [--migrate-legacy] [--archive-originals] [--dry-run]');
  if (options.command === 'list') return console.log(skills().join('\n'));
  if (options.command === 'install') install(options);
  if (options.command === 'uninstall') uninstall(options);
  if (options.command === 'doctor' && !doctor(options)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
