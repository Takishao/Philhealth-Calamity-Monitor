// Presentation geometry only: no financial calculation or forecast is changed here.
export function chartGeometry(data, width) {
  const w = Math.max(220, Number(width) || 220), height = 280;
  const left = 68, right = w - 16, top = 24, bottom = 220;
  const weeks = data.forecast.weeks || [];
  let cumulative = data.totals.committed - weeks.reduce((sum, week) => sum + week.amount, 0);
  const values = weeks.map(week => ({ date: week.week, value: cumulative += week.amount }));
  if (!values.length) values.push({ date: data.settings.as_of_date, value: data.totals.committed });
  const ceiling = data.totals.ceiling, projected = data.forecast.projected;
  const max = Math.max(ceiling, projected, data.totals.committed, ...values.map(point => point.value), 1) * 1.12;
  const min = Math.min(0, ...values.map(point => point.value));
  const horizon = data.forecast.horizonWeeks || 4, intervals = Math.max(1, values.length - 1) + horizon;
  const x = index => left + index / intervals * (right - left);
  const y = value => bottom - (value - min) / (max - min) * (bottom - top);
  const actual = values.map((point, index) => ({ ...point, x: x(index), y: y(point.value) }));
  const future = { x: right, y: y(projected), value: projected };
  return { width: w, height, left, right, top, bottom, actual, future, ceilingY: y(ceiling), ticks: Array.from({ length: 5 }, (_, i) => { const value = min + (max - min) * i / 4; return { value, y: y(value) }; }) };
}
