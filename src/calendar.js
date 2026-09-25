// Calendar reminders as an .ics file: one repeating all-day event per payment,
// with an alarm a few days before, so there is time to cancel.

const DAY = 86400000;

const RRULE = {
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
  bimonthly: 'FREQ=MONTHLY;INTERVAL=2',
  quarterly: 'FREQ=MONTHLY;INTERVAL=3',
  halfyearly: 'FREQ=MONTHLY;INTERVAL=6',
  yearly: 'FREQ=YEARLY',
};

// Step sizes in real calendar units, so the 3rd of the month stays the 3rd.
const STEP = {
  weekly: { days: 7 }, biweekly: { days: 14 }, monthly: { months: 1 }, bimonthly: { months: 2 },
  quarterly: { months: 3 }, halfyearly: { months: 6 }, yearly: { months: 12 },
};

const pad = (n) => String(n).padStart(2, '0');
const ymd = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
};
const stamp = (ms) => {
  const d = new Date(ms);
  return `${ymd(ms)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};

function escapeText(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// RFC 5545: lines longer than 75 octets are folded with CRLF + space.
function fold(line) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      len = 0;
    }
    cur += ch;
    len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

// The next charge on or after today, stepping forward from the predicted one.
export function nextOnOrAfter(item, today) {
  const d = new Date(item.next);
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const step = STEP[item.cadence];
  let next = start;
  for (let i = 1; next < today && i < 1000; i++) {
    next = step.days
      ? start + i * step.days * DAY
      : Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i * step.months, d.getUTCDate());
  }
  return next;
}

export function buildIcs(items, { lang = 'en', money = (n) => n.toFixed(2), now = Date.now() } = {}) {
  const today = Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), new Date(now).getUTCDate());
  const de = lang === 'de';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PlugTheLeak//Subscription reminders//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const item of items) {
    if (!RRULE[item.cadence]) continue;
    const start = nextOnOrAfter(item, today);
    const long = item.cadence === 'yearly' || item.cadence === 'halfyearly';
    const before = long ? 7 : 3;
    const summary = de
      ? `${item.name}: ${money(item.amount)} werden abgebucht`
      : `${item.name} charges ${money(item.amount)}`;
    const description = de
      ? `Wiederkehrende Zahlung, ca. ${money(item.yearly)} im Jahr. Wenn du das nicht mehr brauchst, kündige vorher. Nach der Kündigung kannst du diesen Termin löschen. (PlugTheLeak)`
      : `Recurring payment, about ${money(item.yearly)} a year. If you don't need it any more, cancel before this date. Delete this event once cancelled. (PlugTheLeak)`;
    const alarm = de
      ? `In ${before} Tagen: ${item.name} (${money(item.amount)})`
      : `In ${before} days: ${item.name} (${money(item.amount)})`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ymd(start)}-${item.id.replace(/[^\w.-]/g, '')}@plugtheleak`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`,
      `DTEND;VALUE=DATE:${ymd(start + DAY)}`,
      `RRULE:${RRULE[item.cadence]}`,
      `SUMMARY:${escapeText(summary)}`,
      `DESCRIPTION:${escapeText(description)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(alarm)}`,
      `TRIGGER:-P${before}D`,
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
