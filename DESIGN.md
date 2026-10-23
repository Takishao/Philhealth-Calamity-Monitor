# Current design system

Shared radii: button 12px; input and dropdown panel alias the button token; card 16px. Spacing tokens: 4/8/12/16/24/32px. All active stylesheet colors are tokens. Neutral Light/Dark surfaces replace the old green appearance. Brand colors remain sampled from the supplied logo: #FCD116 and #009246; primary uses #006B33 for contrast.

| Theme | Pair | Foreground | Background | Ratio | Minimum |
|---|---|---|---|---|---|
| Light | --text / --surface | #18212b | #fff | 16.26:1 | 4.5:1 |
| Light | --muted / --surface | #52606d | #fff | 6.46:1 | 4.5:1 |
| Light | --text / --surface-raised | #18212b | #edf1f5 | 14.33:1 | 4.5:1 |
| Light | --primary-text / --primary | #fff | #006b33 | 6.66:1 | 4.5:1 |
| Light | --normal / --normal-bg | #166534 | #edf8ef | 6.54:1 | 4.5:1 |
| Light | --warning / --warning-bg | #854d0e | #fff7df | 6.40:1 | 4.5:1 |
| Light | --danger / --danger-bg | #b91c1c | #fff0f0 | 5.85:1 | 4.5:1 |
| Light | --critical / --critical-bg | #7f1d1d | #ffe9e9 | 8.63:1 | 4.5:1 |
| Light | --info / --info-bg | #234e70 | #edf5fc | 7.96:1 | 4.5:1 |
| Light | --border / --surface | #7b8794 | #fff | 3.66:1 | 3:1 |
| Light | --chart-ceiling / --surface | #842f3f | #fff | 8.54:1 | 3:1 |
| Dark | --text / --surface | #eff3f7 | #1d2630 | 13.73:1 | 4.5:1 |
| Dark | --muted / --surface | #c0cad4 | #1d2630 | 9.21:1 | 4.5:1 |
| Dark | --text / --surface-raised | #eff3f7 | #263340 | 11.55:1 | 4.5:1 |
| Dark | --primary-text / --primary | #fff | #006b33 | 6.66:1 | 4.5:1 |
| Dark | --normal / --normal-bg | #a7e9bc | #183b26 | 8.88:1 | 4.5:1 |
| Dark | --warning / --warning-bg | #ffe099 | #433615 | 9.21:1 | 4.5:1 |
| Dark | --danger / --danger-bg | #ffb5b5 | #4a2427 | 7.97:1 | 4.5:1 |
| Dark | --critical / --critical-bg | #ffd2d2 | #4c1d26 | 10.19:1 | 4.5:1 |
| Dark | --info / --info-bg | #b7ddff | #18354c | 8.96:1 | 4.5:1 |
| Dark | --border / --surface | #7c8a99 | #1d2630 | 4.34:1 | 3:1 |
| Dark | --chart-ceiling / --surface | #ffb5c0 | #1d2630 | 9.20:1 | 3:1 |

Only local Lucide SVGs represent icons. Color always accompanies an icon and text for conditions. Dropdowns have 12px triggers, panels and options, clipped outer corners and inset focus outlines. Shared flex rows center pagination and modal actions.

Chart styles are scoped to .trend-svg/.chart-line, never all SVGs. ResizeObserver recalculates presentation geometry only. The chart has a 280px height, 12px labels, zero-based amount axis, date ticks reduced on narrow screens, exact-value titles and a solid/dashed/dotted legend. Flat data is explicitly explained.

Browser evidence: 35 page/theme records plus final three-mode modal checks; zero checked text-contrast failures. Actual mobile CSS width 443px equals document scrollWidth; chart 368.9x280px, all labels within viewport. Desktop/default header controls and pagination/action groups share center lines; all visible button radii are 12px. Focused checks are not a full accessibility certification.

## Brand and dropdown refinement

Shared brand.js uses the owner-supplied symbol unchanged, with live bold PhilHealth and smaller regular Your partner in health text. A measured SVG viewport removes only transparent display margins; the raster asset is not edited. Logo text colors use --logo-text and --logo-muted on --logo-surface. Dropdown rows use --dropdown-row-height:40px, --dropdown-highlight-width:1px and --dropdown-focus-width:2px, with 4px row gaps. Menus fit their longest label within viewport bounds to avoid unnecessary multi-line highlights.

The brand wrapper is transparent with no white tile or padding. Name/tagline use theme-aware foregrounds: Light #123826 / #52606D on the white header (12.97:1 / 6.46:1); Dark #EFF3F7 / #C0CAD4 on #1D2630 (13.73:1 / 9.21:1). Tagline sits below the name with an 8px gap. Browser-verified in both themes.
