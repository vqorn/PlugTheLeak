import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const bin = new URL('../bin/plugtheleak.js', import.meta.url).pathname;
const run = (...args) => execFileSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } });

test('cli: --demo --json lists subscriptions, overlaps and totals', () => {
  const out = JSON.parse(run('--demo', '--json', '--lang', 'en'));
  assert.equal(out.currency, 'USD');
  assert.ok(out.items.some((i) => i.name === 'Netflix' && i.cadence === 'monthly'));
  assert.ok(out.items.every((i) => i.subscription));
  assert.deepEqual(out.overlaps.map((o) => o.kind).sort(), ['music', 'video']);
  assert.ok(out.totals.yearly > 0);
});

test('cli: reads a file, prints a summary and writes reminders', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ptl-'));
  const csv = join(dir, 'monzo.csv');
  const ics = join(dir, 'r.ics');
  writeFileSync(csv, [
    'Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency',
    'a,03/08/2026,09:00:00,Card payment,Netflix,,Entertainment,-10.99,GBP',
    'b,03/07/2026,09:00:00,Card payment,Netflix,,Entertainment,-10.99,GBP',
    'c,03/06/2026,09:00:00,Card payment,Netflix,,Entertainment,-10.99,GBP',
  ].join('\n'));
  const out = run(csv, '--lang', 'en', '--ics', ics);
  assert.match(out, /Netflix\s+monthly\s+£10\.99/);
  assert.match(out, /£132 a year\./);
  assert.match(readFileSync(ics, 'utf8'), /SUMMARY:Netflix charges £10\.99/);
});

test('cli: missing file and unknown option fail with a message', () => {
  const missing = spawnSync(process.execPath, [bin, 'does-not-exist.csv'], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /file not found/);
  const bad = spawnSync(process.execPath, [bin, '--nope'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
