// CSV reading: decoding, delimiter detection and RFC 4180 parsing.

// Bank exports come as UTF-8 or Windows-1252 (Sparkasse, Volksbank). Try strict
// UTF-8 first and fall back, so umlauts survive either way.
export function decodeBytes(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^﻿/, '');
}

const DELIMITERS = [';', ',', '\t', '|'];

function countOutsideQuotes(line, ch) {
  let n = 0;
  let quoted = false;
  for (const c of line) {
    if (c === '"') quoted = !quoted;
    else if (c === ch && !quoted) n++;
  }
  return n;
}

// Pick the delimiter that splits the most lines into the same number of cells.
// Preamble lines (account name, date range) are ignored by looking for the
// most common count rather than requiring every line to agree.
export function detectDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 40);
  let best = ';';
  let bestScore = -1;
  for (const d of DELIMITERS) {
    const freq = new Map();
    for (const line of lines) {
      const n = countOutsideQuotes(line, d);
      if (n > 0) freq.set(n, (freq.get(n) || 0) + 1);
    }
    let score = 0;
    for (const [cols, count] of freq) score = Math.max(score, count * Math.min(cols, 8));
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export function parseCsv(text, delimiter = detectDelimiter(text)) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += c;
    }
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .map((r) => r.map((v) => v.trim()))
    .filter((r) => r.some((v) => v !== ''));
}
