// Share card: a 1080×1350 image drawn on a canvas, entirely in the browser.
// Names are only included when the user asks for it.

const W = 1080;
const H = 1350;
const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI Variable Display", "Segoe UI", system-ui, Roboto, sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drop(ctx, x, y, size, fill, bg) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, size, size, size * 0.25);
  ctx.fill();
  const s = size / 32;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(x + 16 * s, y + 6.5 * s);
  ctx.bezierCurveTo(x + 12.4 * s, y + 11.2 * s, x + 9.8 * s, y + 14.8 * s, x + 9.8 * s, y + 18.1 * s);
  ctx.arc(x + 16 * s, y + 18.1 * s, 6.2 * s, Math.PI, 0, true);
  ctx.bezierCurveTo(x + 22.2 * s, y + 14.8 * s, x + 19.6 * s, y + 11.2 * s, x + 16 * s, y + 6.5 * s);
  ctx.fill();
}

// Largest font size (up to `max`) at which `text` fits into `width`.
function fit(ctx, text, weight, max, width) {
  let size = max;
  do {
    ctx.font = `${weight} ${size}px ${FONT}`;
    if (ctx.measureText(text).width <= width) return size;
    size -= 4;
  } while (size > 20);
  return size;
}

export function drawCard(canvas, data) {
  const { total, monthlyLine, eyebrow, perYear, saving, chips, items, showNames, footer, tagline, url, tile } = data;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const P = 96;

  ctx.fillStyle = '#fbfbfd';
  ctx.fillRect(0, 0, W, H);

  // Brand
  drop(ctx, P, 88, 56, '#1d1d1f', '#fbfbfd');
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 36px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('PlugTheLeak', P + 76, 117);

  // Headline number
  ctx.textBaseline = 'alphabetic';
  let y = showNames ? 250 : 340;
  ctx.fillStyle = '#6e6e73';
  ctx.font = `500 ${showNames ? 38 : 44}px ${FONT}`;
  ctx.fillText(eyebrow, P, y);
  const size = fit(ctx, total, 700, showNames ? 160 : 240, W - 2 * P);
  y += Math.round(size * 0.92);
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.fillStyle = '#1d1d1f';
  ctx.fillText(total, P - size * 0.03, y);
  y += Math.round(size * 0.24) + (showNames ? 44 : 64);
  ctx.font = `600 ${showNames ? 48 : 64}px ${FONT}`;
  ctx.fillStyle = '#86868b';
  ctx.fillText(perYear, P, y);
  y += showNames ? 60 : 72;
  ctx.font = `400 ${showNames ? 34 : 38}px ${FONT}`;
  ctx.fillStyle = '#1d1d1f';
  ctx.fillText(monthlyLine, P, y, W - 2 * P);

  // Saving pill
  if (saving) {
    y += showNames ? 32 : 44;
    ctx.font = `600 36px ${FONT}`;
    const w = ctx.measureText(saving).width + 64;
    ctx.fillStyle = '#34c759';
    roundRect(ctx, P, y, Math.min(w, W - 2 * P), 76, 38);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.fillText(saving, P + 32, y + 39, W - 2 * P - 64);
    ctx.textBaseline = 'alphabetic';
    y += 76;
  }

  // Chips: overlaps, trials, price increases. The name list takes their place.
  if (chips.length && !showNames) {
    y += 40;
    let x = P;
    ctx.font = `500 30px ${FONT}`;
    for (const chip of chips) {
      const w = ctx.measureText(chip).width + 44;
      if (x + w > W - P) {
        x = P;
        y += 68;
      }
      ctx.fillStyle = 'rgba(182, 68, 0, 0.1)';
      roundRect(ctx, x, y, w, 54, 27);
      ctx.fill();
      ctx.fillStyle = '#b64400';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip, x + 22, y + 28);
      ctx.textBaseline = 'alphabetic';
      x += w + 14;
    }
    y += 54;
  }

  // Optional list of the biggest items
  if (showNames && items.length) {
    y += 40;
    const rowH = 78;
    const list = items.slice(0, Math.max(0, Math.min(5, Math.floor((H - 270 - y) / rowH))));
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, P - 24, y, W - 2 * P + 48, list.length * rowH + 16, 32);
    ctx.fill();
    y += 8;
    for (const [n, it] of list.entries()) {
      const cy = y + n * rowH + rowH / 2;
      ctx.fillStyle = tile(it.category);
      roundRect(ctx, P, cy - 26, 52, 52, 13);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = `600 28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((it.name.match(/\p{L}|\d/u) || ['?'])[0].toUpperCase(), P + 26, cy + 1);
      ctx.textAlign = 'left';
      ctx.fillStyle = it.marked ? '#86868b' : '#1d1d1f';
      ctx.font = `600 32px ${FONT}`;
      ctx.fillText(it.name, P + 76, cy, 520);
      if (it.marked) {
        const w = Math.min(ctx.measureText(it.name).width, 520);
        ctx.fillRect(P + 76, cy, w, 3);
      }
      ctx.textAlign = 'right';
      ctx.fillStyle = '#6e6e73';
      ctx.font = `500 30px ${FONT}`;
      ctx.fillText(it.yearly, W - P, cy);
      ctx.textAlign = 'left';
      if (n < list.length - 1) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(P + 76, y + (n + 1) * rowH, W - 2 * P - 76, 2);
      }
    }
    ctx.textBaseline = 'alphabetic';
  }

  // Footer
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(P, H - 232, W - 2 * P, 2);
  ctx.fillStyle = '#1d1d1f';
  ctx.font = `600 40px ${FONT}`;
  ctx.fillText(footer, P, H - 158, W - 2 * P);
  ctx.fillStyle = '#0066cc';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(url, P, H - 106, W - 2 * P);
  ctx.fillStyle = '#86868b';
  ctx.font = `400 28px ${FONT}`;
  ctx.fillText(tagline, P, H - 62, W - 2 * P);
  return canvas;
}
