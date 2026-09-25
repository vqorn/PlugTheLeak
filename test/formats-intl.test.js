// US and UK bank formats. Like the German fixtures, each has three monthly
// Netflix charges plus noise; they must parse to the right amounts, dates and
// currency, and Netflix must come out as a monthly subscription.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/csv.js';
import { rowsToTransactions } from '../src/columns.js';
import { detectRecurring } from '../src/detect.js';

function check(name, csv, { currency, amount = -15.49 }) {
  test(`format: ${name}`, () => {
    const { transactions, error, currency: detected } = rowsToTransactions(parseCsv(csv));
    assert.equal(error, null);
    assert.equal(detected, currency, 'currency');
    const netflix = transactions.filter((t) => /netflix/i.test(`${t.payee} ${t.text}`));
    assert.equal(netflix.length, 3, 'three Netflix rows');
    for (const t of netflix) assert.equal(t.amount, amount);
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

// ---------- United States ----------

check('Chase checking', `Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #,
DEBIT,08/03/2026,"NETFLIX.COM NETFLIX.COM CA",-15.49,DEBIT_CARD,2310.44,,
DEBIT,07/28/2026,"TRADER JOE'S #552 BROOKLYN NY",-64.12,DEBIT_CARD,2325.93,,
CREDIT,07/15/2026,"ACME CORP PAYROLL PPD ID: 1234",3200.00,ACH_CREDIT,2390.05,,
DEBIT,07/03/2026,"NETFLIX.COM NETFLIX.COM CA",-15.49,DEBIT_CARD,-809.95,,
DEBIT,06/03/2026,"NETFLIX.COM NETFLIX.COM CA",-15.49,DEBIT_CARD,-794.46,,`, { currency: 'USD' });

check('Chase credit card', `Transaction Date,Post Date,Description,Category,Type,Amount,Memo
08/03/2026,08/04/2026,NETFLIX.COM,Entertainment,Sale,-15.49,
07/21/2026,07/22/2026,WHOLEFDS BRK 10233,Groceries,Sale,-88.20,
07/05/2026,07/05/2026,Payment Thank You-Mobile,,Payment,500.00,
07/03/2026,07/04/2026,NETFLIX.COM,Entertainment,Sale,-15.49,
06/03/2026,06/04/2026,NETFLIX.COM,Entertainment,Sale,-15.49,`, { currency: 'USD' });

check('Bank of America checking (summary preamble)', `Description,,Summary Amt.
Beginning balance as of 06/01/2026,,"2,512.10"
Total credits,,"6,400.00"
Total debits,,"-5,901.33"
Ending balance as of 08/31/2026,,"3,010.77"

Date,Description,Amount,Running Bal.
06/01/2026,Beginning balance as of 06/01/2026,,"2,512.10"
06/03/2026,"NETFLIX.COM DES:NETFLIX ID:XXXXX INDN:JOHN DOE CO ID:XXXXX WEB","-15.49","2,496.61"
06/19/2026,"CHECKCARD 0619 SAFEWAY #1234 SAN JOSE CA","-1,120.33","1,376.28"
07/03/2026,"NETFLIX.COM DES:NETFLIX ID:XXXXX INDN:JOHN DOE CO ID:XXXXX WEB","-15.49","1,360.79"
07/15/2026,"ACME CORP DES:PAYROLL ID:XXXXX","3,200.00","4,560.79"
08/03/2026,"NETFLIX.COM DES:NETFLIX ID:XXXXX INDN:JOHN DOE CO ID:XXXXX WEB","-15.49","4,545.30"`, { currency: 'USD' });

check('Wells Fargo (no header row)', `"08/03/2026","-15.49","*","","PURCHASE AUTHORIZED ON 08/02 NETFLIX.COM CA S586214"
"07/22/2026","-42.10","*","","PURCHASE AUTHORIZED ON 07/21 SAFEWAY #1234 CA S586"
"07/15/2026","3200.00","*","","ACME CORP PAYROLL 260715"
"07/03/2026","-15.49","*","","PURCHASE AUTHORIZED ON 07/02 NETFLIX.COM CA S586214"
"06/03/2026","-15.49","*","","PURCHASE AUTHORIZED ON 06/02 NETFLIX.COM CA S586214"`, { currency: 'USD' });

check('Capital One (debit / credit columns, ISO dates)', `Transaction Date,Posted Date,Card No.,Description,Category,Debit,Credit
2026-08-03,2026-08-04,1234,NETFLIX.COM,Entertainment,15.49,
2026-07-19,2026-07-20,1234,KROGER #512,Groceries,57.33,
2026-07-08,2026-07-08,1234,CAPITAL ONE MOBILE PYMT,Payment/Credit,,250.00
2026-07-03,2026-07-04,1234,NETFLIX.COM,Entertainment,15.49,
2026-06-03,2026-06-04,1234,NETFLIX.COM,Entertainment,15.49,`, { currency: null });

check('Citi (debit / credit columns)', `Status,Date,Description,Debit,Credit
Cleared,08/03/2026,NETFLIX.COM NETFLIX.COM CA,15.49,
Cleared,07/20/2026,SHELL OIL 57444212,41.77,
Cleared,07/05/2026,ONLINE PAYMENT THANK YOU,,-300.00
Cleared,07/03/2026,NETFLIX.COM NETFLIX.COM CA,15.49,
Cleared,06/03/2026,NETFLIX.COM NETFLIX.COM CA,15.49,`, { currency: 'USD' });

const amexNoise = Array.from({ length: 8 }, (_, i) =>
  `07/${String(10 + i).padStart(2, '0')}/2026,UBER *TRIP HELP.UBER.COM,${(9 + i * 1.37).toFixed(2)}`).join('\n');
check('American Express (charges are positive)', `Date,Description,Amount
08/03/2026,NETFLIX.COM LOS GATOS CA,15.49
07/05/2026,AUTOPAY PAYMENT - THANK YOU,-450.00
07/03/2026,NETFLIX.COM LOS GATOS CA,15.49
${amexNoise}
06/03/2026,NETFLIX.COM LOS GATOS CA,15.49`, { currency: 'USD' });

check('Discover (charges are positive)', `Trans. Date,Post Date,Description,Amount,Category
08/03/2026,08/03/2026,NETFLIX.COM 866-579-7172 CA,15.49,Services
07/03/2026,07/03/2026,NETFLIX.COM 866-579-7172 CA,15.49,Services
${Array.from({ length: 8 }, (_, i) => `07/${String(12 + i).padStart(2, '0')}/2026,07/${String(12 + i).padStart(2, '0')}/2026,TARGET 00012345,${(20 + i * 3.1).toFixed(2)},Merchandise`).join('\n')}
07/01/2026,07/01/2026,INTERNET PAYMENT - THANK YOU,-300.00,Payments and Credits
06/03/2026,06/03/2026,NETFLIX.COM 866-579-7172 CA,15.49,Services`, { currency: 'USD' });

// ---------- United Kingdom ----------

check('Monzo', `Transaction ID,Date,Time,Type,Name,Emoji,Category,Amount,Currency,Local amount,Local currency,Notes and #tags,Address,Receipt,Description,Category split,Money Out,Money In
tx_0001,03/08/2026,09:12:01,Card payment,Netflix,🎬,Entertainment,-10.99,GBP,-10.99,GBP,,,,NETFLIX.COM,,-10.99,
tx_0002,21/07/2026,18:40:11,Card payment,Tesco,🛒,Groceries,-34.20,GBP,-34.20,GBP,,,,TESCO STORES 3021,,-34.20,
tx_0003,03/07/2026,09:12:01,Card payment,Netflix,🎬,Entertainment,-10.99,GBP,-10.99,GBP,,,,NETFLIX.COM,,-10.99,
tx_0004,03/06/2026,09:12:01,Card payment,Netflix,🎬,Entertainment,-10.99,GBP,-10.99,GBP,,,,NETFLIX.COM,,-10.99,`, { currency: 'GBP', amount: -10.99 });

check('Starling', `Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP),Spending Category,Notes
03/06/2026,Netflix,NETFLIX.COM,CARD,-10.99,1210.44,ENTERTAINMENT,
03/07/2026,Netflix,NETFLIX.COM,CARD,-10.99,1199.45,ENTERTAINMENT,
25/07/2026,Sainsbury's,SAINSBURYS S/MKTS,CARD,-22.80,1176.65,GROCERIES,
03/08/2026,Netflix,NETFLIX.COM,CARD,-10.99,1165.66,ENTERTAINMENT,`, { currency: 'GBP', amount: -10.99 });

check('Barclays (payee in memo)', `Number,Date,Account,Amount,Subcategory,Memo
,03/08/2026,20-00-00 12345678,-10.99,PAYMENT,NETFLIX.COM         ON 02 AUG          BCC
,22/07/2026,20-00-00 12345678,-51.30,PAYMENT,TESCO STORES 3021   ON 21 JUL          BCC
,15/07/2026,20-00-00 12345678,2450.00,DIRECTDEP,ACME LTD SALARY
,03/07/2026,20-00-00 12345678,-10.99,PAYMENT,NETFLIX.COM         ON 02 JUL          BCC
,03/06/2026,20-00-00 12345678,-10.99,PAYMENT,NETFLIX.COM         ON 02 JUN          BCC`, { currency: null, amount: -10.99 });

check('HSBC UK (no header row, pound signs)', `03/08/2026,NETFLIX.COM,-£10.99
21/07/2026,TESCO STORES 3021,-£34.20
15/07/2026,ACME LTD SALARY,"£2,450.00"
03/07/2026,NETFLIX.COM,-£10.99
03/06/2026,NETFLIX.COM,-£10.99`, { currency: 'GBP', amount: -10.99 });

check('Lloyds (debit / credit columns)', `Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance
03/08/2026,DEB,'30-00-00,12345678,NETFLIX.COM,10.99,,1502.10
24/07/2026,DEB,'30-00-00,12345678,ASDA STORES,45.61,,1513.09
15/07/2026,FPI,'30-00-00,12345678,ACME LTD SALARY,,2450.00,1558.70
03/07/2026,DEB,'30-00-00,12345678,NETFLIX.COM,10.99,,-891.30
03/06/2026,DEB,'30-00-00,12345678,NETFLIX.COM,10.99,,-880.31`, { currency: null, amount: -10.99 });

check('Nationwide (preamble, pound signs)', `"Account Name:","FlexDirect ****12345"
"Account Balance:","£1,502.10"
"Available Balance: ","£1,502.10"

"Date","Transaction type","Description","Paid out","Paid in","Balance"
"03 Jun 2026","Contactless payment","NETFLIX.COM","£10.99","","£1,210.44"
"03 Jul 2026","Contactless payment","NETFLIX.COM","£10.99","","£1,199.45"
"25 Jul 2026","Contactless payment","CO-OP GROUP","£8.40","","£1,191.05"
"03 Aug 2026","Contactless payment","NETFLIX.COM","£10.99","","£1,180.06"`, { currency: 'GBP', amount: -10.99 });
