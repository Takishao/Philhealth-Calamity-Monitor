import { el, money } from './ui.js';
import { chartGeometry } from './chart-math.js';
const ns = 'http://www.w3.org/2000/svg';
function svgNode(tag, attrs = {}, text) { const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; return node; }
const shortMoney = value => `₱${new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 }).format(value / 100)}`;
const shortDate = date => new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
export function trendChart(data) {
  const frame = el('div', { class: 'trend-chart', 'data-level': data.signal.level });
  const plot = svgNode('svg', { class: 'trend-svg', role: 'img', 'aria-label': `${data.signal.label}. Cumulative committed spending, four-week forecast, and budget ceiling.` });
  const legend = el('div', { class: 'chart-legend', 'aria-label': 'Chart legend' }, ...[['actual', 'Committed'], ['forecast', 'Forecast'], ['ceiling', 'Ceiling']].map(([kind, label]) => el('span', {}, el('i', { class: `legend-line ${kind}`, 'aria-hidden': 'true' }), label)));
  frame.append(plot, legend);
  function draw(width) {
    const g = chartGeometry(data, width); plot.setAttribute('viewBox', `0 0 ${g.width} ${g.height}`); plot.replaceChildren();
    plot.append(svgNode('title', {}, `Committed ${money(data.totals.committed)}; forecast ${money(data.forecast.projected)}; ceiling ${money(data.totals.ceiling)}.`));
    for (const tick of g.ticks) plot.append(svgNode('line', { x1: g.left, x2: g.right, y1: tick.y, y2: tick.y, class: 'chart-grid' }), svgNode('text', { x: g.left - 8, y: tick.y + 4, 'text-anchor': 'end', class: 'axis-label' }, shortMoney(tick.value)));
    plot.append(svgNode('line', { x1: g.left, x2: g.right, y1: g.ceilingY, y2: g.ceilingY, class: 'chart-line ceiling' }));
    plot.append(svgNode('polyline', { points: g.actual.map(p => `${p.x},${p.y}`).join(' '), class: 'chart-line actual' }));
    const last = g.actual.at(-1);
    plot.append(svgNode('polyline', { points: `${last.x},${last.y} ${g.future.x},${g.future.y}`, class: 'chart-line forecast' }));
    for (const point of [...g.actual, g.future]) { const dot = svgNode('circle', { cx: point.x, cy: point.y, r: 3, class: 'chart-point' }); dot.append(svgNode('title', {}, `${point.date || '+4 weeks'}: ${money(point.value)}`)); plot.append(dot); }
    const labels = [[g.left, shortDate(g.actual[0].date), 'start'], [g.right, '+4 weeks', 'end']];
    if (g.width >= 380) labels.splice(1, 0, [last.x, shortDate(last.date), 'middle']);
    for (const [x, text, anchor] of labels) plot.append(svgNode('text', { x, y: 252, 'text-anchor': anchor, class: 'axis-label' }, text));
  }
  draw(600);
  const observer = new ResizeObserver(entries => { if (!frame.isConnected) { observer.disconnect(); return; } draw(entries[0].contentRect.width); });
  observer.observe(frame);
  return frame;
}
