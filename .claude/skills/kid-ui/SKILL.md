---
name: kid-ui
description: Use when building or changing any kid-facing screen, component, layout, style, animation or on-screen text in Avantika's Adventure. That includes Today, Week, Rewards, Me, lesson, test, results, sheets and buttons, colours and tokens, worlds and night mode, text size, Tara, confetti and reduced motion, and visual QA screenshots.
---

# Kid UI cheat-sheet (SPEC §15, §12, App E)

The look is the prototype: `docs/theme-prototype.html`, plus the measured sizes in `docs/design/NOTES.md`. Port the **look** into React components and never copy the prototype's structure. **Reuse the components first**. Their props are in [components.md](components.md).

## Theming contract

- `<html data-world="meadow|ocean|space" data-theme="light|dark" data-text="big|bigger">`. These attributes are set only by `src/state/settingsStore.ts` (`applyToDocument`).
- Use `useSettings((s) => s.settings)`, `s.theme` (the resolved theme) and `s.update(patch)`.
- Space is always dark. Subject colours never change between worlds.

## Tokens (`src/styles/tokens.css`). Never use raw hex in components.

| Token(s)                                                                        | Use                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `--sky1 --sky2`                                                                 | page background gradient                                                              |
| `--surface --surface2`                                                          | cards and panels / tracks and soft buttons                                            |
| `--ink --ink-soft`                                                              | text / secondary text                                                                 |
| `--line --ledge`                                                                | borders and kolam dots / the solid "3D" bottom edge of cards                          |
| `--go --go-d --on-go`                                                           | the one big action, its edge, the text on it. Small text on a go colour uses `--go-d` |
| `--tab-on`                                                                      | selected tab, segment and day pill (with a `--go` border)                             |
| `--ok-bg --ok-ink` · `--hint-bg --hint-ink`                                     | "Yes! ⭐" feedback · "Almost! 💡" feedback                                            |
| `--catch --catch-d`                                                             | catch-up and "tried" state: **soft amber, never red**                                 |
| `--trail --trail-bg`                                                            | the trail's dotted line and ground stroke                                             |
| `--deco --deco2` · `--tara --tara-ear`                                          | world decorations · the mascot                                                        |
| `--focus`                                                                       | focus ring: `outline: 4px solid var(--focus); outline-offset: 3px`                    |
| `--<subject>` `-d` `--on-<subject>`                                             | maths, physics, chemistry, biology, english, history, geography                       |
| `--tuition --lang --dance --sport --fun` (+ `-d`, `--on-`)                      | activity, rest-stop and break colours                                                 |
| `--gold --gold-d --on-gold`                                                     | stars, ticks, medals, test stones                                                     |
| `--fs-xs sm body lg question button greeting h1 display`                        | type scale (question and button are 1.35rem, greeting 1.45rem)                        |
| `--r-card 26` `--r-btn 20` `--r-option 20` `--r-key 12` `--r-pill`              | corners by role                                                                       |
| `--btn-h --option-h --tab-h --close --stone --stone-now --step --key --tap-min` | component sizes                                                                       |
| `--sp-1…--sp-10`, `--content-max` (560px), `--measure` (60ch)                   | spacing and width                                                                     |
| `--ease-pop --ease-out --dur-fast/med/slow --halo-dur`                          | motion                                                                                |

- **Tailwind:** `@theme inline` maps the tokens to utilities: `bg-surface text-ink text-ink-soft bg-go border-line rounded-card rounded-btn font-display bg-physics`… Use these or the component classes. Don't invent hex values.
- **Subject or activity colour on an element:** spread `style={subjectVars(subject)}` or `style={tokenVars('dance')}` (from `@/components/colours`). This sets `--s --sd --on-s --a --ad`, and the CSS in `ui.css` reads those. A built-in subject gets its tokens.css token only while its subjects.json `colour` equals `SUBJECT_TOKEN_HEX`; any other colour (a parent override or a new subject) uses the JSON hex with a computed edge and `onColour()` text. Get the subject with `getSubject(bundle, id)`; never hard-code one.

## Layout and size rules

- Everything is in rem: `calc(N * var(--px))` = N px at Big (18px), and it scales at Bigger (20px).
- Content is at most `--content-max` wide, centred, with a 16px side gutter. **There must be no horizontal scroll at 390px.**
- Tap targets are at least 48px:
  - ChunkyButton is 64px or more
  - OptionButton is 68px or more
  - tabs are 76px or more
  - the ✕ is 56px
  - stones are 84px, and the Now stone 104px
- **One big go action per screen**, at the bottom of the content. Secondary actions use `variant="soft"`. A screen shows about 5 choices at most.
- There are no blurred shadows. Use only the ledge: `box-shadow: 0 6px 0 var(--ledge)`.
- Text placed **on** `--go` or a subject fill is at least `--fs-button` (1.35rem), or is emoji only.
- Hidden navigation is not allowed: no hamburger menus, no swipe-only or long-press actions, and no icon without a word next to it.
- Focus routes (lesson, test, results, revise) use `FocusLayout`, which has no tab bar, and `FocusHeader` (✕ → "Leave the lesson? Your progress is saved.", with **Keep going** as the default).
- A tap on something that isn't ready opens a friendly `BottomSheet`. It never does nothing.
- Every screen is wrapped as `<Screen labelledBy="x-title">` with `<h1 id="x-title" tabIndex={-1}>`.
- CSS for new components goes in `src/components/ui.css` or `src/features/features.css`, inside `@layer components`. Class names must **not** clash with Tailwind utilities (ProgressRing uses `.pring`, not `.ring`).

## Motion and accessibility floor

- framer-motion runs under `MotionConfig reducedMotion="user"` (App.tsx). For custom motion, check `useReducedMotion()` and give a still-frame fallback. A global CSS rule also stops all animations under reduced motion.
- The only idle motion is the Now-stone halo. Confetti is **only** for 100%, new badges and finishing a test. The star pop is only for a correct first try. Sound and vibration are off by default (`settings.sound`, `settings.vibration`).
- Contrast is WCAG AA in all 3 worlds × light/dark. Run `node docs/design/check-tokens.mjs` after any token change, and add `--sync` to update the prototype.
- Keyboard: every control is a real `<button>`, `<a>` or `<input>`. Radios are visually hidden inside labels, and the focus ring sits on the label via `:has(input:focus-visible)`. `html:has(.tabbar)` has a `scroll-padding-bottom` so a focused control never hides behind the fixed tab bar (WCAG 2.2 SC 2.4.11); keep it if the tab bar height changes. `--focus` must be a different hue from `--go`, because selected controls already have a `--go` border.

## Copy

See [copy.md](copy.md) for the voice, the Appendix E phrases and the **banned words**. The kid's name comes from `KID_NAME` (`src/features/copy.ts`), and the mascot's name from `useMascotName()` (`@/state/settingsStore`, i.e. `settings.mascotName`). Never write "Tara" in kid copy; `<Tara>`'s default label already uses the name.

## Visual check (do it for every UI change)

```bash
MSYS_NO_PATHCONV=1 npx tsx scripts/screenshot.ts --routes /,/week --out tmp/shots          # all worlds × light/dark × tablet/phone
MSYS_NO_PATHCONV=1 npx tsx scripts/screenshot.ts --routes /me --worlds space --text bigger --out tmp/shots
#   --now 2026-11-03T17:20 (IST wall time) · --motion (animations on) · --url http://localhost:5173 (reuse a running server)
```

Then **look at** the PNGs with the Read tool, and compare them with `docs/design/*.png`. The script reports any horizontal overflow, and that must be zero. When you're done, delete `tmp/` (it's not git-ignored).

In the browser (dev), you can preview any look with `/?world=ocean&night=night&text=bigger&now=2026-11-02T17:40`. The `/kit` route is a gallery of every component (dev only). Add new components to `src/features/kit/KitScreen.tsx`, with samples taken from the content bundle.

Tests: use `@testing-library/react` with role and name queries, `MemoryRouter`, and `ClockContext.Provider value={fixedClock(...)}`. See `src/features/today/TodayScreen.test.tsx`. The e2e axe checks are in `tests/e2e/smoke.spec.ts`.
