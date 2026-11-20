// Should a Grok member be seated in this folder? Grok runs a folder's own hooks, MCP servers and
// instructions only if the user has trusted that folder (or a parent of it) in Grok. A hook can run
// any command, so a trusted folder must not get a Grok member.
//
//   node grok-trust-check.js <folder>
//
// Exit 0: not trusted, fine to seat Grok. Exit 1: trusted (prints which entry). Exit 3: refuse rather
// than guess (prints why): the trust file isn't exactly in the layout Grok writes, can't be read, or
// trusts a folder on another drive or network share that this check doesn't follow through links.
// Reads trusted_folders.toml in $GROK_HOME (default ~/.grok); a missing file means nothing is trusted.
//
// Deliberately strict: it accepts ONLY the layout Grok itself writes (seen 2026-11-06), plus blank
// lines, comments and spacing:
//     [folders.'C:\path\to\folder']
//     trusted = true            (or false)
//     decided_at = 1790030619
// Any other line anywhere in the file (double-quoted or escaped paths, other keys, arrays, inline
// tables, multi-line strings) means exit 3. A general TOML reader kept growing holes in review;
// refusing everything unexpected has none. If a Grok update changes the layout, Grok members are
// refused (a Claude member takes the seat) until this is updated. test-trust-check.js holds the
// cases; self-test.sh runs it.
const fs = require('fs'), path = require('path'), os = require('os');
const file = path.join(process.env.GROK_HOME || path.join(os.homedir(), '.grok'), 'trusted_folders.toml');
let text;
try { text = fs.readFileSync(file, 'utf8'); }
catch (e) {
  if (e.code === 'ENOENT') process.exit(0);           // no trust file: nothing is trusted
  console.log(`Grok's trust file exists but can't be read (${e.code})`); process.exit(3);
}

// One spelling per folder: long-path prefixes dropped (\\?\C:\x -> C:\x, \\?\UNC\srv\share ->
// \\srv\share), forward slashes, no trailing slash, lower case.
const norm = p => path.resolve(p.replace(/^[\\/]{2}[?.][\\/]UNC[\\/]/i, '\\\\').replace(/^[\\/]{2}[?.][\\/]/, ''))
  .replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
const work = norm(process.argv[2] || '.');
const covers = new Set();                             // the folder itself and every parent,
const addWithParents = start => {                      // as given and as its real path behind links
  for (let p = start; ; ) { covers.add(p); const up = p.replace(/\/[^/]*$/, ''); if (up === p || !up) break; p = up; }
};
// The real path behind a link is looked up only for local paths on the reviewed folder's own drive.
// Nothing on a \\server\share path or on another drive letter is ever looked up (an offline one makes
// Windows wait for its network timeout, and a lookup sends the server name out on the network). The
// reviewed folder's own drive letter is looked up even if it is a mapped network drive: the review
// is already reading that drive, so it is online and the user's own. A trusted entry
// that can't be checked that way, on another drive, or on the network share being reviewed, refuses
// the Grok seat instead (below). Long-path prefixes are removed before deciding.
// "Drive": a Windows drive letter; each network share (//server/share) is a drive of its own, so a
// different share or a different name for the same server also counts as another drive; on Linux
// and macOS everything local is one drive.
const driveOf = p => {
  const n = norm(p);
  if (n.startsWith('//')) return (n.match(/^\/\/[^/]+\/[^/]+/) || [n])[0];
  return /^[a-z]:/.test(n) ? n.slice(0, 2) : '/';
};
const isShare = d => d.startsWith('//');
const workDrive = driveOf(process.argv[2] || '.');
const real = p => {
  if (isShare(workDrive) || driveOf(p) !== workDrive) return null;   // local, same drive only
  try { return norm(fs.realpathSync.native(p.replace(/^[\\/]{2}[?.][\\/]/, ''))); } catch { return null; }
};
addWithParents(work);
const realWork = real(process.argv[2] || '.');
if (realWork) addWithParents(realWork);

const end = String.raw`\s*(?:#.*)?$`;                 // optional spaces and a trailing comment
const blank = new RegExp('^' + end);
const header = new RegExp(String.raw`^\s*\[\s*folders\s*\.\s*'([^'\n]+)'\s*\]` + end);
const trusted = new RegExp(String.raw`^\s*trusted\s*=\s*(true|false)` + end);
const decided = new RegExp(String.raw`^\s*decided_at\s*=\s*\d+` + end);

let current = null, n = 0, hit = null;
for (const line of text.split(/\r?\n/)) {
  n++;
  let m;
  if (blank.test(line) || decided.test(line)) continue;
  if ((m = line.match(header))) {
    // The folder as written, and its real path if it is (or sits behind) a link.
    current = [norm(m[1])];
    const r = real(m[1]); if (r) current.push(r);
    // Not followed through links: another drive or share, or anything when reviewing on a share.
    current.otherDrive = driveOf(m[1]) !== workDrive || isShare(workDrive);
    continue;
  }
  if ((m = line.match(trusted))) {
    if (!current) { console.log(`Grok's trust file has a trusted line outside any folder entry (line ${n})`); process.exit(3); }
    if (m[1] === 'true' && !hit) hit = current.find(p => covers.has(p)) || null;
    if (m[1] === 'true' && !hit && current.otherDrive) {
      console.log(`Grok's trust file trusts a folder (line ${n}) on another drive or a network share, which this check doesn't follow through links; not trusting it`);
      process.exit(3);
    }
    continue;
  }
  console.log(`Grok's trust file isn't in the layout this check knows (line ${n}); not trusting it`);
  process.exit(3);
}
if (hit) { console.log(`trusted in Grok via ${hit}`); process.exit(1); }
process.exit(0);
