import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, parseDate, rowsToTransactions } from '../src/columns.js';
import { parseCsv, detectDelimiter } from '../src/csv.js';
import { detectRecurring, summarize, identify, analyzeDates, findOverlaps } from '../src/detect.js';
import { buildIcs, nextOnOrAfter } from '../src/calendar.js';
import { buildLetter } from '../src/letter.js';
import { sampleCsv } from '../src/sample.js';

const D = (y, m, d) => Date.UTC(y, m - 1, d);
const tx = (date, amount, payee, text = '', creditorId = '') => ({ date, amount, payee, text, creditorId });
const monthly = (n, amount, payee, { day = 3, start = [2025, 10], text = '' } = {}) =>
  Array.from({ length: n }, (_, i) => tx(D(start[0], start[1] + i, day), amount, payee, text));

test('parseAmount handles German, English and odd notations', () => {
  assert.equal(parseAmount('-1.234,56'), -1234.56);
  assert.equal(parseAmount('12,99'), 12.99);
  assert.equal(parseAmount('12,99-'), -12.99);
  assert.equal(parseAmount('-12,99 €'), -12.99);
  assert.equal(parseAmount('12,99 S'), -12.99);
  assert.equal(parseAmount('−9,99'), -9.99);
  assert.equal(parseAmount('-1,234.56', false), -1234.56);
  assert.equal(parseAmount('(5.00)', false), -5);
  assert.ok(Number.isNaN(parseAmount('')));
});

test('parseDate handles common formats', () => {
  assert.equal(parseDate('03.08.26'), D(2026, 8, 3));
  assert.equal(parseDate('03.08.2026'), D(2026, 8, 3));
  assert.equal(parseDate('2026-08-03 10:11:12'), D(2026, 8, 3));
  assert.equal(parseDate('08/03/2026', 'mdy'), D(2026, 8, 3));
  assert.equal(parseDate('03/08/2026', 'dmy'), D(2026, 8, 3));
  assert.equal(parseDate('03 Jun 2026'), D(2026, 6, 3));
  assert.equal(parseDate('3. März 2026'), D(2026, 3, 3));
  assert.equal(parseDate('Jun 3, 2026'), D(2026, 6, 3));
  assert.ok(Number.isNaN(parseDate('Kontostand')));
  assert.ok(Number.isNaN(parseDate('Total 12 items')));
});

test('detectDelimiter ignores preamble lines', () => {
  assert.equal(detectDelimiter('Konto;123\n\nA,B;C;D;E\n1,5;2;3;4'), ';');
  assert.equal(detectDelimiter('a,b,c\n1,2,3\n4,5,6'), ',');
  assert.equal(detectDelimiter('a\tb\tc\n1\t2\t3'), '\t');
});

test('quoted cells with delimiters and newlines', () => {
  assert.deepEqual(parseCsv('"a;b";"c""d"\n"multi\nline";x', ';'), [['a;b', 'c"d'], ['multi\nline', 'x']]);
});

test('finds a monthly subscription and its yearly cost', () => {
  const { items } = detectRecurring(monthly(6, -10.99, 'Spotify AB'));
  assert.equal(items.length, 1);
  assert.equal(items[0].name, 'Spotify');
  assert.equal(items[0].cadence, 'monthly');
  assert.equal(items[0].yearly.toFixed(2), '131.88');
});

test('grocery shopping is not a subscription', () => {
  const noise = [];
  for (let i = 0; i < 40; i++) noise.push(tx(D(2026, 1, 1) + i * 7 * 86400000, -(30 + ((i * 37) % 50)), 'REWE Markt GmbH'));
  const { items } = detectRecurring(noise);
  assert.equal(items.length, 0);
});

test('payments that stopped are marked as ended', () => {
  const data = [...monthly(4, -8.99, 'Disney Plus'), ...monthly(12, -5, 'Other Service GmbH')];
  const { items } = detectRecurring(data);
  const disney = items.find((i) => i.name === 'Disney+');
  assert.equal(disney.active, false);
  assert.equal(items.find((i) => i.name !== 'Disney+').active, true);
});

test('price increases are reported, one-off extras are not', () => {
  const netflix = [...monthly(3, -12.99, 'Netflix'), ...monthly(3, -13.99, 'Netflix', { start: [2026, 1] })];
  const phone = monthly(6, -39.95, 'Mobilfunk Muster GmbH');
  phone[3].amount = -44.94;
  const { items } = detectRecurring([...netflix, ...phone]);
  assert.deepEqual(items.find((i) => i.name === 'Netflix').priceChange, { from: 12.99, to: 13.99 });
  const p = items.find((i) => i.name !== 'Netflix');
  assert.equal(p.priceChange, null);
  assert.equal(p.amount, 39.95);
});

test('yearly and quarterly cadences', () => {
  const data = [
    tx(D(2024, 5, 10), -89.9, 'Versicherung XY', '', 'DE11ZZZ1'),
    tx(D(2025, 5, 12), -89.9, 'Versicherung XY', '', 'DE11ZZZ1'),
    ...[0, 3, 6, 9].map((m) => tx(D(2025, 1 + m, 15), -55.08, 'Rundfunk ARD ZDF DRADIO')),
  ];
  const { items } = detectRecurring(data);
  assert.equal(items.find((i) => i.category === 'insurance').cadence, 'yearly');
  assert.equal(items.find((i) => i.name === 'Rundfunkbeitrag').cadence, 'quarterly');
});

test('PayPal payments are attributed to the real merchant', () => {
  const id = identify(tx(0, -2.99, 'PayPal Europe S.a.r.l. et Cie S.C.A', '1040 PP.4711.PP . Apple Services, Ihr Einkauf bei Apple Services'));
  assert.equal(id.name, 'Apple Services');
  const unknown = identify(tx(0, -5, 'PayPal Europe S.a.r.l. et Cie S.C.A', '1040 PP.4711.PP . Kleiner Laden, Ihr Einkauf bei Kleiner Laden'));
  assert.equal(unknown.name, 'Kleiner Laden');
});

test('Google Pay / Apple Pay card payments are not Google or Apple', () => {
  assert.equal(identify(tx(0, -20, 'REWE Markt', 'Kartenzahlung Google Pay')).known, null);
});

test('a single known subscription charge shows up as "maybe"', () => {
  const { items, maybe } = detectRecurring([tx(D(2026, 5, 1), -89.9, 'Amazon EU S.a r.l.', 'Amazon Prime Jahresmitgliedschaft')]);
  assert.equal(items.length, 0);
  assert.equal(maybe[0].name, 'Amazon Prime');
});

test('analyzeDates tolerates one missed month', () => {
  const dates = [D(2026, 1, 3), D(2026, 2, 3), D(2026, 3, 3), D(2026, 5, 3), D(2026, 6, 3)];
  assert.equal(analyzeDates(dates).cadence.id, 'monthly');
});

test('cancellation letter (de + en)', () => {
  const de = buildLetter({ lang: 'de', provider: 'Netflix', name: 'Max', address: 'Weg 1\n10115 Berlin', customerNo: 'A1', date: D(2026, 9, 25) });
  assert.match(de.body, /Berlin, 25\.09\.2026/);
  assert.match(de.body, /Kunden-\/Vertragsnummer A1/);
  assert.match(de.body, /SEPA-Lastschriftmandat/);
  const en = buildLetter({ lang: 'en', provider: 'Netflix', revokeMandate: false });
  assert.match(en.body, /I hereby cancel/);
  assert.doesNotMatch(en.body, /direct debit/);
});

test('German demo data end to end', () => {
  const { transactions, currency } = rowsToTransactions(parseCsv(sampleCsv(D(2026, 9, 25), 'de')));
  assert.equal(currency, 'EUR');
  const result = detectRecurring(transactions);
  const names = result.items.map((i) => i.name).sort();
  assert.deepEqual(names, [
    'Audible', 'ChatGPT', 'Disney+', 'Google One', 'Hausverwaltung Schmidt', 'Joyn', 'McFit', 'Netflix',
    'Rundfunkbeitrag', 'Spotify', 'Stadtwerke Musterstadt', 'Telekom', 'iCloud+',
  ]);
  assert.deepEqual(result.maybe.map((m) => m.name), ['Amazon Prime']);
  const joyn = result.items.find((i) => i.name === 'Joyn');
  assert.ok(joyn.trial && joyn.isNew);
  assert.deepEqual(findOverlaps(result.items).map((o) => o.kind), ['cloud']);
  const s = summarize(result.items);
  assert.equal(s.priceIncreases, 1);
});

test('American demo data end to end', () => {
  const { transactions, currency } = rowsToTransactions(parseCsv(sampleCsv(D(2026, 9, 25), 'en')));
  assert.equal(currency, 'USD');
  const result = detectRecurring(transactions);
  const names = result.items.map((i) => i.name).sort();
  assert.deepEqual(names, [
    'Apple Music', 'Audible', 'ChatGPT', 'Con Edison', 'Disney+', 'Hulu', 'Max', 'Netflix',
    'Oak Street Property Management', 'Peacock', 'Planet Fitness', 'Spotify', 'Verizon',
  ]);
  assert.equal(result.items.find((i) => i.name === 'Netflix').amount, 17.99);
  assert.ok(result.items.find((i) => i.name === 'Peacock').trial);
  assert.deepEqual(findOverlaps(result.items).map((o) => o.kind).sort(), ['music', 'video']);
});

test('overlaps: two music services, but two video services are fine', () => {
  const data = [
    ...monthly(6, -10.99, 'Spotify AB'),
    ...monthly(6, -10.99, 'APPLE.COM/BILL APPLE MUSIC'),
    ...monthly(6, -13.99, 'Netflix'),
    ...monthly(6, -7.99, 'Hulu'),
  ];
  const overlaps = findOverlaps(detectRecurring(data).items);
  assert.equal(overlaps.length, 1);
  assert.equal(overlaps[0].kind, 'music');
  assert.deepEqual(overlaps[0].names.sort(), ['Apple Music', 'Spotify']);
});

test('trial charge before a subscription is flagged', () => {
  const data = [tx(D(2026, 1, 5), -1, 'Peacock TV'), ...monthly(4, -7.99, 'Peacock TV', { start: [2026, 2], day: 5 })];
  const item = detectRecurring(data).items[0];
  assert.deepEqual(item.trial, { date: D(2026, 1, 5), amount: 1 });
});

test('calendar file: repeating events with alarms', () => {
  const item = {
    id: 'k:Netflix|1399|monthly', name: 'Netflix, Inc.', cadence: 'monthly', amount: 13.99, yearly: 167.88,
    next: D(2026, 8, 3),
  };
  const ics = buildIcs([item, { ...item, id: 'y', name: 'Prime', cadence: 'yearly', next: D(2027, 5, 1) }], {
    now: D(2026, 9, 25), money: (n) => `$${n.toFixed(2)}`,
  });
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(ics, /DTSTART;VALUE=DATE:20261003/, 'rolled forward past today');
  assert.match(ics, /RRULE:FREQ=MONTHLY\r\n/);
  assert.match(ics, /RRULE:FREQ=YEARLY\r\n/);
  assert.match(ics, /TRIGGER:-P3D/);
  assert.match(ics, /TRIGGER:-P7D/);
  assert.match(ics, /SUMMARY:Netflix\\, Inc\. charges \$13\.99/);
  for (const line of ics.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(nextOnOrAfter(item, D(2026, 9, 25)), D(2026, 10, 3));
});
