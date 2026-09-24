#!/usr/bin/env node
/**
 * §11 edge-case suite runner (CI).
 *   node tests/run.mjs [baseUrl]
 * Hits the live server's self-test endpoint, prints a report and exits
 * non-zero on any failure.
 */
const base = process.argv[2] || process.env.BASE_URL || "http://127.0.0.1:3000";

const colour = (s, c) => `\x1b[${c}m${s}\x1b[0m`;
const green = (s) => colour(s, 32), red = (s) => colour(s, 31), dim = (s) => colour(s, 90), bold = (s) => colour(s, 1);

const t0 = Date.now();
console.log(bold(`\nRevBounce — edge-case suite`), dim(`→ ${base}\n`));

let payload;
try {
  const res = await fetch(`${base}/api/v1/meta/selftest`, { cache: "no-store" });
  payload = await res.json();
} catch (e) {
  console.error(red(`Cannot reach ${base}: ${e.message}`));
  process.exit(2);
}

const groups = {};
for (const r of payload.results ?? []) (groups[r.group] ??= []).push(r);

for (const [group, rows] of Object.entries(groups)) {
  console.log(bold(group));
  for (const r of rows) {
    const mark = r.pass ? green("  ✓") : red("  ✗");
    console.log(`${mark} ${r.name} ${dim(`(${r.ms}ms)`)}`);
    console.log(dim(`      ${r.detail}`));
  }
  console.log("");
}

const { total = 0, passed = 0, failed = 0 } = payload;
const summary = `${passed}/${total} passed · ${failed} failed · ${Date.now() - t0}ms`;
console.log(failed === 0 ? green(bold(`ALL GREEN — ${summary}`)) : red(bold(`FAILURES — ${summary}`)));
process.exit(failed === 0 ? 0 : 1);
