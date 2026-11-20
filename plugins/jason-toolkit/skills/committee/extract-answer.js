// Pulls a committee member's answer out of whatever it wrote, checks its shape, and saves it.
//
//   node extract-answer.js <raw-text-file> <out-json-file>
//
// Members sometimes wrap their JSON in commentary or a code fence. This keeps the LAST JSON object in
// the text that has every required top-level field, checks it against member-response.schema.json
// (every field, its type, allowed values, and no unknown fields), plus the 1-10 score range, and
// writes it pretty-printed. Exit 1, with the reasons, if there is none or it doesn't fit.
const fs = require('fs');
const [src, dst] = process.argv.slice(2);
if (!src || !dst) { console.error('usage: node extract-answer.js <raw> <out>'); process.exit(2); }
const text = fs.readFileSync(src, 'utf8');
const need = ['seat', 'verdict', 'summary', 'scores', 'blockers', 'responses', 'position_changes', 'open_questions'];

// Index of the brace that closes the object opening at `start`, or -1.
function closing(s, start) {
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
    } else if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) return i;
  }
  return -1;
}

let found = null;
for (let i = text.indexOf('{'); i !== -1; i = text.indexOf('{', i + 1)) {
  const end = closing(text, i);
  if (end < 0) continue;
  try {
    const o = JSON.parse(text.slice(i, end + 1));
    if (o && typeof o === 'object' && !Array.isArray(o) && need.every(k => Object.hasOwn(o, k))) { found = o; i = end; }
  } catch { /* not JSON from here; keep scanning */ }
}
if (!found) { console.error('no JSON object with the required fields'); process.exit(1); }

// A small checker for the parts of JSON Schema the answer schema uses: type, enum, required,
// properties, additionalProperties: false, items.
const schema = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'member-response.schema.json'), 'utf8'));
const problems = [];
const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null' : Number.isInteger(v) ? 'integer' : typeof v;
function check(v, s, at) {
  const t = typeOf(v);
  if (s.type && !(t === s.type || (s.type === 'number' && t === 'integer'))) { problems.push(`${at} should be ${s.type}, is ${t}`); return; }
  if (s.enum && !s.enum.includes(v)) problems.push(`${at} is "${v}", not one of ${s.enum.join('/')}`);
  if (t === 'object' && s.properties) {
    for (const k of s.required || []) if (!Object.hasOwn(v, k)) problems.push(`${at} has no ${k}`);
    for (const [k, sub] of Object.entries(s.properties)) if (Object.hasOwn(v, k)) check(v[k], sub, `${at}.${k}`);
    if (s.additionalProperties === false)
      for (const k of Object.keys(v)) if (!Object.hasOwn(s.properties, k)) problems.push(`${at} has an unknown field ${k}`);
  }
  if (t === 'array' && s.items) v.forEach((x, i) => check(x, s.items, `${at}[${i}]`));
}
try {
  check(found, schema, 'answer');
  for (const s of Array.isArray(found.scores) ? found.scores : [])
    if (s && typeof s === 'object' && Number.isInteger(s.score) && (s.score < 1 || s.score > 10))
      problems.push(`score for "${String(s.criterion)}" is ${s.score}, not 1-10`);
} catch (e) {
  problems.push('it could not be checked (' + String(e && e.message || e).slice(0, 120) + ')');
}
if (problems.length) { console.error('answer has the wrong shape: ' + problems.join('; ')); process.exit(1); }

fs.writeFileSync(dst, JSON.stringify(found, null, 2) + '\n');
