import { db } from '@/db/db';
import { clearLookMirror, getSettings } from '@/db/repos/settings';
import { applyToDocument, readLookOverride, resolveTheme, useSettings } from './settingsStore';

const html = document.documentElement;

beforeEach(async () => {
  await db.settings.clear();
  clearLookMirror();
  delete html.dataset.world;
  delete html.dataset.theme;
  delete html.dataset.text;
});

describe('resolveTheme', () => {
  it('keeps Space dark, forces Day/Night, and follows the device for Auto', () => {
    expect(resolveTheme({ world: 'space', night: 'day' }, false)).toBe('dark');
    expect(resolveTheme({ world: 'meadow', night: 'night' }, false)).toBe('dark');
    expect(resolveTheme({ world: 'ocean', night: 'day' }, true)).toBe('light');
    expect(resolveTheme({ world: 'meadow', night: 'auto' }, true)).toBe('dark');
    expect(resolveTheme({ world: 'meadow', night: 'auto' }, false)).toBe('light');
  });
});

describe('settings store', () => {
  it('applies data-world / data-theme / data-text and the theme-color', () => {
    applyToDocument({ world: 'ocean', night: 'night', textSize: 'bigger' }, false);
    expect(html.dataset.world).toBe('ocean');
    expect(html.dataset.theme).toBe('dark');
    expect(html.dataset.text).toBe('bigger');
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute('content', '#e8436f');
  });

  it('hydrates from Dexie, applies, and persists updates', async () => {
    await useSettings.getState().hydrate('');
    expect(html.dataset.world).toBe('meadow');
    expect(html.dataset.theme).toBe('light');
    expect(html.dataset.text).toBe('big');

    await useSettings.getState().update({ world: 'space', textSize: 'bigger' });
    expect(html.dataset.world).toBe('space');
    expect(html.dataset.theme).toBe('dark');
    expect(html.dataset.text).toBe('bigger');
    expect(await getSettings()).toMatchObject({ world: 'space', textSize: 'bigger' });

    // a fresh hydrate reads the saved choice back
    useSettings.setState({
      hydrated: false,
      settings: { ...useSettings.getState().settings, world: 'meadow' },
    });
    await useSettings.getState().hydrate('');
    expect(useSettings.getState().settings.world).toBe('space');
  });

  it('follows the device dark mode only when night is Auto', async () => {
    await useSettings.getState().hydrate('');
    await useSettings.getState().update({ world: 'meadow', night: 'auto' });
    useSettings.getState().setSystemDark(true);
    expect(html.dataset.theme).toBe('dark');
    await useSettings.getState().update({ night: 'day' });
    expect(html.dataset.theme).toBe('light');
  });

  it('accepts the look override from the URL only when allowed', () => {
    expect(readLookOverride('?world=space&night=night&text=bigger', () => true)).toEqual({
      world: 'space',
      night: 'night',
      textSize: 'bigger',
    });
    expect(readLookOverride('?world=space', () => false)).toEqual({});
    expect(readLookOverride('?world=jungle', () => true)).toEqual({});
  });
});
