// Demo data, generated as real CSV text so the demo runs through exactly the
// same pipeline as a user's file. German visitors get twelve months of a DKB
// account in euros, everyone else a Chase checking account in dollars.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const q = (v) => `"${String(v).replace(/"/g, '""')}"`;

function timeline(now) {
  const end = new Date(now);
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const rows = [];
  const add = (ms, payee, purpose, amount, type = '', creditor = '') => {
    if (ms <= endUtc) rows.push({ ms, payee, purpose, amount, type, creditor });
  };
  const monthDay = (monthsAgo, day) => {
    const d = new Date(endUtc);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, day);
  };
  return { rows, add, monthDay };
}

function germanRows(now) {
  const rand = rng(42);
  const { rows, add, monthDay } = timeline(now);
  for (let m = 11; m >= 0; m--) {
    add(monthDay(m, 1), 'Musterfirma GmbH', 'Gehalt', 2840, 'Gutschrift');
    add(monthDay(m, 1), 'Hausverwaltung Schmidt', 'Miete Wohnung 3.OG links', -890, 'Dauerauftrag');
    add(monthDay(m, 3), 'Netflix International B.V.', 'Netflix Monatsabo', m >= 5 ? -12.99 : -13.99, 'Lastschrift', 'NL81ZZZ341904790000');
    add(monthDay(m, 7), 'Spotify AB', 'Spotify Premium', -10.99, 'Lastschrift', 'SE81ZZZ556703748500');
    add(monthDay(m, 2), 'RSG Group GmbH', 'McFit Mitgliedsbeitrag', -24.9, 'Lastschrift', 'DE52ZZZ00000734001');
    add(monthDay(m, 15), 'Telekom Deutschland GmbH', 'Mobilfunk Rechnung', -(39.95 + (m % 4 === 0 ? 4.99 : 0)), 'Lastschrift', 'DE93ZZZ00000078611');
    add(monthDay(m, 5), 'Stadtwerke Musterstadt', 'Abschlag Strom', -(78 + Math.round(rand() * 6)), 'Lastschrift', 'DE44ZZZ00000183734');
    add(monthDay(m, 20), 'PayPal Europe S.a.r.l. et Cie S.C.A', `${1040000000 + m}PP.4711.PP . iCloud+ 200 GB, Ihr Einkauf bei Apple Services`, -2.99);
    add(monthDay(m, 22), 'Google Ireland Ltd', 'Google One 100 GB', -1.99, 'Lastschrift');
    add(monthDay(m, 12), 'PayPal Europe S.a.r.l. et Cie S.C.A', `${1050000000 + m}PP.4711.PP . OpenAI LLC, Ihr Einkauf bei OpenAI LLC`, -(18.4 + Math.round(rand() * 60) / 100));
    add(monthDay(m, 25), 'Audible GmbH', 'Audible Mitgliedschaft', -9.95, 'Lastschrift', 'DE38ZZZ00001226522');
    if (m >= 7) add(monthDay(m, 9), 'Disney Plus', 'Disney+ Abo', -8.99, 'Lastschrift');
    if (m % 3 === 0) add(monthDay(m, 15), 'Rundfunk ARD ZDF DRADIO', 'Rundfunkbeitrag Beitragsnummer 123456789', -55.08, 'Lastschrift', 'DE13ZZZ00000026444');

    // Everyday noise that must NOT be detected.
    for (let i = 0; i < 6; i++) {
      add(monthDay(m, 2 + Math.floor(rand() * 26)), 'REWE Markt GmbH', 'Kartenzahlung girocard', -(12 + Math.round(rand() * 6000) / 100), 'Kartenzahlung');
    }
    for (let i = 0; i < 2; i++) {
      add(monthDay(m, 2 + Math.floor(rand() * 26)), 'Amazon Payments Europe S.C.A.', 'AMZN Mktp DE Bestellung', -(8 + Math.round(rand() * 9000) / 100), 'Lastschrift');
    }
    add(monthDay(m, 10 + Math.floor(rand() * 10)), 'Aral Tankstelle', 'Kartenzahlung', -(45 + Math.round(rand() * 3000) / 100), 'Kartenzahlung');
  }
  // A trial that quietly became a plan.
  add(monthDay(2, 11), 'Joyn GmbH', 'Joyn PLUS+ Probemonat', -0.99, 'Lastschrift');
  add(monthDay(1, 11), 'Joyn GmbH', 'Joyn PLUS+', -6.99, 'Lastschrift');
  add(monthDay(0, 11), 'Joyn GmbH', 'Joyn PLUS+', -6.99, 'Lastschrift');
  add(monthDay(4, 18), 'Amazon EU S.a r.l.', 'Amazon Prime Jahresmitgliedschaft', -89.9, 'Lastschrift');
  add(monthDay(9, 8), 'HUK-COBURG', 'Haftpflichtversicherung Jahresbeitrag', -64.1, 'Lastschrift', 'DE78ZZZ00000019012');
  return rows;
}

function germanCsv(now) {
  const rows = germanRows(now).sort((a, b) => b.ms - a.ms);
  const deDate = (ms) => {
    const d = new Date(ms);
    return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).slice(2)}`;
  };
  const lines = [
    '"Girokonto";"DE12 1203 0000 0000 0000 00"',
    '"Zeitraum:";"letzte 12 Monate"',
    '"Kontostand vom heute:";"1.234,56 €"',
    '',
    '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  ];
  for (const r of rows) {
    const d = deDate(r.ms);
    const out = r.amount < 0;
    lines.push(
      [d, d, 'Gebucht', out ? 'Max Mustermann' : r.payee, out ? r.payee : 'Max Mustermann', r.purpose, r.type || 'Lastschrift', 'DE00123456780000000000', r.amount.toFixed(2).replace('.', ','), r.creditor, r.creditor ? 'MANDAT-' + r.creditor.slice(-4) : '', '']
        .map(q)
        .join(';'),
    );
  }
  return lines.join('\n');
}

function americanRows(now) {
  const rand = rng(7);
  const { rows, add, monthDay } = timeline(now);
  for (let m = 11; m >= 0; m--) {
    add(monthDay(m, 1), '', 'ACME CORP PAYROLL PPD ID: 1234567890', 3200, 'ACH_CREDIT');
    add(monthDay(m, 15), '', 'ACME CORP PAYROLL PPD ID: 1234567890', 3200, 'ACH_CREDIT');
    add(monthDay(m, 1), '', 'Zelle payment to Oak Street Property Management rent', -1850, 'QUICKPAY_DEBIT');
    add(monthDay(m, 4), '', 'NETFLIX.COM NETFLIX.COM CA', m >= 5 ? -15.49 : -17.99, 'DEBIT_CARD');
    add(monthDay(m, 8), '', 'Spotify USA 877-778-1161 NY', -11.99, 'DEBIT_CARD');
    add(monthDay(m, 19), '', 'APPLE.COM/BILL APPLE MUSIC 866-712-7753 CA', -10.99, 'DEBIT_CARD');
    add(monthDay(m, 11), '', 'HULU 877-8244858 CA', -7.99, 'DEBIT_CARD');
    add(monthDay(m, 13), '', 'MAX.COM HBO MAX NEW YORK NY', -16.99, 'DEBIT_CARD');
    add(monthDay(m, 17), '', 'PLANET FITNESS CLUB FEES NH', -15, 'ACH_DEBIT');
    add(monthDay(m, 21), '', 'VERIZON WIRELESS PAYMENTS', -(70 + (m % 3 === 0 ? 5.5 : 0)), 'ACH_DEBIT');
    add(monthDay(m, 23), '', 'OPENAI *CHATGPT SUBSCR SAN FRANCISCO CA', -20, 'DEBIT_CARD');
    add(monthDay(m, 26), '', 'Audible*US Membership NJ', -14.95, 'DEBIT_CARD');
    add(monthDay(m, 6), '', 'CON EDISON EDISON NJ UTILITY PAYMENT', -(84 + Math.round(rand() * 22)), 'ACH_DEBIT');
    if (m >= 8) add(monthDay(m, 9), '', 'DISNEY PLUS 888-9057888 CA', -13.99, 'DEBIT_CARD');

    for (let i = 0; i < 7; i++) {
      add(monthDay(m, 2 + Math.floor(rand() * 26)), '', "TRADER JOE'S #552 BROOKLYN NY", -(18 + Math.round(rand() * 9000) / 100), 'DEBIT_CARD');
    }
    for (let i = 0; i < 4; i++) {
      add(monthDay(m, 2 + Math.floor(rand() * 26)), '', 'STARBUCKS STORE 07631 NEW YORK NY', -(4 + Math.round(rand() * 600) / 100), 'DEBIT_CARD');
    }
    add(monthDay(m, 10 + Math.floor(rand() * 15)), '', 'Amazon.com*AB12CD34E Amzn.com/bill WA', -(12 + Math.round(rand() * 8000) / 100), 'DEBIT_CARD');
    add(monthDay(m, 5 + Math.floor(rand() * 20)), '', 'SHELL OIL 57444212 BROOKLYN NY', -(38 + Math.round(rand() * 2500) / 100), 'DEBIT_CARD');
  }
  add(monthDay(2, 14), '', 'PEACOCK TV TRIAL NEW YORK NY', -1, 'DEBIT_CARD');
  add(monthDay(1, 14), '', 'PEACOCK TV PREMIUM NEW YORK NY', -7.99, 'DEBIT_CARD');
  add(monthDay(0, 14), '', 'PEACOCK TV PREMIUM NEW YORK NY', -7.99, 'DEBIT_CARD');
  add(monthDay(5, 18), '', 'Amazon Prime*RT4Y67 Amzn.com/bill WA', -139, 'DEBIT_CARD');
  add(monthDay(8, 2), '', 'GEICO *AUTO MACON DC', -612.4, 'ACH_DEBIT');
  return rows;
}

function americanCsv(now) {
  const rows = americanRows(now).sort((a, b) => b.ms - a.ms);
  const usDate = (ms) => {
    const d = new Date(ms);
    return `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}/${d.getUTCFullYear()}`;
  };
  const lines = ['Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #,'];
  let balance = 4821.37;
  for (const r of rows) {
    lines.push([r.amount < 0 ? 'DEBIT' : 'CREDIT', usDate(r.ms), q(r.purpose), r.amount.toFixed(2), r.type, balance.toFixed(2), '', ''].join(','));
    balance -= r.amount;
  }
  return lines.join('\n');
}

export function sampleCsv(now = Date.now(), lang = 'de') {
  return lang === 'de' ? germanCsv(now) : americanCsv(now);
}
