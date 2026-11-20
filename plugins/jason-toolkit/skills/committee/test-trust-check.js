// Regression test for grok-trust-check.js: each case writes a trust file into a throwaway Grok home
// and checks the exit code (0 = seat Grok, 1 = trusted, 3 = can't be sure, so refuse: an unknown
// layout, an unreadable file, or a trusted folder on another drive or network share).
// Needs no Grok sign-in. self-test.sh runs it; run it yourself after editing grok-trust-check.js:
//   node test-trust-check.js
const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const script = path.join(__dirname, 'grok-trust-check.js');
const R = 'C:/Users/me/code/repo';                       // the folder under review, unless a case says
const W = String.raw`C:\Users\me\code\repo`;
const entry = (p, t) => `[folders.'${p}']\ntrusted = ${t}\ndecided_at = 1790030619\n`;
function run(content, folder) {
  const h = fs.mkdtempSync(path.join(os.tmpdir(), 'trust-test-'));
  const f = path.join(h, 'trusted_folders.toml');
  if (content === 'UNREADABLE') fs.mkdirSync(f);         // a folder where the file should be
  else if (content !== null) fs.writeFileSync(f, content);
  const r = spawnSync(process.execPath, [script, folder || R], { env: { ...process.env, GROK_HOME: h }, encoding: 'utf8' });
  fs.rmSync(h, { recursive: true, force: true });
  return r.status;
}
const cases = [
  // The layout Grok writes, and harmless variations of it
  [1, 'this folder trusted, as Grok writes it', entry(W, 'true')],
  [1, 'trusted line before decided_at', `[folders.'${W}']\ndecided_at = 1\ntrusted = true\n`],
  [1, 'comments, blank lines and spacing', `# mine\n\n  [ folders . '${W}' ]  # repo\n  trusted=true # yes\n`],
  [1, 'a parent folder trusted', entry(String.raw`C:\Users\me\code`, 'true')],
  [1, 'different letter case and slashes', entry('c:/users/ME/code/repo', 'true')],
  [1, 'long-path prefix', entry('\\\\?\\' + W, 'true')],
  [1, 'network share via a UNC long-path prefix', entry(String.raw`\\?\UNC\srv\share`, 'true'), '//srv/share/repo'],
  [1, 'trusted among several entries', entry(String.raw`C:\Other`, 'false') + entry(W, 'true')],
  [0, 'explicitly untrusted', entry(W, 'false')],
  [0, 'similar-named sibling trusted', entry(W + '-other', 'true')],
  [0, 'a subfolder trusted, not this one', entry(W + String.raw`\sub`, 'true')],
  [0, 'another folder trusted, this one not', entry(String.raw`C:\Other`, 'true') + entry(W, 'false')],
  [0, 'no trust file', null],
  [0, 'empty trust file', ''],
  [3, 'a trusted folder on another drive (not followed, so refuse)', entry(String.raw`Z:\offline\share`, 'true')],
  [0, 'an untrusted folder on another drive', entry(String.raw`Z:\offline\share`, 'false')],
  [3, 'a trusted network share while reviewing a local folder', entry(String.raw`\\srv\share`, 'true')],
  [3, 'a trusted local folder while reviewing a network share', entry(String.raw`C:\Users\me\code`, 'true'), '//srv/share/repo'],
  [1, 'this folder trusted, plus an untrusted entry on another drive', entry(String.raw`Z:\x`, 'false') + entry(W, 'true')],
  [1, 'this folder trusted before a trusted entry on another drive', entry(W, 'true') + entry(String.raw`Z:\x`, 'true')],
  [3, 'a different network share trusted while reviewing a share', entry(String.raw`\\srv2\b`, 'true'), '//srv1/a/repo'],
  [3, 'the same share under another server name', entry(String.raw`\\srv.corp.local\share`, 'true'), '//srv/share/repo'],
  [1, 'the same share, same name, trusted', entry(String.raw`\\srv\share`, 'true'), '//srv/share/repo'],
  [3, 'another folder on the reviewed share trusted (not followed, so refuse)', entry(String.raw`\\srv\share\other`, 'true'), '//srv/share/repo'],
  [0, 'another folder on the reviewed share, untrusted', entry(String.raw`\\srv\share\other`, 'false'), '//srv/share/repo'],
  // Anything else: refuse rather than guess
  [3, 'double-quoted path', `[folders."C:\\\\Users\\\\me\\\\code\\\\repo"]\ntrusted = true\n`],
  [3, 'unicode escape in a path', `[folders."C:\\\\Users\\\\me\\\\code\\\\re\\u0070o"]\ntrusted = true\n`],
  [3, 'long unicode escape for a backslash', '[folders."C:\\\\Users\\\\me\\\\code\\U0000005Crepo"]\ntrusted = true\n'],
  [3, 'quoted key', `[folders.'${W}']\n"trusted" = true\n`],
  [3, 'value in quotes', `[folders.'${W}']\ntrusted = "true"\n`],
  [3, 'capitalised key', `[folders.'${W}']\nTrusted = true\n`],
  [3, 'a different trust key', `[folders.'${W}']\ntrust = true\n`],
  [3, 'an unknown key', `[folders.'${W}']\nnote = 1\ntrusted = false\n`],
  [3, 'array value', `[folders.'${W}']\nnote = [\n[x]\n]\ntrusted = true\n`],
  [3, 'multi-line string', `[folders.'${W}']\nnote = """\n[x]\n"""\ntrusted = true\n`],
  [3, 'inline-table layout', `folders = { '${W}' = { trusted = true } }\n`],
  [3, 'inline table, literal path ending in a backslash', `folders = { 'C:\\' = { trusted = false }, '${W}' = { trusted = true } }\n`],
  [3, 'an odd line in an unrelated entry', entry(String.raw`C:\Other`, 'true') + 'something odd\n'],
  [3, 'a trusted line outside any entry', 'trusted = true\n'],
  [3, 'some other table', `[settings]\nx = 1\n` + entry(W, 'false')],
  [3, 'trust file unreadable', 'UNREADABLE'],
];
// Cases whose paths only mean what they say on Windows (drive letters, backslashes, network
// shares). Elsewhere they are skipped, and the result line says so.
const windowsOnly = c => /[A-Za-z]:|\\|^\/\//.test((c[2] || '') + (c[3] || ''));
const onWindows = process.platform === 'win32';
const run_cases = onWindows ? cases : cases.filter(c => !windowsOnly(c));
let bad = 0;
for (const [want, name, content, folder] of run_cases) {
  const got = run(content, folder);
  if (got !== want) { bad++; console.log(`  trust-check case failed: ${name} (exit ${got}, expected ${want})`); }
}
// Folder links (a junction on Windows, a symlink elsewhere): trust on either side must count.
let total = run_cases.length, skipped = onWindows ? '' : ` (${cases.length - run_cases.length} Windows-only cases SKIPPED: not Windows)`;
{
  // Grok's single-quoted layout can't hold a path with an apostrophe, so use a temp folder without one.
  const base = os.tmpdir().includes("'") ? path.parse(os.tmpdir()).root : os.tmpdir();
  const t = fs.mkdtempSync(path.join(base, 'trust-link-'));
  const real = path.join(t, 'real'), link = path.join(t, 'link');
  fs.mkdirSync(real);
  let made = true;
  try { fs.symlinkSync(real, link, 'junction'); } catch { made = false; }
  if (made) {
    for (const [name, trustedPath, reviewed] of [
      ['trusted through a link, reviewed by its real path', link, real],
      ['trusted by its real path, reviewed through a link', real, link],
      ['trusted through a link written with a long-path prefix', '\\\\?\\' + link, real],
    ]) {
      total++;
      const got = run(entry(trustedPath, 'true'), reviewed);
      if (got !== 1) { bad++; console.log(`  trust-check case failed: ${name} (exit ${got}, expected 1)`); }
    }
  } else skipped = ' (3 folder-link cases SKIPPED: a folder link could not be created here)';
  fs.rmSync(t, { recursive: true, force: true });
}
console.log((bad ? `trust check: ${bad} of ${total} cases failed` : `trust check: all ${total} cases pass`) + skipped);
process.exit(bad ? 1 : 0);
