// One fixture per bank format the app claims to support. Each has three monthly
// Netflix charges plus noise, and must parse to the right amounts, dates and payee.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, decodeBytes } from '../src/csv.js';
import { rowsToTransactions } from '../src/columns.js';
import { detectRecurring } from '../src/detect.js';

function check(name, csv, { payee = /netflix/i } = {}) {
  test(`format: ${name}`, () => {
    const { transactions, error } = rowsToTransactions(parseCsv(csv));
    assert.equal(error, null);
    const netflix = transactions.filter((t) => /netflix/i.test(`${t.payee} ${t.text}`));
    assert.equal(netflix.length, 3, 'three Netflix rows');
    for (const t of netflix) assert.equal(t.amount, -13.99);
    assert.ok(netflix.some((t) => payee.test(t.payee)), `payee column read (${netflix[0].payee})`);
    assert.deepEqual(
      netflix.map((t) => new Date(t.date).toISOString().slice(0, 10)).sort(),
      ['2026-06-03', '2026-07-03', '2026-08-03'],
    );
    const { items } = detectRecurring(transactions);
    const item = items.find((i) => i.name === 'Netflix');
    assert.ok(item, 'Netflix detected');
    assert.equal(item.cadence, 'monthly');
  });
}

check(
  'Sparkasse (CSV-CAMT V2)',
  `"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"
"DE001";"03.08.26";"03.08.26";"FOLGELASTSCHRIFT";"Netflix Monatsabo";"NL81ZZZ341904790000";"M1";"";"";"";"";"Netflix International B.V.";"NL00";"ABNANL2A";"-13,99";"EUR";"Umsatz gebucht"
"DE001";"15.07.26";"15.07.26";"KARTENZAHLUNG";"REWE SAGT DANKE";"";"";"";"";"";"";"REWE Markt GmbH";"";"";"-1.234,56";"EUR";"Umsatz gebucht"
"DE001";"03.07.26";"03.07.26";"FOLGELASTSCHRIFT";"Netflix Monatsabo";"NL81ZZZ341904790000";"M1";"";"";"";"";"Netflix International B.V.";"NL00";"ABNANL2A";"-13,99";"EUR";"Umsatz gebucht"
"DE001";"03.06.26";"03.06.26";"ERSTLASTSCHRIFT";"Netflix Monatsabo";"NL81ZZZ341904790000";"M1";"";"";"";"";"Netflix International B.V.";"NL00";"ABNANL2A";"-13,99";"EUR";"Umsatz gebucht"`,
);

check(
  'DKB (2023+)',
  `"Girokonto";"DE12120300000000000000"
"Zeitraum:";"01.06.2026 - 31.08.2026"
"Kontostand vom 31.08.2026:";"1.000,00 €"
""
"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"
"03.08.26";"03.08.26";"Gebucht";"Max Mustermann";"Netflix International B.V.";"Netflix";"Ausgang";"NL00";"-13,99";"NL81ZZZ341904790000";"M1";""
"01.08.26";"01.08.26";"Gebucht";"Arbeitgeber GmbH";"Max Mustermann";"Gehalt";"Eingang";"DE00";"2.500,00";"";"";""
"03.07.26";"03.07.26";"Gebucht";"Max Mustermann";"Netflix International B.V.";"Netflix";"Ausgang";"NL00";"-13,99";"NL81ZZZ341904790000";"M1";""
"03.06.26";"03.06.26";"Gebucht";"Max Mustermann";"Netflix International B.V.";"Netflix";"Ausgang";"NL00";"-13,99";"NL81ZZZ341904790000";"M1";""`,
);

check(
  'ING',
  `Umsatzanzeige;Datei erstellt am: 01.09.2026 10:00
;Letztes Update: aktuell

IBAN;DE00 0000 0000 0000 0000 00
Kontoname;Girokonto
Bank;ING
Kunde;Max Mustermann
Zeitraum;01.06.2026 - 31.08.2026
Saldo;1.000,00;EUR

Sortierung;Datum absteigend

In der CSV-Datei finden Sie alle bereits gebuchten Umsätze. Die vorgemerkten Umsätze werden nicht aufgenommen, auch wenn diese in Ihrem Internetbanking angezeigt werden.

Buchung;Wertstellungsdatum;Auftraggeber/Empfänger;Buchungstext;Verwendungszweck;Saldo;Währung;Betrag;Währung
03.08.2026;03.08.2026;Netflix International B.V.;Lastschrift;Netflix Monthly;1.000,00;EUR;-13,99;EUR
03.07.2026;03.07.2026;Netflix International B.V.;Lastschrift;Netflix Monthly;1.013,99;EUR;-13,99;EUR
20.06.2026;20.06.2026;Lidl;Lastschrift;Einkauf;1.027,98;EUR;-23,40;EUR
03.06.2026;03.06.2026;Netflix International B.V.;Lastschrift;Netflix Monthly;1.051,38;EUR;-13,99;EUR`,
);

check(
  'N26 (new)',
  `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
"2026-08-03","2026-08-03","NETFLIX.COM","","Presentment","","Main Account","-13.99","","",""
"2026-07-03","2026-07-03","NETFLIX.COM","","Presentment","","Main Account","-13.99","","",""
"2026-06-15","2026-06-15","Edeka","","Presentment","","Main Account","-1,234.50","","",""
"2026-06-03","2026-06-03","NETFLIX.COM","","Presentment","","Main Account","-13.99","","",""`,
);

check(
  'N26 (classic)',
  `"Date","Payee","Account number","Transaction type","Payment reference","Amount (EUR)","Amount (Foreign Currency)","Type Foreign Currency","Exchange Rate"
"2026-08-03","Netflix","","MasterCard Payment","","-13.99","","",""
"2026-07-03","Netflix","","MasterCard Payment","","-13.99","","",""
"2026-06-03","Netflix","","MasterCard Payment","","-13.99","","",""`,
);

check(
  'Comdirect (payee inside Buchungstext)',
  `;
"Umsätze Girokonto";"Zeitraum: 90 Tage";
"Neuer Kontostand";"1.000,00 EUR";

"Buchungstag";"Wertstellung (Valuta)";"Vorgang";"Buchungstext";"Umsatz in EUR";
"03.08.2026";"03.08.2026";"Lastschrift / Belastung";"Auftraggeber: Netflix International B.V. Buchungstext: Netflix Monatsabo Ref. 123";"-13,99";
"03.07.2026";"03.07.2026";"Lastschrift / Belastung";"Auftraggeber: Netflix International B.V. Buchungstext: Netflix Monatsabo Ref. 124";"-13,99";
"03.06.2026";"03.06.2026";"Lastschrift / Belastung";"Auftraggeber: Netflix International B.V. Buchungstext: Netflix Monatsabo Ref. 125";"-13,99";
"Alter Kontostand";"1.041,97 EUR";`,
);

check(
  'Commerzbank',
  `Buchungstag;Wertstellung;Umsatzart;Buchungstext;Betrag;Währung;Auftraggeberkonto;Bankleitzahl Auftraggeberkonto;IBAN Auftraggeberkonto;Kategorie
03.08.2026;03.08.2026;Lastschrift;Netflix International B.V. Netflix Monatsabo End-to-End-Ref.: 123;-13,99;EUR;123;20040000;DE00;Freizeit
03.07.2026;03.07.2026;Lastschrift;Netflix International B.V. Netflix Monatsabo End-to-End-Ref.: 124;-13,99;EUR;123;20040000;DE00;Freizeit
03.06.2026;03.06.2026;Lastschrift;Netflix International B.V. Netflix Monatsabo End-to-End-Ref.: 125;-13,99;EUR;123;20040000;DE00;Freizeit`,
  { payee: /.*/ },
);

check(
  'Deutsche Bank / Postbank (Soll/Haben)',
  `Umsätze Girokonto;;;;;;;;;;;;;;;;;
Zeitraum: 01.06.2026 - 31.08.2026;;;;;;;;;;;;;;;;;
Buchungstag;Wert;Umsatzart;Begünstigter / Auftraggeber;Verwendungszweck;IBAN;BIC;Kundenreferenz;Mandatsreferenz ;Gläubiger ID;Fremde Gebühren;Betrag;Abweichender Empfänger;Anzahl der Aufträge;Anzahl der Schecks;Soll;Haben;Währung
03.08.2026;03.08.2026;SEPA-Lastschrift;Netflix International B.V.;Netflix;NL00;ABNANL2A;;M1;NL81ZZZ341904790000;;;;;;-13,99;;EUR
01.08.2026;01.08.2026;SEPA-Gutschrift;Arbeitgeber;Gehalt;DE00;;;;;;;;;;;2.500,00;EUR
03.07.2026;03.07.2026;SEPA-Lastschrift;Netflix International B.V.;Netflix;NL00;ABNANL2A;;M1;NL81ZZZ341904790000;;;;;;-13,99;;EUR
03.06.2026;03.06.2026;SEPA-Lastschrift;Netflix International B.V.;Netflix;NL00;ABNANL2A;;M1;NL81ZZZ341904790000;;;;;;-13,99;;EUR
Kontostand;31.08.2026;;;1.000,00;EUR`,
);

check(
  'Volksbank / VR',
  `Bezeichnung Auftragskonto;IBAN Auftragskonto;BIC Auftragskonto;Bankname Auftragskonto;Buchungstag;Valutadatum;Name Zahlungsbeteiligter;IBAN Zahlungsbeteiligter;BIC (SWIFT-Code) Zahlungsbeteiligter;Buchungstext;Verwendungszweck;Betrag;Waehrung;Saldo nach Buchung;Bemerkung;Kategorie;Steuerrelevant;Glaeubiger ID;Mandatsreferenz
Girokonto;DE00;GENODEF1;VR Bank;03.08.2026;03.08.2026;Netflix International B.V.;NL00;ABNANL2A;Lastschrift;Netflix;-13,99;EUR;1000,00;;;;NL81ZZZ341904790000;M1
Girokonto;DE00;GENODEF1;VR Bank;03.07.2026;03.07.2026;Netflix International B.V.;NL00;ABNANL2A;Lastschrift;Netflix;-13,99;EUR;1013,99;;;;NL81ZZZ341904790000;M1
Girokonto;DE00;GENODEF1;VR Bank;03.06.2026;03.06.2026;Netflix International B.V.;NL00;ABNANL2A;Lastschrift;Netflix;-13,99;EUR;1027,98;;;;NL81ZZZ341904790000;M1`,
);

check(
  'Revolut',
  `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-08-02 10:11:12,2026-08-03 09:00:00,Netflix,-13.99,0.00,EUR,COMPLETED,1000.00
CARD_PAYMENT,Current,2026-07-02 10:11:12,2026-07-03 09:00:00,Netflix,-13.99,0.00,EUR,COMPLETED,1013.99
TOPUP,Current,2026-06-10 08:00:00,2026-06-10 08:00:00,Top-Up by *1234,500.00,0.00,EUR,COMPLETED,1027.98
CARD_PAYMENT,Current,2026-06-02 10:11:12,2026-06-03 09:00:00,Netflix,-13.99,0.00,EUR,COMPLETED,527.98`,
  { payee: /.*/ },
);

check(
  'PayPal',
  `"Datum","Uhrzeit","Zeitzone","Name","Typ","Status","Währung","Brutto","Gebühr","Netto","Absender E-Mail-Adresse","Empfänger E-Mail-Adresse","Transaktionscode"
"03.08.2026","09:00:00","CEST","Netflix International B.V.","Abonnementzahlung","Abgeschlossen","EUR","-13,99","0,00","-13,99","me@example.com","billing@netflix.com","1A"
"03.07.2026","09:00:00","CEST","Netflix International B.V.","Abonnementzahlung","Abgeschlossen","EUR","-13,99","0,00","-13,99","me@example.com","billing@netflix.com","1B"
"03.06.2026","09:00:00","CEST","Netflix International B.V.","Abonnementzahlung","Abgeschlossen","EUR","-13,99","0,00","-13,99","me@example.com","billing@netflix.com","1C"`,
);

test('Windows-1252 file keeps umlauts', () => {
  const bytes = Uint8Array.from([0x42, 0xfc, 0x72, 0x6f]); // "Büro" in Windows-1252
  assert.equal(decodeBytes(bytes), 'Büro');
  assert.equal(decodeBytes(new TextEncoder().encode('﻿Büro')), 'Büro');
});
