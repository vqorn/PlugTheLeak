#!/usr/bin/env node
// PlugTheLeak on the command line: npx plugtheleak statement.csv
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { decodeBytes, parseCsv } from '../src/csv.js';
import { rowsToTransactions } from '../src/columns.js';
import { detectRecurring, summarize, findOverlaps } from '../src/detect.js';
import { buildIcs } from '../src/calendar.js';
import { sampleCsv } from '../src/sample.js';
import { STRINGS } from '../src/i18n.js';

const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const HELP = `
  PlugTheLeak ${VERSION}
  Find every subscription in your bank statement. Runs locally, nothing is uploaded.

  Usage
    npx plugtheleak <statement.csv> [more.csv ...] [options]

  Options
    --all              Show all recurring payments, not only subscriptions
    --currency <CODE>  Force a currency, e.g. USD, GBP, EUR
    --lang <en|de>     Output language (default: from your system)
    --ics <file>       Write calendar reminders for every active payment
    --json             Print machine-readable JSON
    --demo             Try it with sample data
    --no-color         Disable colours
    -h, --help         Show this help
    -v, --version      Show the version

  Examples
    npx plugtheleak ~/Downloads/chase.csv
    npx plugtheleak checking.csv card.csv --ics reminders.ics
    npx plugtheleak --demo

  Web version: https://vqorn.github.io/PlugTheLeak/
`;

function parseArgs(argv) {
  const opts = { files: [], all: false, json: false, demo: false, color: undefined, lang: null, currency: null, ics: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') opts.help = true;
    else if (a === '-v' || a === '--version') opts.version = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--demo') opts.demo = true;
    else if (a === '--no-color') opts.color = false;
    else if (a === '--lang') opts.lang = argv[++i];
    else if (a === '--currency') opts.currency = (argv[++i] || '').toUpperCase();
    else if (a === '--ics') opts.ics = argv[++i];
    else if (a.startsWith('-')) throw new Error(`Unknown option: ${a}`);
    else opts.files.push(a);
  }
  return opts;
}

function systemLang() {
  const env = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale;
  return /^de/i.test(env || '') ? 'de' : 'en';
}

// ---------- Terminal styling ----------

let useColor = true;
const paint = (code) => (s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

const visibleLength = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '').length;
const padEnd = (s, n) => s + ' '.repeat(Math.max(0, n - visibleLength(s)));
const padStart = (s, n) => ' '.repeat(Math.max(0, n - visibleLength(s))) + s;
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(e.message);
    console.error('Run with --help for usage.');
    process.exit(2);
  }
  if (opts.version) return console.log(VERSION);
  if (opts.help || (!opts.files.length && !opts.demo)) {
    console.log(HELP);
    process.exit(opts.help ? 0 : 1);
  }
  useColor = opts.color ?? (process.stdout.isTTY && !process.env.NO_COLOR);
  const lang = opts.lang === 'de' || opts.lang === 'en' ? opts.lang : systemLang();
  const s = STRINGS[lang];

  // ---------- Read ----------
  const transactions = [];
  let currency = null;
  const seen = new Set();
  const sources = opts.demo ? [{ name: 'demo', text: sampleCsv(Date.now(), lang) }] : opts.files.map((f) => {
    try {
      return { name: basename(f), text: decodeBytes(readFileSync(f)) };
    } catch (e) {
      console.error(red(`Cannot read ${f}: ${e.code === 'ENOENT' ? 'file not found' : e.message}`));
      process.exit(1);
    }
  });
  for (const src of sources) {
    const { transactions: txs, error, currency: c } = rowsToTransactions(parseCsv(src.text));
    if (error) console.error(yellow(`${src.name}: ${error === 'no-header' ? s.errorNoHeader : s.errorNoRows}`));
    if (c) seen.add(c);
    currency = currency || c;
    transactions.push(...txs);
  }
  if (!transactions.length) process.exit(1);
  if (seen.size > 1) console.error(yellow(s.mixedCurrencies([...seen].join(', '))));
  currency = opts.currency || currency || (lang === 'de' ? 'EUR' : 'USD');

  const locale = lang === 'de' ? 'de-DE' : 'en-US';
  const money = (n, digits = 2) => new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
  const date = (ms) => new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  const result = detectRecurring(transactions);
  const shown = result.items.filter((i) => opts.all || i.subscription);
  const active = shown.filter((i) => i.active);
  const ended = shown.filter((i) => !i.active);
  const sum = summarize(result.items);
  const overlaps = findOverlaps(active);

  if (opts.ics) {
    const reminders = active.filter((i) => i.category !== 'broadcast');
    writeFileSync(opts.ics, buildIcs(reminders, { lang, money }));
  }

  // ---------- JSON ----------
  if (opts.json) {
    const clean = (i) => ({
      name: i.name, category: i.category, cadence: i.cadence, amount: +i.amount.toFixed(2), yearly: +i.yearly.toFixed(2),
      first: new Date(i.first).toISOString().slice(0, 10), last: new Date(i.last).toISOString().slice(0, 10),
      next: new Date(i.next).toISOString().slice(0, 10), active: i.active, subscription: i.subscription,
      priceChange: i.priceChange, trial: i.trial ? { ...i.trial, date: new Date(i.trial.date).toISOString().slice(0, 10) } : null,
      isNew: Boolean(i.isNew), variable: i.variable, count: i.count,
    });
    console.log(JSON.stringify({
      currency,
      range: { from: new Date(result.range.start).toISOString().slice(0, 10), to: new Date(result.range.end).toISOString().slice(0, 10) },
      transactions: result.count,
      totals: { yearly: +(opts.all ? sum.yearly : sum.subsYearly).toFixed(2), monthly: +((opts.all ? sum.yearly : sum.subsYearly) / 12).toFixed(2) },
      items: shown.map(clean),
      maybe: result.maybe.map((m) => ({ name: m.name, amount: m.amount, last: new Date(m.last).toISOString().slice(0, 10) })),
      overlaps: overlaps.map((o) => ({ kind: o.kind, names: o.names, yearly: +o.yearly.toFixed(2) })),
    }, null, 2));
    return;
  }

  // ---------- Pretty ----------
  const out = [];
  const total = opts.all ? sum.yearly : sum.subsYearly;
  const count = opts.all ? sum.activeCount : sum.subsCount;
  out.push('');
  out.push(`  ${bold('PlugTheLeak')}  ${dim(s.summaryRange(date(result.range.start), date(result.range.end), result.count))}`);
  out.push('');
  out.push(`  ${dim(opts.all ? s.costAll : s.costSubs)}`);
  out.push(`  ${bold(red(money(total, 0)))} ${bold(s.perYearLong)}`);
  out.push(`  ${s.monthlyLine(money(total / 12), count, !opts.all)}`);
  if (!opts.all && sum.yearly > sum.subsYearly) out.push(`  ${dim(s.summaryAll(money(sum.yearly)))}`);

  const insights = [];
  for (const o of overlaps) insights.push(`${s.overlap(o.names.length, s.kinds[o.kind] || o.kind, o.names.join(', '))} ${dim(s.overlapCost(money(o.yearly)))}`);
  for (const i of active.filter((x) => x.trial)) insights.push(s.trialLine(i.name, money(i.trial.amount), money(i.amount), s.cadence[i.cadence]));
  for (const i of active.filter((x) => x.isNew && !x.trial)) insights.push(s.newLine(i.name, date(i.first)));
  for (const i of active.filter((x) => x.priceChange)) insights.push(s.priceLine(i.name, money(i.priceChange.from), money(i.priceChange.to)));
  if (insights.length) {
    out.push('', `  ${bold(yellow(s.insightsTitle))}`);
    for (const line of insights) out.push(`  ${yellow('•')} ${line}`);
  }

  const table = (title, list) => {
    if (!list.length) return;
    const nameW = Math.min(28, Math.max(...list.map((i) => i.name.length), 4));
    const cadW = Math.max(...list.map((i) => s.cadence[i.cadence].length));
    out.push('', `  ${bold(title)}`);
    for (const i of list) {
      const flags = [];
      if (i.priceChange) flags.push(yellow('↑'));
      if (i.trial) flags.push(yellow(s.trialTag));
      else if (i.isNew) flags.push(cyan(s.newTag));
      const amount = `${i.variable ? '~' : ''}${money(i.amount)}`;
      out.push(`  ${padEnd(truncate(i.name, 28), nameW)}  ${dim(padEnd(s.cadence[i.cadence], cadW))}  ${padStart(amount, 11)}  ${padStart(dim(money(i.yearly) + s.perYearShort), 16)}  ${flags.join(' ')}`);
    }
  };
  table(s.sectionActive, active);
  if (result.maybe.length) {
    out.push('', `  ${bold(s.sectionMaybe)}`);
    for (const m of result.maybe) out.push(`  ${padEnd(m.name, 28)}  ${padStart(money(m.amount), 11)}  ${dim(s.onlyOnce(date(m.last)))}`);
  }
  if (ended.length) out.push('', `  ${dim(`${s.sectionEnded}: ${ended.map((i) => i.name).join(', ')}`)}`);

  out.push('');
  if (opts.ics) out.push(`  ${green('✓')} ${opts.ics}: ${s.remindHint}`);
  out.push(`  ${dim(s.cancel + ' → https://vqorn.github.io/PlugTheLeak/')}`);
  out.push('');
  console.log(out.join('\n'));
}

main();
