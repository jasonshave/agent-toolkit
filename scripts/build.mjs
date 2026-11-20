import fs from 'node:fs';
import path from 'node:path';
import { repo, plugin, skillRoot, skills, parseFrontmatter, roleBundles } from './toolkit.mjs';

const runtime = fs.readFileSync(path.join(repo, 'authoring', 'host-runtime.md'), 'utf8');
for (const name of skills()) {
  const skill = path.join(skillRoot, name);
  const resource = path.join(skill, 'references', 'host-runtime.md');
  fs.mkdirSync(path.dirname(resource), { recursive: true }); fs.writeFileSync(resource, runtime);
  for (const role of roleBundles[name] ?? []) {
    const source = path.join(plugin, 'agents', `${role}.md`);
    const destination = path.join(skill, 'references', 'roles', `${role}.md`);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(source, destination);
  }
  const manifest = path.join(skill, 'SKILL.md');
  const { fields, body } = parseFrontmatter(manifest);
  const metadata = `---\nname: ${fields.name}\ndescription: ${JSON.stringify(fields.description)}\n---\n`;
  const link = '\nRead [host execution guidance](references/host-runtime.md) before running this workflow.\n';
  fs.writeFileSync(manifest, metadata + (body.includes('(references/host-runtime.md)') ? body : link + body));
}
console.log(`Built ${skills().length} self-contained skills and bundled worker roles.`);
