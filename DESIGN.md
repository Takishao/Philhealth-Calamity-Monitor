# Design verification

Logo sampled from existing RGBA PNG, opaque saturated pixels counted: [((252, 209, 22), 2484), ((0, 146, 70), 969), ((149, 124, 13), 79)]

| Pair | Foreground | Background | Ratio | Usage |
|---|---|---|---|---|
|Text/surface|#172a21|#ffffff|15.11:1|Text AA|
|Text/canvas|#172a21|#f5f8f5|14.13:1|Text AA|
|Muted/surface|#526259|#ffffff|6.46:1|Text AA|
|Muted/canvas|#526259|#f5f8f5|6.04:1|Text AA|
|Primary button|#ffffff|#006b33|6.66:1|Text AA|
|Accent decorative only|#009246|#ffffff|4.04:1|UI only (3:1)|
|Secondary text|#604f08|#fcd116|5.45:1|Text AA|
|Normal|#166534|#edf8ef|6.54:1|Text AA|
|Warning|#854d0e|#fff7df|6.40:1|Text AA|
|Danger|#b91c1c|#fff0f0|5.85:1|Text AA|
|Critical|#7f1d1d|#ffe9e9|8.63:1|Text AA|
|Border UI|#718079|#ffffff|4.15:1|UI only (3:1)|
|Dark text|#edf7f0|#20372a|11.68:1|Text AA|
|Dark muted|#c0d5c7|#20372a|8.28:1|Text AA|
|Dark link|#ade9bd|#20372a|9.24:1|Text AA|

Status always combines icon, text and color. Yellow is a brand accent, never a text foreground on white. Sample green is decorative; primary text/button shade preserves green hue and increases contrast. Logo aspect ratio 330:121 is preserved with height:auto. Chart has text description, dates and ceiling label. Light and dark themes retained.

## Rendered verification

Focused browser checks: 325px mobile (one KPI column), 640px tablet (two), 1200px desktop (four). At each measured width document scrollWidth equals viewport width. Native screenshots capture all four budget conditions. Light dashboard 89 text checks and dark critical dashboard 91 text checks returned zero contrast failures. Decorative SVG icons use aria-hidden with visible status labels. Brand logo and favicon are the only non-Lucide identity graphics.
