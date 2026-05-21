// L3 render. The left rail — a vertical panel of fast affordances that
// sit beside the data instead of buried in the format pane: a reporting-
// month picker (only when a date binding offers months), a period toggle
// group (MTD/QTD/YTD/FY), the compare-against selector, denomination,
// decimals, the appearance-theme dropdown, and the K/M letter switch.
// Every control writes its change straight back through the host's
// persistProperties channel; the persisted format state stays canonical
// and this panel is just the quick way to reach it. The whole thing is a
// no-op without a host (unit tests, no live report), and its chrome
// colors come from the active appearance theme so the rail and the grid
// stay one consistent surface.

import powerbi from 'powerbi-visuals-api';

import { clamp, DECIMALS } from '../../primitives/clamp';
import type { CompareAgainstMode, Denomination, FormatOptions } from '../../model/formatOptions';
import { APPEARANCE_OPTIONS, resolveAppearanceTheme, type AppearanceTheme } from './themes';

import DataViewPropertyValue = powerbi.DataViewPropertyValue;

const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// The persist object names. Each maps one control to the flat
// FormatOptions field the host round-trips it through.
const OBJ_REPORTING = 'reportingDate';
const OBJ_PERIODS = 'computedColumns';
const OBJ_COMPARE = 'compareAgainst';
const OBJ_LAYOUT = 'layout';
const OBJ_APPEARANCE = 'appearance';

const COMPARE_OPTIONS: ReadonlyArray<readonly [CompareAgainstMode, string]> = [
  ['priorYear', 'Prior Year (AvA)'],
  ['budget', 'Budget (BvA)'],
  ['forecast', 'Forecast (FvA)'],
  ['forecastVsForecast', 'Fcst vs Fcst (FvF)'],
];

const DENOMINATION_OPTIONS: ReadonlyArray<readonly [Denomination, string]> = [
  ['dollars', 'Dollars ($)'],
  ['thousands', 'Thousands (K)'],
  ['millions', 'Millions (M)'],
];

const COMPARE_TAGS: Record<CompareAgainstMode, string> = {
  priorYear: 'AvA',
  budget: 'BvA',
  forecast: 'FvA',
  forecastVsForecast: 'FvF',
};

// The four period toggles, paired with the boolean field each persists.
const PERIOD_TOGGLES: ReadonlyArray<readonly [string, 'showMtd' | 'showQtd' | 'showYtd' | 'showFy']> = [
  ['MTD', 'showMtd'],
  ['QTD', 'showQtd'],
  ['YTD', 'showYtd'],
  ['FY', 'showFy'],
];

// The chrome palette pulled once from the active theme and threaded into
// every control so the rail is internally consistent.
interface PanelChrome {
  border: string;
  bg: string;
  fg: string;
  labelFg: string;
  inputBg: string;
  accent: string;
}

function chromeFrom(theme: AppearanceTheme): PanelChrome {
  return {
    border: `1px solid ${theme.panel.border}`,
    bg: theme.panel.bg,
    fg: theme.panel.fg,
    labelFg: theme.panel.labelFg,
    inputBg: theme.panel.inputBg,
    accent: theme.panel.accent,
  };
}

function styleSelect(el: HTMLSelectElement, chrome: PanelChrome): void {
  el.style.fontSize = '11px';
  el.style.padding = '3px 4px';
  el.style.border = chrome.border;
  el.style.background = chrome.inputBg;
  el.style.color = chrome.fg;
  el.style.cursor = 'pointer';
  el.style.width = '100%';
  el.style.boxSizing = 'border-box';
}

function labelEl(text: string, chrome: PanelChrome): HTMLElement {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.fontSize = '10px';
  el.style.color = chrome.labelFg;
  el.style.marginBottom = '2px';
  el.style.textTransform = 'uppercase';
  el.style.letterSpacing = '0.04em';
  return el;
}

function fieldEl(label: string, control: HTMLElement, chrome: PanelChrome): HTMLElement {
  const field = document.createElement('div');
  field.style.display = 'flex';
  field.style.flexDirection = 'column';
  field.style.gap = '2px';
  field.appendChild(labelEl(label, chrome));
  field.appendChild(control);
  return field;
}

function optionEl(value: string, label: string): HTMLOptionElement {
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  return opt;
}

// Renders the YYYY-MM[-DD] anchor as "2026 May"; anything that does not
// split into at least year and month is shown verbatim.
function monthLabel(iso: string): string {
  const parts = iso.split('-');
  if (parts.length >= 2) {
    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    if (!Number.isNaN(year) && monthIndex >= 0 && monthIndex < 12) {
      return `${year} ${MONTH_ABBR[monthIndex]}`;
    }
  }
  return iso;
}

// One-line persist helper bound to the live host. Callers never see the
// merge envelope shape.
function makePersist(opts: FormatOptions): (objectName: string, properties: Record<string, DataViewPropertyValue>) => void {
  return (objectName, properties) => {
    opts.host?.persistProperties({
      merge: [{ objectName, selector: {}, properties }],
    });
  };
}

function buildHeader(panel: HTMLElement, mode: CompareAgainstMode, chrome: PanelChrome): void {
  const bar = document.createElement('div');
  bar.style.display = 'flex';
  bar.style.justifyContent = 'flex-end';
  bar.style.marginBottom = '4px';
  const tag = document.createElement('span');
  tag.textContent = COMPARE_TAGS[mode] ?? mode;
  tag.style.fontSize = '10px';
  tag.style.fontWeight = '600';
  tag.style.color = chrome.accent;
  tag.style.letterSpacing = '0.06em';
  bar.appendChild(tag);
  panel.appendChild(bar);
}

function buildMonthPicker(
  panel: HTMLElement,
  opts: FormatOptions,
  chrome: PanelChrome,
  persist: (o: string, p: Record<string, DataViewPropertyValue>) => void,
): void {
  const months = opts.availableMonths ?? [];
  if (months.length === 0) {
    return;
  }
  const select = document.createElement('select');
  styleSelect(select, chrome);
  select.appendChild(optionEl('', '(max)'));
  for (const iso of months) {
    select.appendChild(optionEl(iso, monthLabel(iso)));
  }
  select.value = opts.selectedDate ?? '';
  select.onchange = (e) => {
    e.stopPropagation();
    persist(OBJ_REPORTING, { selectedDate: (e.target as HTMLSelectElement).value });
  };
  panel.appendChild(fieldEl('Reporting month', select, chrome));
}

function buildPeriodToggles(
  panel: HTMLElement,
  opts: FormatOptions,
  chrome: PanelChrome,
  persist: (o: string, p: Record<string, DataViewPropertyValue>) => void,
): void {
  panel.appendChild(labelEl('Periods', chrome));
  const grid = document.createElement('div');
  grid.style.display = 'grid';
  grid.style.gridTemplateColumns = '1fr 1fr 1fr 1fr';
  grid.style.gap = '3px';
  for (const [text, field] of PERIOD_TOGGLES) {
    const active = opts[field] !== false;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.style.fontSize = '10px';
    btn.style.padding = '3px 0';
    btn.style.border = chrome.border;
    btn.style.background = active ? chrome.accent : chrome.inputBg;
    btn.style.color = active ? chrome.bg : chrome.labelFg;
    btn.style.fontWeight = active ? '600' : '400';
    btn.style.cursor = 'pointer';
    btn.style.borderRadius = '2px';
    btn.onclick = (e) => {
      e.stopPropagation();
      persist(OBJ_PERIODS, { [field]: !active });
    };
    grid.appendChild(btn);
  }
  panel.appendChild(grid);
}

function buildSelectField(
  panel: HTMLElement,
  chrome: PanelChrome,
  label: string,
  options: ReadonlyArray<readonly [string, string]>,
  current: string,
  onPick: (value: string) => void,
): void {
  const select = document.createElement('select');
  styleSelect(select, chrome);
  for (const [value, text] of options) {
    select.appendChild(optionEl(value, text));
  }
  select.value = current;
  select.onchange = (e) => {
    e.stopPropagation();
    onPick((e.target as HTMLSelectElement).value);
  };
  panel.appendChild(fieldEl(label, select, chrome));
}

function buildDecimals(
  panel: HTMLElement,
  opts: FormatOptions,
  chrome: PanelChrome,
  persist: (o: string, p: Record<string, DataViewPropertyValue>) => void,
): void {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = String(DECIMALS.min);
  input.max = String(DECIMALS.max);
  input.step = '1';
  input.value = String(opts.decimals ?? DECIMALS.default);
  input.style.fontSize = '11px';
  input.style.padding = '3px 4px';
  input.style.border = chrome.border;
  input.style.background = chrome.inputBg;
  input.style.color = chrome.fg;
  input.style.width = '100%';
  input.style.boxSizing = 'border-box';
  input.onchange = (e) => {
    e.stopPropagation();
    const parsed = parseInt((e.target as HTMLInputElement).value || '0', 10);
    persist(OBJ_LAYOUT, { decimals: clamp(parsed, DECIMALS) });
  };
  panel.appendChild(fieldEl('Decimals', input, chrome));
}

function buildLetterToggle(
  panel: HTMLElement,
  opts: FormatOptions,
  chrome: PanelChrome,
  persist: (o: string, p: Record<string, DataViewPropertyValue>) => void,
): void {
  const row = document.createElement('label');
  row.style.display = 'flex';
  row.style.alignItems = 'center';
  row.style.gap = '5px';
  row.style.fontSize = '11px';
  row.style.color = chrome.fg;
  row.style.cursor = 'pointer';
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = opts.showLetter !== false;
  box.style.margin = '0';
  box.onchange = (e) => {
    e.stopPropagation();
    persist(OBJ_LAYOUT, { showLetter: box.checked });
  };
  const text = document.createElement('span');
  text.textContent = 'Show K/M letter';
  row.appendChild(box);
  row.appendChild(text);
  panel.appendChild(row);
}

// No host means no live report (unit test path) — there is nothing to
// persist into, so the panel renders nothing rather than dead controls.
export function renderControlsPanel(panel: HTMLElement, opts: FormatOptions): void {
  if (!opts.host) {
    return;
  }
  const appearance = resolveAppearanceTheme(opts.appearanceTheme);
  const chrome = chromeFrom(appearance);
  const persist = makePersist(opts);
  const mode = opts.compareAgainstMode ?? 'priorYear';

  panel.style.display = 'flex';
  panel.style.flexDirection = 'column';
  panel.style.gap = '8px';
  panel.style.padding = '10px';
  panel.style.boxSizing = 'border-box';
  panel.style.background = chrome.bg;
  panel.style.color = chrome.fg;
  panel.style.borderRight = chrome.border;
  panel.style.fontSize = '11px';
  panel.style.width = '180px';
  panel.style.overflow = 'hidden';
  panel.onclick = (e) => e.stopPropagation();

  buildHeader(panel, mode, chrome);
  buildMonthPicker(panel, opts, chrome, persist);
  buildPeriodToggles(panel, opts, chrome, persist);
  buildSelectField(
    panel, chrome, 'Compare against', COMPARE_OPTIONS, mode,
    (value) => persist(OBJ_COMPARE, { mode: value }),
  );
  buildSelectField(
    panel, chrome, 'Denomination', DENOMINATION_OPTIONS, opts.denomination ?? 'dollars',
    (value) => persist(OBJ_LAYOUT, { denomination: value }),
  );
  buildDecimals(panel, opts, chrome, persist);
  buildSelectField(
    panel, chrome, 'Theme', APPEARANCE_OPTIONS, opts.appearanceTheme ?? 'bloomberg',
    (value) => persist(OBJ_APPEARANCE, { theme: value }),
  );
  buildLetterToggle(panel, opts, chrome, persist);
}
