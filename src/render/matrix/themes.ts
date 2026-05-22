// L3 render. The four built-in appearance palettes the user cycles
// through from the controls panel. Each palette is self-contained: it
// carries the matrix data-region colors AND the controls-panel chrome
// colors so the visual never mixes a dark grid with a light rail. The
// default is Bloomberg — the dense black-and-amber financial-terminal
// look the visual is built for. Resolution is total: an unknown or
// absent name falls back to Bloomberg, so render code never re-checks.

// The four palette identifiers. Anything outside this union resolves to
// the default rather than erroring, so a stale persisted string is safe.
export type AppearanceThemeName = 'bloomberg' | 'launch' | 'newsprint' | 'quartz';

// The matrix data-region color slots. These mirror the resolved-theme
// slots the rest of render already consumes.
interface MatrixColors {
  headerBg: string;
  headerFg: string;
  bodyFg: string;
  borderFg: string;
  altRowBg: string;
}

// The controls-panel chrome color slots. Kept distinct from the matrix
// slots so a palette can, e.g., darken the rail more than the grid.
interface PanelColors {
  bg: string;
  fg: string;
  labelFg: string;
  border: string;
  inputBg: string;
  accent: string;
}

// One complete appearance: a display label plus the page background and
// the two color groups.
export interface AppearanceTheme {
  name: AppearanceThemeName;
  label: string;
  rootBg: string;
  matrix: MatrixColors;
  panel: PanelColors;
}

const BLOOMBERG: AppearanceTheme = {
  name: 'bloomberg',
  label: 'Bloomberg Terminal',
  rootBg: '#000000',
  matrix: {
    headerBg: '#0d0d0d',
    headerFg: '#ff9500',
    bodyFg: '#ffb000',
    borderFg: '#1a1a1a',
    altRowBg: '#080808',
  },
  panel: {
    bg: '#000000',
    fg: '#ffb000',
    labelFg: '#ff9500',
    border: '#332200',
    inputBg: '#1a1100',
    accent: '#ffd060',
  },
};

const LAUNCH: AppearanceTheme = {
  name: 'launch',
  label: 'Launch Console',
  rootBg: '#0b0e14',
  matrix: {
    headerBg: '#161a20',
    headerFg: '#a7adb8',
    bodyFg: '#e8eaed',
    borderFg: '#262a32',
    altRowBg: '#10131a',
  },
  panel: {
    bg: '#1f2228',
    fg: '#e8eaed',
    labelFg: '#9ba0a8',
    border: '#3a3d44',
    inputBg: '#2a2e36',
    accent: '#7ed1c2',
  },
};

const NEWSPRINT: AppearanceTheme = {
  name: 'newsprint',
  label: 'Newsprint',
  rootBg: '#f9f6ef',
  matrix: {
    headerBg: '#ebe6d8',
    headerFg: '#1a1a1a',
    bodyFg: '#1a1a1a',
    borderFg: '#c4bfb1',
    altRowBg: '#f3eede',
  },
  panel: {
    bg: '#ebe6d8',
    fg: '#1a1a1a',
    labelFg: '#5c5751',
    border: '#c4bfb1',
    inputBg: '#f9f6ef',
    accent: '#8b3a2a',
  },
};

const QUARTZ: AppearanceTheme = {
  name: 'quartz',
  label: 'Quartz',
  rootBg: '#ffffff',
  matrix: {
    headerBg: '#fafafa',
    headerFg: '#525252',
    bodyFg: '#171717',
    borderFg: '#e5e5e5',
    altRowBg: '#fafafa',
  },
  panel: {
    bg: '#fafafa',
    fg: '#171717',
    labelFg: '#737373',
    border: '#e5e5e5',
    inputBg: '#ffffff',
    accent: '#2563eb',
  },
};

// The default. Named so resolution and tests reference one symbol.
const DEFAULT_THEME_NAME: AppearanceThemeName = 'bloomberg';

// Every palette by name. Render never indexes this directly — it goes
// through resolveAppearanceTheme so the fallback is impossible to skip.
export const APPEARANCE_THEMES: Record<AppearanceThemeName, AppearanceTheme> = {
  bloomberg: BLOOMBERG,
  launch: LAUNCH,
  newsprint: NEWSPRINT,
  quartz: QUARTZ,
};

// Total resolution: a known name returns its palette; anything else
// (undefined, '', a renamed-away value) returns Bloomberg. Render code
// downstream is therefore free of palette-absent branches.
export function resolveAppearanceTheme(name: string | undefined): AppearanceTheme {
  if (name && name in APPEARANCE_THEMES) {
    return APPEARANCE_THEMES[name as AppearanceThemeName];
  }
  return APPEARANCE_THEMES[DEFAULT_THEME_NAME];
}

// The dropdown source for the controls panel: [value, label] pairs with
// the default listed first so it is the visible option before any
// persisted choice loads.
export const APPEARANCE_OPTIONS: ReadonlyArray<readonly [AppearanceThemeName, string]> = [
  ['bloomberg', BLOOMBERG.label],
  ['launch', LAUNCH.label],
  ['newsprint', NEWSPRINT.label],
  ['quartz', QUARTZ.label],
];
