<div align="center">

# 💧 PlugTheLeak

**Plug the leaks in your bank account.**

Drop in your bank statement, get every subscription out, and cancel what you don't need.
Free, no sign-up, and your bank data never leaves your browser.

**[➜ Try it now](https://vqorn.github.io/PlugTheLeak/)** · [Deutsch](#deutsch)

<img src="docs/results.png" alt="PlugTheLeak showing a year of subscriptions, overlaps and price increases" width="620">

</div>

## Why?

Most people pay for subscriptions they forgot about: the free trial that quietly turned into a paid plan, the gym from January, the streaming service you signed up to for one show. Apps that find them usually want full access to your bank account, a monthly fee, or both.

PlugTheLeak only needs the CSV file every online bank lets you download. Everything is analysed on your own device.

## Features

- 🔍 **Finds recurring payments** automatically: weekly, monthly, quarterly, every six months, yearly
- 💶 **Shows the real cost** per month and per year, with subscriptions kept apart from fixed costs like rent or insurance
- 📈 **Spots price increases**, e.g. "Netflix: $15.49 → $17.99"
- 🧩 **Finds overlaps**: "You pay for 2 music streaming services: Spotify, Apple Music"
- 🧪 **Catches trials that turned paid**, and flags subscriptions that only just started
- 📅 **Calendar reminders** before the next charge (one .ics file for iPhone, Google and Outlook)
- 💸 **Savings calculator**: tick what you don't need and instantly see how much you save per year
- 📸 **Share card**: turn your result into an image for Instagram, X or WhatsApp (provider names only if you want them)
- ⌨️ **Terminal version**: `npx plugtheleak statement.csv`
- ✉️ **Cancellation letter** in one click, including revoking the direct debit, ready to copy, e-mail or print
- 🔗 **Direct links to the cancel page** of well-known providers
- 🧾 **PayPal payments** are traced back to the real merchant ("Your purchase at Spotify")
- 🏦 **190+ known providers** across the US, UK and Europe (streaming, mobile, gyms, software, AI, news, insurance …)
- 💱 **Any currency**: detected from your file, switchable to 20 currencies
- 🌙 Dark mode, works on phones, English and German

## Supported banks

Tested with CSV exports from:

🇺🇸 **Chase** · **Bank of America** · **Wells Fargo** · **Capital One** · **Citi** · **American Express** · **Discover**

🇬🇧 **Monzo** · **Starling** · **Barclays** · **HSBC** · **Lloyds** · **Nationwide**

🇩🇪 **Sparkasse** · **DKB** · **ING** · **N26** · **Comdirect** · **Commerzbank** · **Deutsche Bank** · **Postbank** · **Volksbank**

🌍 **Revolut** · **PayPal**

Columns, date formats, number formats and currency are detected automatically, including files without a header row and credit card exports that list charges as positive numbers. So many other banks work too. If yours doesn't work, [open an issue](https://github.com/vqorn/PlugTheLeak/issues) with the column headers of your export (please **don't** post real transactions).

## How it works

1. Export your transactions from online banking as **CSV**, ideally for **12 months**.
2. Drop the file onto [vqorn.github.io/PlugTheLeak](https://vqorn.github.io/PlugTheLeak/).
3. Go through the list, tick, cancel. Done.

No file at hand? Click **"Try it with sample data"** on the page.

## In your terminal

Prefer the command line? Same engine, no browser needed:

```bash
npx plugtheleak ~/Downloads/statement.csv
```

```
  Your subscriptions cost you
  $2,327 a year.
  That's $193.89 a month across 10 subscriptions.

  Worth a look
  • You pay for 4 video streaming services: Netflix, Max, Peacock, Hulu. $611.52 a year together.
  • You pay for 2 music streaming services: Spotify, Apple Music. $275.76 a year together.
  • Peacock started as a $1.00 trial and now costs $7.99 monthly.
  • Netflix got more expensive: $15.49 → $17.99.

  Ongoing payments
  Verizon         monthly      ~$70.00      $840.00/year
  ChatGPT         monthly       $20.00      $240.00/year
  Netflix         monthly       $17.99      $215.88/year  ↑
  ...
```

| Option | |
|---|---|
| `--all` | all recurring payments, not only subscriptions |
| `--ics reminders.ics` | calendar reminders for every active payment |
| `--json` | machine-readable output |
| `--currency GBP` | force a currency |
| `--lang de` | German output |
| `--demo` | try it without a file |

## Privacy, for real

- There is **no server**. The page is a single static HTML file.
- The page ships a Content Security Policy with `connect-src 'none'`. Your browser **forbids** the page from sending anything anywhere. Even if it wanted to, it couldn't.
- No tracking, no cookies, no analytics, no external fonts or scripts.
- Want to be sure? Save the [page](https://vqorn.github.io/PlugTheLeak/) (right click, "Save as"), turn off your Wi-Fi and open the file. It works completely offline.

## Limitations (honestly)

- Detection is an **estimate**. Two payments at the same interval aren't necessarily a subscription, and sometimes it misses one. That's why you can hide any entry and expand it to see the underlying transactions.
- Yearly plans are only detected reliably once two payments fall inside the date range. Known providers with a single payment are listed under "Possibly a subscription too".
- The cancellation letter is a template, **not legal advice**.

## Contributing

The most helpful contribution: **add providers** to [`src/merchants.js`](src/merchants.js). It's a simple list:

```js
{ name: 'Netflix', re: /netflix/i, cat: 'video', url: 'https://www.netflix.com/cancelplan' },
```

Only add a `url` if it really is the official cancel or account page. New bank formats are very welcome too, ideally with a test in [`test/formats.test.js`](test/formats.test.js) (made-up transactions only!).

### Development

No dependencies, just Node.js ≥ 20:

```bash
npm test          # run the tests
npm run dev       # local server on http://localhost:8080
npm run build     # builds dist/index.html (one single file that also works offline)
node bin/plugtheleak.js --demo   # the terminal version
```

```
src/csv.js        reading CSV (encoding, delimiter, quotes)
src/columns.js    detecting bank formats, parsing amounts and dates
src/merchants.js  known providers and categories
src/detect.js     recurring payment detection
src/letter.js     cancellation letters
src/calendar.js   calendar reminders (.ics)
src/card.js       share image
bin/plugtheleak.js  command line interface
src/app.js        user interface
```

---

## Deutsch

**Finde die Lecks in deinem Konto.** Kontoauszug als CSV reinziehen, alle Abos und Verträge sehen, heimliche Preiserhöhungen entdecken und mit einem Klick das Kündigungsschreiben erstellen. Läuft zu 100 % im Browser, ohne Anmeldung, ohne Server. Erkennt doppelte Abos, Testphasen, die zum Abo wurden, und schickt Erinnerungen in deinen Kalender. Unterstützt Sparkasse, DKB, ING, N26, Comdirect, Commerzbank, Deutsche Bank, Postbank, Volksbank, Revolut, PayPal und viele Banken aus den USA und Großbritannien. Die App erkennt einen deutschen Browser und startet dann automatisch auf Deutsch.

**[➜ Jetzt ausprobieren](https://vqorn.github.io/PlugTheLeak/)**

## License

[MIT](LICENSE)
