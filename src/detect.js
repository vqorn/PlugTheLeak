// Recurring payment detection.
import { findKnownMerchant, INTERMEDIARIES, SUBSCRIPTION_CATEGORIES } from './merchants.js';

const DAY = 86400000;

export const CADENCES = [
  { id: 'weekly', days: 7, tol: 2, perYear: 52, min: 4 },
  { id: 'biweekly', days: 14, tol: 3, perYear: 26, min: 3 },
  { id: 'monthly', days: 30.44, tol: 6, perYear: 12, min: 3 },
  { id: 'bimonthly', days: 61, tol: 9, perYear: 6, min: 2 },
  { id: 'quarterly', days: 91.3, tol: 12, perYear: 4, min: 2 },
  { id: 'halfyearly', days: 182.6, tol: 20, perYear: 2, min: 2 },
  { id: 'yearly', days: 365.25, tol: 25, perYear: 1, min: 2 },
];

const MONTHS = { monthly: 1, bimonthly: 2, quarterly: 3, halfyearly: 6, yearly: 12 };

// One period after `ms`, in calendar months where that is what the cadence means.
export function addCadence(ms, cadenceId) {
  const months = MONTHS[cadenceId];
  if (!months) return ms + (cadenceId === 'biweekly' ? 14 : 7) * DAY;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate());
}

const LEGAL_FORMS =
  /\b(gmbh|mbh|ag|se|kg|kgaa|co|ohg|ug|ev|e\.v|ltd|limited|inc|llc|sarl|s\.a\.r\.l|sca|s\.c\.a|et cie|bv|b\.v|nv|ab|sa|s\.a|plc|europe|deutschland|germany|holding|services|payments|international|online|de|com)\b/g;

export function cleanName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9äöüß&+ ]/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(/\b\w*\d{3,}\w*\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 1)
    .slice(0, 3)
    .join(' ');
}

export function prettyName(s) {
  let out = (s || '')
    .replace(/\b\w*\d{5,}\w*\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (out && out === out.toUpperCase()) {
    out = out.toLowerCase().replace(/(^|[\s\-/.(])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
  }
  return out.length > 42 ? out.slice(0, 40).trim() + '…' : out;
}

const PURCHASE_AT = /(?:Ihr Einkauf bei|Your purchase at|purchase from|Zahlung an|payment to)\s+(.+?)(?=\s+(?:rent|for|memo|conf|ref)\b|[,;]|$)/i;

// Decide who was actually paid, and a key to group payments to the same party.
export function identify(tx) {
  const payee = tx.payee || '';
  const text = tx.text || '';
  const viaIntermediary = INTERMEDIARIES.test(payee) || (!payee && INTERMEDIARIES.test(text));

  // Payee and text together, so "Amazon EU" + "Prime Jahresmitgliedschaft" hits
  // the specific Amazon Prime entry before the broad Amazon one.
  const known = findKnownMerchant(viaIntermediary ? text : `${payee} ${text}`);
  let name = '';
  if (known && !known.generic) {
    name = known.name;
  } else if (viaIntermediary) {
    const m = PURCHASE_AT.exec(text);
    const via = (INTERMEDIARIES.exec(payee || text) || ['Zahlung'])[0];
    name = m ? prettyName(m[1]) : `${via[0].toUpperCase()}${via.slice(1).toLowerCase()}: ${prettyName(cleanName(text)) || '?'}`;
  } else {
    name = prettyName(payee) || prettyName(text.split(/\s{2,}|,|\//)[0]) || '?';
  }

  let key;
  if (known && !known.generic) key = 'k:' + known.name;
  else if (tx.creditorId) key = 'c:' + tx.creditorId.toUpperCase();
  else key = 'n:' + (cleanName(name) || cleanName(text) || name);

  return { key, name, known };
}

// Most frequent of the recent amounts, falling back to the latest one.
function typicalAmount(recent) {
  const counts = new Map();
  for (const a of recent) counts.set(a.toFixed(2), (counts.get(a.toFixed(2)) || 0) + 1);
  let best = recent[recent.length - 1];
  let bestCount = 1;
  for (const [a, c] of counts) if (c > bestCount) [best, bestCount] = [+a, c];
  return best;
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Returns the best matching cadence for a list of payment dates, or null.
export function analyzeDates(dates, { lenient = false } = {}) {
  const days = [...new Set(dates)].sort((a, b) => a - b);
  if (days.length < 2) return null;
  const intervals = [];
  for (let i = 1; i < days.length; i++) intervals.push((days[i] - days[i - 1]) / DAY);
  const med = median(intervals);
  const cadence = CADENCES.find((c) => Math.abs(med - c.days) <= c.tol);
  if (!cadence) return null;
  const min = lenient ? Math.min(cadence.min, 2) : cadence.min;
  if (days.length < min) return null;

  let fit = 0;
  for (const iv of intervals) {
    if (Math.abs(iv - cadence.days) <= cadence.tol) fit += 1;
    else if (Math.abs(iv - 2 * cadence.days) <= cadence.tol * 2) fit += 0.5; // one missed payment
  }
  const score = fit / intervals.length;
  if (score < 0.66) return null;
  return { cadence, score, count: days.length };
}

// Group amounts that are "the same price" (tolerating small price changes).
export function clusterByAmount(txs) {
  const sorted = [...txs].sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
  const clusters = [];
  for (const tx of sorted) {
    const a = Math.abs(tx.amount);
    const last = clusters[clusters.length - 1];
    if (last && a <= last.min * 1.25 + 1) last.items.push(tx);
    else clusters.push({ min: a, items: [tx] });
  }
  return clusters.map((c) => c.items);
}

// Real subscriptions charge the exact same price. Grocery runs do not, which
// keeps weekly supermarket trips from showing up as a "weekly subscription".
export function stableAmounts(txs) {
  const amounts = [...txs].sort((a, b) => a.date - b.date).map((t) => Math.abs(t.amount));
  let same = 0;
  for (let i = 1; i < amounts.length; i++) {
    if (Math.abs(amounts[i] - amounts[i - 1]) <= Math.max(0.02 * amounts[i], 0.01)) same++;
  }
  return same / (amounts.length - 1) >= 0.6;
}

function dedupe(transactions) {
  const seen = new Set();
  const out = [];
  for (const t of transactions) {
    const k = `${t.date}|${t.amount}|${t.payee}|${t.text}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function buildItem(group, txs, analysis, end, variable) {
  const sorted = [...txs].sort((a, b) => a.date - b.date);
  const { cadence } = analysis;
  const last = sorted[sorted.length - 1];
  const first = sorted[0];
  const amounts = sorted.map((t) => Math.abs(t.amount));
  const recent = amounts.slice(-3);
  const amount = variable ? recent.reduce((s, a) => s + a, 0) / recent.length : typicalAmount(recent);
  const fluctuating = variable || !stableAmounts(sorted);
  // A price increase is a lasting step: the first two and the last two charges
  // agree with each other but not across. One-off extras on a phone bill are not.
  let priceChange = null;
  if (!fluctuating && amounts.length >= 3) {
    const eq = (a, b) => Math.abs(a - b) < 0.01;
    const [f1, f2] = amounts;
    const [l2, l1] = amounts.slice(-2);
    if (eq(f1, f2) && eq(l1, l2) && l1 - f1 >= 0.5 && l1 > f1 * 1.02) priceChange = { from: f1, to: l1 };
  }
  const next = addCadence(last.date, cadence.id);
  const active = last.date + cadence.days * 1.5 * DAY + 7 * DAY >= end;
  const category = group.known ? group.known.cat : 'other';
  const confidence = analysis.score >= 0.95 && (analysis.count >= 3 || group.known) ? 'high' : 'medium';
  return {
    id: `${group.key}|${Math.round(amount * 100)}|${cadence.id}`,
    name: group.name,
    category,
    kind: (group.known && group.known.kind) || null,
    subscription: SUBSCRIPTION_CATEGORIES.has(category),
    url: group.known && !group.known.generic ? group.known.url || '' : '',
    cadence: cadence.id,
    perYear: cadence.perYear,
    amount,
    priceChange,
    variable: fluctuating,
    count: analysis.count,
    first: first.date,
    last: last.date,
    next,
    active,
    yearly: amount * cadence.perYear,
    monthly: (amount * cadence.perYear) / 12,
    confidence,
    directDebit: Boolean(group.creditorId),
    transactions: sorted.map((t) => ({ date: t.date, amount: t.amount, text: t.text })),
  };
}

export function detectRecurring(transactions) {
  const txs = dedupe(transactions);
  if (!txs.length) return { items: [], maybe: [], range: null, count: 0 };
  let start = Infinity;
  let end = -Infinity;
  for (const t of txs) {
    start = Math.min(start, t.date);
    end = Math.max(end, t.date);
  }

  const groups = new Map();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const id = identify(t);
    let g = groups.get(id.key);
    if (!g) {
      g = { key: id.key, name: id.name, known: id.known, creditorId: t.creditorId, txs: [] };
      groups.set(id.key, g);
    }
    g.txs.push(t);
  }

  const items = [];
  const maybe = [];
  for (const g of groups.values()) {
    const knownSub = g.known && !g.known.generic && g.known.cat !== 'shopping';
    const found = [];
    for (const cluster of clusterByAmount(g.txs)) {
      if (cluster.length < 2) continue;
      const trusted = knownSub || Boolean(g.creditorId);
      if (!trusted && !stableAmounts(cluster)) continue;
      const a = analyzeDates(cluster.map((t) => t.date), { lenient: trusted });
      if (a) found.push(buildItem(g, cluster, a, end, false));
    }
    // Utilities and phone bills vary every month: accept the whole group if it
    // is a direct debit or a known provider and the dates alone are regular.
    if (!found.length && g.txs.length >= 3 && (g.creditorId || (g.known && g.known.cat !== 'shopping'))) {
      const a = analyzeDates(g.txs.map((t) => t.date));
      if (a) found.push(buildItem(g, g.txs, a, end, true));
    }
    for (const item of found) markTrial(item, g.txs);
    items.push(...found);
    if (!found.length && knownSub && SUBSCRIPTION_CATEGORIES.has(g.known.cat)) {
      const lastTx = g.txs.reduce((a, b) => (b.date > a.date ? b : a));
      maybe.push({
        id: `${g.key}|maybe`,
        name: g.name,
        category: g.known.cat,
        url: g.known.url || '',
        amount: Math.abs(lastTx.amount),
        last: lastTx.date,
        count: g.txs.length,
      });
    }
  }

  // "New" only means something if the statement reaches back well before it.
  if (end - start >= 120 * DAY) {
    for (const item of items) {
      item.isNew = item.active && item.first - start > 60 * DAY && end - item.first <= 75 * DAY;
    }
  }

  items.sort((a, b) => b.yearly - a.yearly);
  maybe.sort((a, b) => b.amount - a.amount);
  return { items, maybe, range: { start, end }, count: txs.length };
}

// A tiny charge shortly before a subscription starts is a paid trial or a card
// check. Either way, the user signed up for a trial that is now a real plan.
function markTrial(item, groupTxs) {
  const inSeries = new Set(item.transactions.map((t) => t.date));
  const trial = groupTxs
    .filter((t) => !inSeries.has(t.date) && Math.abs(t.amount) <= 1.5 && Math.abs(t.amount) < item.amount * 0.3)
    .filter((t) => t.date < item.first && item.first - t.date <= 45 * DAY)
    .sort((a, b) => b.date - a.date)[0];
  item.trial = trial ? { date: trial.date, amount: Math.abs(trial.amount) } : null;
}

// Several services doing the same job. Video gets a higher bar, since two
// streaming services is normal and three starts to add up.
const OVERLAP_MIN = { video: 3 };

export function findOverlaps(items) {
  const byKind = new Map();
  for (const i of items) {
    if (!i.active || !i.kind) continue;
    if (!byKind.has(i.kind)) byKind.set(i.kind, []);
    byKind.get(i.kind).push(i);
  }
  const out = [];
  for (const [kind, list] of byKind) {
    const names = [...new Set(list.map((i) => i.name))];
    if (names.length < (OVERLAP_MIN[kind] || 2)) continue;
    out.push({ kind, names, ids: list.map((i) => i.id), yearly: list.reduce((a, i) => a + i.yearly, 0) });
  }
  return out.sort((a, b) => b.yearly - a.yearly);
}

export function summarize(items) {
  const active = items.filter((i) => i.active);
  const subs = active.filter((i) => i.subscription);
  const sum = (list, f) => list.reduce((s, i) => s + i[f], 0);
  return {
    activeCount: active.length,
    monthly: sum(active, 'monthly'),
    yearly: sum(active, 'yearly'),
    subsCount: subs.length,
    subsYearly: sum(subs, 'yearly'),
    priceIncreases: active.filter((i) => i.priceChange).length,
  };
}
