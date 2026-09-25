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
    'transactiondate', 'completeddate', 'starteddate', 'valutadatum', 'valuta',
    'wertstellung', 'wertstellungsdatum', 'wertstellungvaluta', 'wert',
  ],
  amount: [
    'betrag', 'betrageur', 'umsatzineur', 'umsatz', 'amount', 'amounteur',
    'betragineur', 'brutto', 'value',
  ],
  debit: ['soll', 'sollbetrag', 'debit', 'belastung', 'ausgang'],
  credit: ['haben', 'habenbetrag', 'credit', 'gutschrift', 'eingang'],
  payee: [
    'beguenstigterzahlungspflichtiger', 'zahlungsempfaengerin', 'zahlungsempfaenger',
    'auftraggeberempfaenger', 'beguenstigterauftraggeber', 'namezahlungsbeteiligter',
    'empfaenger', 'beguenstigter', 'partnername', 'payee', 'name', 'counterparty',
    'auftraggeber',
  ],
  payer: ['zahlungspflichtiger', 'zahlungspflichtige'],
  purpose: [
    'verwendungszweck', 'paymentreference', 'reference', 'beschreibung', 'description',
    'details', 'memo', 'buchungstext', 'vorgang', 'umsatzart', 'umsatztyp', 'type',
    'transactiontype', 'buchungsinformation', 'info',
  ],
  creditorId: ['glaeubigerid', 'glaeubigeridentifikation', 'creditorid', 'glaeubiger'],
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
export function detectDateOrder(values) {
  for (const v of values) {
    const m = /^(\d{1,2})\/(\d{1,2})\/\d{2,4}/.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) return 'dmy';
    if (+m[2] > 12) return 'mdy';
  }
  return 'dmy';
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

export function rowsToTransactions(rows) {
  const header = findHeader(rows);
  if (!header) return { transactions: [], error: 'no-header' };
  const { index, map } = header;
  const body = rows.slice(index + 1).filter((r) => r.length > 1);

  const amountCols = [map.amount, map.debit, map.credit].filter((c) => c !== undefined);
  const decimalComma = detectDecimalComma(body.flatMap((r) => amountCols.map((c) => r[c] || '')));
  const dateOrder = detectDateOrder(body.map((r) => r[map.date] || ''));

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
  return { transactions, error: transactions.length ? null : 'no-rows' };
}
