// Demo data: twelve months of a made-up DKB account, generated as real CSV text
// so the demo runs through exactly the same pipeline as a user's file.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, '0');
const deDate = (d) => `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${String(d.getUTCFullYear()).slice(2)}`;
const deAmount = (n) => n.toFixed(2).replace('.', ',');

export function sampleCsv(now = Date.now()) {
  const rand = rng(42);
  const end = new Date(now);
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const rows = [];
  const add = (ms, payee, purpose, amount, type = 'Lastschrift', creditor = '') => {
    if (ms > endUtc) return;
    rows.push({ ms, payee, purpose, amount, type, creditor });
  };
  const monthDay = (monthsAgo, day) => {
    const d = new Date(endUtc);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - monthsAgo, day);
  };

  for (let m = 11; m >= 0; m--) {
    add(monthDay(m, 1), 'Musterfirma GmbH', 'Gehalt', 2840, 'Gutschrift');
    add(monthDay(m, 1), 'Hausverwaltung Schmidt', 'Miete Wohnung 3.OG links', -890, 'Dauerauftrag');
    add(monthDay(m, 3), 'Netflix International B.V.', 'Netflix Monatsabo', m >= 5 ? -12.99 : -13.99, 'Lastschrift', 'NL81ZZZ341904790000');
    add(monthDay(m, 7), 'Spotify AB', 'Spotify Premium', -10.99, 'Lastschrift', 'SE81ZZZ556703748500');
    add(monthDay(m, 2), 'RSG Group GmbH', 'McFit Mitgliedsbeitrag', -24.9, 'Lastschrift', 'DE52ZZZ00000734001');
    add(monthDay(m, 15), 'Telekom Deutschland GmbH', 'Mobilfunk Rechnung', -(39.95 + (m % 4 === 0 ? 4.99 : 0)), 'Lastschrift', 'DE93ZZZ00000078611');
    add(monthDay(m, 5), 'Stadtwerke Musterstadt', 'Abschlag Strom', -(78 + Math.round(rand() * 6)), 'Lastschrift', 'DE44ZZZ00000183734');
    add(monthDay(m, 20), 'PayPal Europe S.a.r.l. et Cie S.C.A', `${1040000000 + m}PP.4711.PP . Apple Services, Ihr Einkauf bei Apple Services`, -2.99);
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
  add(monthDay(4, 18), 'Amazon EU S.a r.l.', 'Amazon Prime Jahresmitgliedschaft', -89.9, 'Lastschrift');
  add(monthDay(9, 8), 'HUK-COBURG', 'Haftpflichtversicherung Jahresbeitrag', -64.1, 'Lastschrift', 'DE78ZZZ00000019012');

  rows.sort((a, b) => b.ms - a.ms);
  const q = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    '"Girokonto";"DE12 1203 0000 0000 0000 00"',
    '"Zeitraum:";"letzte 12 Monate"',
    '"Kontostand vom heute:";"1.234,56 €"',
    '',
    '"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"',
  ];
  for (const r of rows) {
    const d = deDate(new Date(r.ms));
    const out = r.amount < 0;
    lines.push(
      [d, d, 'Gebucht', out ? 'Max Mustermann' : r.payee, out ? r.payee : 'Max Mustermann', r.purpose, r.type, 'DE00123456780000000000', deAmount(r.amount), r.creditor, r.creditor ? 'MANDAT-' + r.creditor.slice(-4) : '', '']
        .map(q)
        .join(';'),
    );
  }
  return lines.join('\n');
}
