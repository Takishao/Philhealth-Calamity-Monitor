import { el } from './ui.js';
// The supplied PNG is unmodified. Its transparent margins are excluded by the SVG viewport.
export function brand({ link = false, login = false } = {}) {
  const ns = 'http://www.w3.org/2000/svg';
  const symbol = document.createElementNS(ns, 'svg');
  symbol.setAttribute('class', 'brand-symbol');
  symbol.setAttribute('viewBox', '278 108 358 675');
  symbol.setAttribute('aria-hidden', 'true');
  symbol.setAttribute('focusable', 'false');
  const image = document.createElementNS(ns, 'image');
  image.setAttribute('href', '/assets/philhealth-symbol-3d.png');
  image.setAttribute('width', '900'); image.setAttribute('height', '900'); symbol.append(image);
  return el(link ? 'a' : 'div', { class: `brand${login ? ' brand--login' : ''}`, href: link ? '#dashboard' : null },
    symbol, el('span', { class: 'brand-copy' }, el('strong', { class: 'brand-name' }, 'PhilHealth'), el('span', { class: 'brand-tagline' }, 'Your partner in health')));
}
