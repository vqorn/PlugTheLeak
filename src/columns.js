// Turn parsed CSV rows from any bank into a common transaction shape:
// { date: ms (UTC midnight), amount: number (negative = money out), payee, text, creditorId }

export function normHeader(h) {
  return h
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

// Aliases in priority order. Matching is exact on the normalized header so that
// e.g. "Lastschrift Ursprungsbetrag" never wins over "Betrag".
const ALIASES = {
  date: [
    'buchungstag', 'buchungsdatum', 'buchung', 'bookingdate', 'datum', 'date',
    'transactiondate', 'transdate', 'postingdate', 'posteddate', 'postdate',
    'completeddate', 'starteddate', 'valutadatum', 'valuta',
    'wertstellung', 'wertstellungsdatum', 'wertstellungvaluta', 'wert',
  ],
  amount: [
    'betrag', 'betrageur', 'umsatzineur', 'umsatz', 'amount', 'amounteur',
    'amountgbp', 'amountusd', 'amountchf', 'transactionamount',
    'betragineur', 'brutto', 'value',
  ],
  debit: ['soll', 'sollbetrag', 'debit', 'debitamount', 'moneyout', 'paidout', 'withdrawals', 'belastung', 'ausgang'],
  credit: ['haben', 'habenbetrag', 'credit', 'creditamount', 'moneyin', 'paidin', 'deposits', 'gutschrift', 'eingang'],
  payee: [
    'beguenstigterzahlungspflichtiger', 'zahlungsempfaengerin', 'zahlungsempfaenger',
    'auftraggeberempfaenger', 'beguenstigterauftraggeber', 'namezahlungsbeteiligter',
    'empfaenger', 'beguenstigter', 'partnername', 'payee', 'name', 'counterparty',
    'merchant', 'merchantname', 'auftraggeber',
  ],
  payer: ['zahlungspflichtiger', 'zahlungspflichtige'],
  purpose: [
    'verwendungszweck', 'paymentreference', 'reference', 'beschreibung', 'description',
    'transactiondescription', 'originaldescription',
    'details', 'memo', 'buchungstext', 'vorgang', 'umsatzart', 'umsatztyp', 'type',
    'transactiontype', 'buchungsinformation', 'info',
  ],
  creditorId: ['glaeubigerid', 'glaeubigeridentifikation', 'creditorid', 'glaeubiger'],
  currency: ['waehrung', 'currency', 'wahrung'],
};

const TEXT_FIELDS = new Set(['purpose']);

export function mapColumns(header) {
  const norm = header.map(normHeader);
  const map = {};
  const used = new Set();
  for (const [field, aliases] of Object.entries(ALIASES)) {
    if (TEXT_FIELDS.has(field)) {
      // Keep every text column: Sparkasse splits type and purpose, Comdirect
      // hides the payee inside "Buchungstext".
      const cols = [];
      for (const alias of aliases) {
        norm.forEach((h, i) => {
          if (h === alias && !used.has(i)) {
            cols.push(i);
            used.add(i);
          }
        });
      }
      if (cols.length) map[field] = cols;
      continue;
    }
    for (const alias of aliases) {
      const i = norm.findIndex((h, idx) => h === alias && !used.has(idx));
      if (i !== -1) {
        map[field] = i;
        used.add(i);
        break;
      }
    }
  }
  return map;
}

// The header is the first row that has at least a date and an amount column.
// Everything above it is preamble (account number, date range, balance).
export function findHeader(rows) {
  for (let r = 0; r < Math.min(rows.length, 40); r++) {
    const map = mapColumns(rows[r]);
    const hasAmount = map.amount !== undefined || map.debit !== undefined;
    if (map.date !== undefined && hasAmount) return { index: r, map };
  }
  return null;
}

export function detectDecimalComma(values) {
  let comma = 0;
  let dot = 0;
  for (const v of values) {
    if (/,\d{1,2}(?!\d)/.test(v)) comma++;
    else if (/\.\d{1,2}(?!\d)/.test(v)) dot++;
  }
  return comma >= dot;
}

export function parseAmount(raw, decimalComma = true) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  if (!s) return NaN;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) sign = -1;
  if (/-\s*$/.test(s) || /\sS$/.test(s)) sign = -1;
  if (/^[^\d]*-/.test(s) || /^[^\d]*−/.test(s)) sign = -1;
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return NaN;
  if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? sign * n : NaN;
}

// Returns 'dmy' or 'mdy' for slash dates. Europe wins unless the data proves otherwise.
// Returns 'dmy' or 'mdy' for slash dates. Proof in the data wins; otherwise the
// fallback (US dollar files are month-first, everyone else day-first).
export function detectDateOrder(values, fallback = 'dmy') {
  for (const v of values) {
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}/.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) return 'dmy';
    if (+m[2] > 12) return 'mdy';
  }
  return fallback;
}

const CODES = { usd: 'USD', gbp: 'GBP', eur: 'EUR', chf: 'CHF', cad: 'CAD', aud: 'AUD', nzd: 'NZD', sek: 'SEK', nok: 'NOK', dkk: 'DKK', pln: 'PLN', czk: 'CZK' };

// Best guess at the file's currency, or null if nothing gives it away.
export function detectCurrency({ headers = [], currencyValues = [], amountValues = [], textValues = [] }) {
  const count = new Map();
  const vote = (c, w = 1) => c && count.set(c, (count.get(c) || 0) + w);
  for (const h of headers) {
    const n = normHeader(h);
    for (const [code, c] of Object.entries(CODES)) if (n.endsWith(code) || n.includes(`in${code}`)) vote(c, 50);
    if (/€/.test(h)) vote('EUR', 50);
    if (/£/.test(h)) vote('GBP', 50);
    if (/\$/.test(h)) vote('USD', 50);
  }
  for (const v of currencyValues) vote(CODES[(v || '').trim().toLowerCase()]);
  for (const v of amountValues) {
    if (/€/.test(v)) vote('EUR');
    else if (/£/.test(v)) vote('GBP');
    else if (/\$/.test(v)) vote('USD');
  }
  for (const v of textValues) {
    const m = /(?:^|\s)(EUR|GBP|USD|CHF|CAD|AUD)(?:\s|$)/.exec(v);
    if (m) vote(m[1], 0.2);
  }
  let best = null;
  let bestN = 0;
  for (const [c, n] of count) if (n > bestN) [best, bestN] = [c, n];
  return best;
}

const MONTH_NAMES = {
  jan: 1, feb: 2, mar: 3, mär: 3, mae: 3, apr: 4, may: 5, mai: 5, jun: 6, jul: 7, aug: 8,
  sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, dez: 12,
};

function monthFromName(name) {
  return MONTH_NAMES[name.toLowerCase().slice(0, 3)] || MONTH_NAMES[name.toLowerCase().slice(0, 3).replace('ä', 'ae')];
}

export function parseDate(raw, order = 'dmy') {
  if (!raw) return NaN;
  const s = String(raw).trim();
  let y;
  let mo;
  let d;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) {
    [, y, mo, d] = m;
  } else if ((m = /^(\d{1,2})\.?\s+(\p{L}{3,})\.?\s+(\d{2,4})/u.exec(s)) && monthFromName(m[2])) {
    // "03 Jun 2026", "3. März 2026"
    [, d, , y] = m;
    mo = monthFromName(m[2]);
  } else if ((m = /^(\p{L}{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/u.exec(s)) && monthFromName(m[1])) {
    // "Jun 3, 2026"
    [, , d, y] = m;
    mo = monthFromName(m[1]);
  } else if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/.exec(s))) {
    const slash = s.includes('/');
    if (slash && order === 'mdy') [, mo, d, y] = m;
    else [, d, mo, y] = m;
  } else {
    return NaN;
  }
  y = +y;
  if (y < 100) y += 2000;
  mo = +mo;
  d = +d;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return NaN;
  return Date.UTC(y, mo - 1, d);
}

// Comdirect/Commerzbank have no payee column; the name is inside the text.
const EMBEDDED_PAYEE =
  /(?:Empfänger|Auftraggeber|Zahlungsempfänger|Begünstigter)\s*:\s*(.+?)(?=\s+(?:Kto\/IBAN|IBAN|BLZ\/BIC|BIC|Buchungstext|Ref\.|Verwendungszweck|Mandat|Gläubiger)\b|\s*$)/i;

export function extractEmbeddedPayee(text) {
  const m = EMBEDDED_PAYEE.exec(text || '');
  return m ? m[1].trim() : '';
}

const LOOKS_DATE = /^(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{1,2}\.?\s+\p{L}{3,}\.?\s+\d{2,4}|\p{L}{3,}\.?\s+\d{1,2},?\s+\d{4})/u;
const LOOKS_AMOUNT = /^[-−(+]?\s*[$£€]?\s*[-−]?\d[\d.,\s]*\)?\s*(€|EUR|GBP|USD)?$/;

// Some banks (Wells Fargo, HSBC UK) export without a header row. Work out the
// columns from what the cells look like: a date, a number, and the longest text.
export function inferHeaderless(rows) {
  const sample = rows.filter((r) => r.length >= 3).slice(0, 50);
  if (sample.length < 2) return null;
  const width = Math.max(...sample.map((r) => r.length));
  const share = (col, re) => sample.filter((r) => re.test((r[col] || '').trim())).length / sample.length;
  let date = -1;
  for (let c = 0; c < width; c++) if (share(c, LOOKS_DATE) >= 0.8) { date = c; break; }
  if (date === -1) return null;
  let amount = -1;
  for (let c = 0; c < width; c++) {
    if (c !== date && share(c, LOOKS_AMOUNT) >= 0.8 && share(c, LOOKS_DATE) < 0.5) { amount = c; break; }
  }
  if (amount === -1) return null;
  let text = -1;
  let longest = 0;
  for (let c = 0; c < width; c++) {
    if (c === date || c === amount) continue;
    const avg = sample.reduce((n, r) => n + (r[c] || '').length, 0) / sample.length;
    if (avg > longest) [text, longest] = [c, avg];
  }
  return { index: -1, map: { date, amount, purpose: text === -1 ? [] : [text] } };
}

export function rowsToTransactions(rows) {
  const header = findHeader(rows) || inferHeaderless(rows);
  if (!header) return { transactions: [], error: 'no-header', currency: null };
  const { index, map } = header;
  const body = rows.slice(index + 1).filter((r) => r.length > 1 && LOOKS_DATE.test((r[map.date] || '').trim()));

  const amountCols = [map.amount, map.debit, map.credit].filter((c) => c !== undefined);
  const amountValues = body.flatMap((r) => amountCols.map((c) => r[c] || ''));
  const decimalComma = detectDecimalComma(amountValues);
  const currency = detectCurrency({
    headers: index >= 0 ? rows[index] : [],
    currencyValues: map.currency !== undefined ? body.map((r) => r[map.currency]) : [],
    amountValues,
    textValues: body.slice(0, 200).map((r) => (map.purpose || []).map((c) => r[c] || '').join(' ')),
  });
  const dateOrder = detectDateOrder(body.map((r) => r[map.date] || ''), currency === 'USD' ? 'mdy' : 'dmy');
  // Month-first dates with nothing else to go on: almost certainly a US bank.
  const fileCurrency = currency || (dateOrder === 'mdy' ? 'USD' : null);

  const transactions = [];
  for (const r of body) {
    const date = parseDate(r[map.date], dateOrder);
    let amount = map.amount !== undefined ? parseAmount(r[map.amount], decimalComma) : NaN;
    if (!Number.isFinite(amount)) {
      const debit = map.debit !== undefined ? parseAmount(r[map.debit], decimalComma) : NaN;
      const credit = map.credit !== undefined ? parseAmount(r[map.credit], decimalComma) : NaN;
      if (Number.isFinite(debit) && debit !== 0) amount = -Math.abs(debit);
      else if (Number.isFinite(credit) && credit !== 0) amount = Math.abs(credit);
    }
    if (!Number.isFinite(date) || !Number.isFinite(amount) || amount === 0) continue;

    const text = (map.purpose || []).map((c) => r[c] || '').filter(Boolean).join(' ');
    let payee = '';
    if (amount > 0 && map.payer !== undefined) payee = r[map.payer] || '';
    if (!payee && map.payee !== undefined) payee = r[map.payee] || '';
    if (!payee) payee = extractEmbeddedPayee(text);

    transactions.push({
      date,
      amount,
      payee: payee.trim(),
      text: text.replace(/\s+/g, ' ').trim(),
      creditorId: map.creditorId !== undefined ? (r[map.creditorId] || '').trim() : '',
    });
  }
  // Credit card exports (Amex, Discover) list purchases as positive numbers.
  // A statement that is mostly "income" is really a statement of charges.
  if (map.amount !== undefined && transactions.length >= 8) {
    const positive = transactions.filter((t) => t.amount > 0).length;
    if (positive / transactions.length >= 0.75) for (const t of transactions) t.amount = -t.amount;
  }
  return { transactions, error: transactions.length ? null : 'no-rows', currency: fileCurrency };
}
