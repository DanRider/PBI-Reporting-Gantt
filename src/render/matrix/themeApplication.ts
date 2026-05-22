// L3 render. The one helper that paints a header cell from the resolved
// palette. It mutates an existing element and never creates DOM, so the
// renderers that build the <thead>/<tfoot> own element lifetime while
// this owns only the look. Styles are written inline on the element
// because the Power BI host iframe injects its own stylesheet that wins
// the cascade against class rules — inline properties are the only
// reliable way to set chrome the host would otherwise override.

import type { ResolvedTheme } from '../../primitives/theme';

// Applies the header look — background, foreground, bottom rule, and a
// semibold weight — to a <th> the caller already appended.
export function styleHeader(el: HTMLElement, theme: ResolvedTheme): void {
  el.style.background = theme.headerBg;
  el.style.color = theme.headerFg;
  el.style.borderBottom = `1px solid ${theme.borderFg}`;
  el.style.fontWeight = '600';
}
