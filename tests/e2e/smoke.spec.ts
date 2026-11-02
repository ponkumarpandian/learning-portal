import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('Phase 0 smoke', () => {
  test('the app loads on Today with Tara, the trail and the tab bar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Avantika');
    await expect(page.getByRole('list', { name: 'Today’s trail' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('html')).toHaveAttribute('data-world', 'meadow');
  });

  test('no request ever leaves the device’s own origin (no analytics, no external fonts — §12)', async ({
    page,
    baseURL,
  }) => {
    const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
    const outside: string[] = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.startsWith('data:') && !url.startsWith('blob:') && new URL(url).origin !== origin)
        outside.push(url);
    });
    for (const path of ['/', '/week', '/progress', '/me']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    await page.waitForLoadState('networkidle');
    expect(outside).toEqual([]);
  });

  test('tab navigation works', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });

    await nav.getByRole('link', { name: 'Week' }).click();
    await expect(page).toHaveURL(/\/week$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Your week');
    await expect(nav.getByRole('link', { name: 'Week' })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: 'Rewards' }).click();
    await expect(page).toHaveURL(/\/progress$/);
    await expect(page.getByRole('heading', { name: 'Sticker book' })).toBeVisible();

    await nav.getByRole('link', { name: 'Me' }).click();
    await expect(page).toHaveURL(/\/me$/);
    await expect(page.getByRole('heading', { name: 'Pick your world' })).toBeVisible();

    await nav.getByRole('link', { name: 'Today' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Today’s trail' })).toBeVisible();
  });

  test('Me → Space switches the world, is always dark, and is remembered', async ({ page }) => {
    await page.goto('/me');
    await page.getByRole('radio', { name: /Space/ }).check({ force: true });
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-world', 'space');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByText('Space is always cosy and dark')).toBeVisible();

    await page.reload();
    await expect(html).toHaveAttribute('data-world', 'space');
    await expect(page.getByRole('radio', { name: /Space/ })).toBeChecked();
  });

  test('focus routes hide the tab bar and unknown routes are friendly', async ({ page }) => {
    await page.goto('/lesson/2026-11-02/3');
    await expect(page.getByRole('navigation', { name: 'Main' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Leave the lesson' }).click();
    await expect(page.getByRole('button', { name: 'Keep going' })).toBeFocused();

    await page.goto('/no-such-place');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('not on the map');
    await page.getByRole('link', { name: /Back to my trail/ }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`Today in ${scheme} mode follows the device and has no serious or critical accessibility issues`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(page.getByRole('list', { name: 'Today’s trail' })).toBeVisible();
      await expect(page.locator('.trail.is-laid-out')).toHaveCount(1);
      await page.waitForTimeout(1200); // let the stones finish popping in (contrast is checked on the final look)
      const results = await new AxeBuilder({ page }).analyze();
      const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
});
