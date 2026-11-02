/**
 * Visual QA screenshots: routes × worlds × themes × viewports.
 *
 * Usage (from the repo root):
 *   npx tsx scripts/screenshot.ts [options]
 *
 * Options (all optional):
 *   --url <base>         use a running app (e.g. http://localhost:5173). Without it a Vite dev server
 *                        is started on a free port and stopped at the end.
 *   --routes <list>      comma-separated paths            (default "/,/me")
 *   --worlds <list>      meadow,ocean,space               (default all three)
 *   --themes <list>      light,dark                       (default both; Space is always dark, shot once)
 *   --viewports <list>   WxH list                          (default "768x1024,390x844")
 *   --text <size>        big | bigger                     (default big)
 *   --now <time>         fake clock, IST wall time         (default 2026-11-02T17:40, a Monday)
 *   --out <dir>          output folder                     (default docs/design/react)
 *   --motion             keep animations on (default: reduced motion, for stable stills)
 *   --viewport-only      capture the viewport instead of the full page
 *
 * Files are named <route>-<world>-<theme>-<phone|tablet>.png ("/" is "today").
 * The look and the clock come from dev-only URL params (?world=&night=&text=&now=), which the app
 * honours only in dev builds or builds made with VITE_ALLOW_FAKE_CLOCK=1. The script also reports
 * horizontal overflow, which must never happen (NOTES.md).
 *
 * From Git Bash, prefix with MSYS_NO_PATHCONV=1 so "/" routes are not rewritten into Windows paths.
 *
 * Examples:
 *   npx tsx scripts/screenshot.ts
 *   npx tsx scripts/screenshot.ts --routes /,/week,/progress,/me,/kit --worlds space --out tmp/shots
 *   npx tsx scripts/screenshot.ts --url http://localhost:4173 --routes /lesson/2026-11-02/3
 */
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer, type ViteDevServer } from 'vite';

type Theme = 'light' | 'dark';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v && !v.startsWith('--') ? v : fallback;
}
const flag = (name: string) => process.argv.includes(`--${name}`);
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

const routes = list(arg('routes', '/,/me'));
const worlds = list(arg('worlds', 'meadow,ocean,space'));
const themes = list(arg('themes', 'light,dark')) as Theme[];
const viewports = list(arg('viewports', '768x1024,390x844')).map((v) => {
  const [w, h] = v.split('x').map(Number);
  if (!w || !h) throw new Error(`Bad viewport "${v}" (use WxH, e.g. 390x844)`);
  return { width: w, height: h };
});
const text = arg('text', 'big');
const now = arg('now', '2026-11-02T17:40');
const out = resolve(arg('out', 'docs/design/react'));
const fullPage = !flag('viewport-only');

const slug = (route: string) =>
  route === '/'
    ? 'today'
    : route
        .replace(/^\//, '')
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/-+$/, '');

async function main() {
  let server: ViteDevServer | undefined;
  let base = arg('url', '');
  if (!base) {
    server = await createServer({ server: { port: 5199, strictPort: false }, logLevel: 'error' });
    await server.listen();
    base = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:5199';
  }
  await mkdir(out, { recursive: true });
  const browser = await chromium.launch();
  const problems: string[] = [];
  let count = 0;
  try {
    for (const vp of viewports) {
      const device = vp.width >= 600 ? 'tablet' : 'phone';
      for (const world of worlds) {
        const worldThemes: Theme[] = world === 'space' ? ['dark'] : themes;
        for (const theme of worldThemes) {
          const ctx = await browser.newContext({
            viewport: vp,
            deviceScaleFactor: 1,
            timezoneId: 'Asia/Kolkata',
            colorScheme: theme,
            reducedMotion: flag('motion') ? 'no-preference' : 'reduce',
            hasTouch: device === 'phone',
          });
          const page = await ctx.newPage();
          for (const route of routes) {
            const night = theme === 'dark' ? 'night' : 'day';
            const sep = route.includes('?') ? '&' : '?';
            const url = `${base}${route}${sep}now=${encodeURIComponent(now)}&world=${world}&night=${night}&text=${text}`;
            await page.goto(url, { waitUntil: 'networkidle' });
            await page.waitForFunction('document.fonts.status === "loaded"');
            await page.waitForTimeout(450);
            const overflow = (await page.evaluate(
              '[document.documentElement.scrollWidth, window.innerWidth]',
            )) as [number, number];
            if (overflow[0] > overflow[1]) {
              problems.push(
                `${route} ${world}/${theme} ${device}: horizontal overflow ${overflow[0]} > ${overflow[1]}`,
              );
            }
            const file = `${out}/${slug(route)}-${world}-${theme}-${device}.png`;
            if (fullPage) {
              // Grow the viewport to the page height so fixed UI (tab bar) sits at the bottom, as on a device.
              const h = (await page.evaluate('document.documentElement.scrollHeight')) as number;
              await page.setViewportSize({ width: vp.width, height: Math.max(vp.height, h) });
              await page.waitForTimeout(200);
            }
            await page.screenshot({ path: file });
            if (fullPage) await page.setViewportSize(vp);
            count++;
            console.log(`saved ${file}`);
          }
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
    await server?.close();
  }
  console.log(`\n${count} screenshot(s) in ${out}`);
  if (problems.length) {
    console.error(`\nProblems:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
