// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';

import { renderControlsPanel } from './controlsPanel';
import { FakeHost, renderOpts } from './__fixtures__/tree';

import powerbi from 'powerbi-visuals-api';

import IVisualHost = powerbi.extensibility.visual.IVisualHost;

function panel(): HTMLElement {
  return document.createElement('div');
}

describe('renderControlsPanel — no host means no panel', () => {
  it('renders nothing without a host (unit-test path)', () => {
    const el = panel();
    renderControlsPanel(el, renderOpts());
    expect(el.childNodes).toHaveLength(0);
  });
});

describe('renderControlsPanel — control inventory', () => {
  it('renders compare, denomination, decimals, theme, K/M, and period toggles', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const selects = el.querySelectorAll('select');
    // compare-against, denomination, theme
    expect(selects.length).toBe(3);
    expect(el.querySelectorAll('input[type=number]')).toHaveLength(1);
    expect(el.querySelectorAll('input[type=checkbox]')).toHaveLength(1);
    // 4 period pills
    expect(el.querySelectorAll('button[type=button]')).toHaveLength(4);
  });

  it('the month picker appears only when months are bound', () => {
    const host = new FakeHost();
    const without = panel();
    renderControlsPanel(without, renderOpts({ host: host as unknown as IVisualHost }));
    const selectsWithout = without.querySelectorAll('select').length;

    const withMonths = panel();
    renderControlsPanel(
      withMonths,
      renderOpts({
        host: host as unknown as IVisualHost,
        availableMonths: ['2026-04-01', '2026-05-01'],
      }),
    );
    expect(withMonths.querySelectorAll('select').length).toBe(selectsWithout + 1);
  });
});

describe('renderControlsPanel — persistence through host.persistProperties', () => {
  it('changing the compare-against select persists the new mode', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const compare = el.querySelectorAll('select')[0];
    compare.value = 'budget';
    compare.dispatchEvent(new Event('change'));
    expect(host.persisted).toContainEqual({
      objectName: 'compareAgainst',
      properties: { mode: 'budget' },
    });
  });

  it('toggling a period pill persists the inverted boolean', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const mtd = el.querySelectorAll('button[type=button]')[0];
    mtd.dispatchEvent(new MouseEvent('click'));
    expect(host.persisted).toContainEqual({
      objectName: 'computedColumns',
      properties: { showMtd: false },
    });
  });

  it('the decimals input clamps before persisting', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const dec = el.querySelector('input[type=number]') as HTMLInputElement;
    dec.value = '99';
    dec.dispatchEvent(new Event('change'));
    const persisted = host.persisted.find((p) => 'decimals' in p.properties);
    expect(persisted?.properties.decimals).toBe(4); // DECIMALS.max
  });

  it('the K/M checkbox persists showLetter', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const box = el.querySelector('input[type=checkbox]') as HTMLInputElement;
    box.checked = false;
    box.dispatchEvent(new Event('change'));
    expect(host.persisted).toContainEqual({
      objectName: 'tableLayout',
      properties: { showLetter: false },
    });
  });

  it('the theme dropdown persists the chosen appearance', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(el, renderOpts({ host: host as unknown as IVisualHost }));
    const selects = el.querySelectorAll('select');
    const themeSelect = selects[selects.length - 1];
    themeSelect.value = 'quartz';
    themeSelect.dispatchEvent(new Event('change'));
    expect(host.persisted).toContainEqual({
      objectName: 'appearance',
      properties: { theme: 'quartz' },
    });
  });

  it('the panel chrome follows the active appearance theme', () => {
    const host = new FakeHost();
    const el = panel();
    renderControlsPanel(
      el,
      renderOpts({ host: host as unknown as IVisualHost, appearanceTheme: 'quartz' }),
    );
    // Quartz panel.bg is #fafafa
    expect(el.style.background).toBe('rgb(250, 250, 250)');
  });
});
