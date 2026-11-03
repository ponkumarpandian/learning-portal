import { cleanup, render, screen } from '@testing-library/react';
import { loadContent } from '@/content';
import { activeProps } from '../timeline';
import { VISUALS } from './index';
import { layoutFractionBar, parseFractionBar } from './fractionBarLayout';
import { liquidFill } from './particles/layout';
import { SINGLE_VESSELS, parseProps, singleLayout } from './particles/scene';

const bundle = loadContent();

/** every frame the real content can show: each scene at 0 s and at each step's `at` */
const frames = bundle.explainers.flatMap((ex) =>
  ex.scenes.flatMap((sc, i) =>
    [0, ...(sc.steps ?? []).map((s) => s.at), Infinity].map((t) => ({
      name: `${ex.id} scene ${i} @${t}`,
      visual: sc.visual,
      subject: ex.subject,
      props: activeProps(sc, t),
    })),
  ),
);

describe('visual registry', () => {
  it('has a component for every visual the content uses', () => {
    const used = new Set(bundle.explainers.flatMap((e) => e.scenes.map((s) => s.visual)));
    for (const v of used) expect(VISUALS[v], v).toBeDefined();
  });

  it.each(frames.map((f) => [f.name, f] as const))('%s renders (motion and reduced)', (_, f) => {
    const V = VISUALS[f.visual]!;
    for (const reduced of [false, true]) {
      const { container, unmount } = render(<V props={f.props} subjectId={f.subject} reduced={reduced} />);
      expect(container.querySelector('svg')).not.toBeNull();
      expect(screen.getByRole('img')).toHaveAccessibleName();
      unmount();
    }
    cleanup();
  });

  it('survives junk props', () => {
    for (const V of Object.values(VISUALS)) {
      render(
        <V
          props={{ state: 42, container: 'spaceship', objects: 'cup', compress: 'lots', jumps: ['x'] }}
          reduced
        />,
      );
      cleanup();
    }
  });
});

describe('ParticleBox', () => {
  const PB = VISUALS.ParticleBox!;

  it('shows the label chip and the temperature', () => {
    render(<PB props={{ state: 'solid', container: 'box', label: 'Fig. 3.12', temperature: 40 }} reduced />);
    expect(screen.getByText('Fig. 3.12')).toBeInTheDocument();
    expect(screen.getByText(/40 °C/)).toBeInTheDocument();
  });

  it('compare mode shows three labelled panels and the row title', () => {
    render(<PB props={{ compare: true, row: 'compression', compress: 0.4 }} reduced />);
    expect(screen.getByText('Can we squeeze it?')).toBeInTheDocument();
    for (const name of ['Solids', 'Liquids', 'Gases']) expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAccessibleName(/side by side/);
  });

  it('highlight labels use the book terms', () => {
    render(<PB props={{ state: 'liquid', container: 'box', highlight: 'force' }} reduced />);
    expect(screen.getByText('intermolecular force')).toBeInTheDocument();
    cleanup();
    render(<PB props={{ state: 'solid', container: 'box', zoom: true, highlight: 'molecules' }} reduced />);
    expect(screen.getByText('molecule')).toBeInTheDocument();
  });

  it('a poured liquid keeps its particle count (volume) with one flat top in every vessel', () => {
    const counts = (['cup', 'bowl', 'flask'] as const).map((c) => {
      const l = singleLayout(parseProps({ state: 'liquid', container: c }));
      expect(l.level).toBeDefined();
      return l.count;
    });
    expect(new Set(counts).size).toBe(1);
    // the same volume stands at a different height in each shape, always below the rim
    const levels = (['cup', 'bowl', 'flask'] as const).map(
      (c) => liquidFill(SINGLE_VESSELS[c](), 20, 9).level,
    );
    expect(new Set(levels.map(Math.round)).size).toBe(3);
    (['cup', 'bowl', 'flask'] as const).forEach((c, i) =>
      expect(levels[i]!).toBeGreaterThan(SINGLE_VESSELS[c]().bounds.y0),
    );
  });

  it('a gas squeezes when the plunger goes in; a liquid does not, even when pushing', () => {
    const gas0 = singleLayout(parseProps({ state: 'gas', container: 'syringe', compress: 0 }));
    const gas4 = singleLayout(parseProps({ state: 'gas', container: 'syringe', compress: 0.4 }));
    expect(gas4.syringe!.head).toBeGreaterThan(gas0.syringe!.head);
    const liq0 = singleLayout(parseProps({ state: 'liquid', container: 'syringe', compress: 0 }));
    const liqPush = singleLayout(
      parseProps({ state: 'liquid', container: 'syringe', compress: 0.4, pushing: true }),
    );
    expect(liqPush.syringe!.head).toBe(liq0.syringe!.head);
  });

  it('solids pack tight, gases spread out', () => {
    const avgNearest = (state: string) => {
      const l = singleLayout(parseProps({ state, container: 'box' }));
      const pts = l.pts.slice(0, l.count);
      const near = pts.map((p) =>
        Math.min(...pts.filter((q) => q !== p).map((q) => Math.hypot(p.x - q.x, p.y - q.y))),
      );
      return near.reduce((a, b) => a + b, 0) / near.length;
    };
    expect(avgNearest('gas')).toBeGreaterThan(avgNearest('liquid') * 1.8);
    expect(avgNearest('liquid')).toBeGreaterThan(avgNearest('solid') * 0.85);
  });

  it('the scent spreads from the bottle to the whole room', () => {
    const bottle = singleLayout(parseProps({ state: 'gas', container: 'room', spread: 0 }));
    const room = singleLayout(parseProps({ state: 'gas', container: 'room', spread: 1 }));
    const spanX = (l: typeof room) => {
      const xs = l.pts.slice(0, l.count).map((p) => p.x);
      return Math.max(...xs) - Math.min(...xs);
    };
    expect(spanX(room)).toBeGreaterThan(spanX(bottle) * 3);
  });
});

describe('LightRay and NumberLine', () => {
  const LR = VISUALS.LightRay!;
  const NL = VISUALS.NumberLine!;
  it('names the material', () => {
    render(<LR props={{ scene: 'materials', material: 'translucent' }} reduced />);
    expect(screen.getByText(/Translucent/)).toBeInTheDocument();
  });

  it('draws jumps and lands on the sum', () => {
    render(<NL props={{ min: -5, max: 5, start: -2, jumps: [5, -4] }} reduced />);
    expect(screen.getByRole('img')).toHaveAccessibleName(/starting at -2 and landing on -1/);
    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getAllByText('−4').length).toBeGreaterThan(1); // tick label + jump label
  });
});

describe('FractionBar', () => {
  const FB = VISUALS.FractionBar!;

  it('cuts a bar into equal parts and shades the numerator', () => {
    const l = layoutFractionBar(parseFractionBar({ bars: [{ parts: 3, shaded: 2, label: '2/3' }] }));
    expect(l.rows[0]!.cells).toHaveLength(3);
    expect(l.rows[0]!.cells.filter((c) => c.on)).toHaveLength(2);
    const widths = l.rows[0]!.cells.map((c) => c.w);
    expect(Math.max(...widths) - Math.min(...widths)).toBeLessThan(1e-9);
  });

  it('an improper fraction draws extra wholes (9/8 = one full bar and 1/8)', () => {
    const r = layoutFractionBar(parseFractionBar({ bars: [{ parts: 8, shaded: 9 }] })).rows[0]!;
    expect(r.wholes).toHaveLength(2);
    expect(r.cells).toHaveLength(16);
    expect(r.cells.filter((c) => c.on)).toHaveLength(9);
  });

  it('puts the sign between every pair of rows', () => {
    const l = layoutFractionBar(
      parseFractionBar({
        bars: [
          { parts: 8, shaded: 3 },
          { parts: 8, shaded: 1 },
          { parts: 8, shaded: 5 },
        ],
        sign: '+',
      }),
    );
    expect(l.signs.map((s) => s.text)).toEqual(['+', '+']);
    expect(l.signs[0]!.y).toBeGreaterThan(l.rows[0]!.y + l.rowHeight);
    expect(l.signs[0]!.y).toBeLessThan(l.rows[1]!.y + 10);
  });

  it('drops junk and clamps numbers', () => {
    const s = parseFractionBar({ bars: [{ parts: 'x' }, null, { parts: 500, shaded: -3 }], sign: '?' });
    expect(s.bars).toEqual([{ parts: 60, shaded: 0, label: undefined }]);
    expect(s.sign).toBeUndefined();
    expect(parseFractionBar({ sign: '-' }).sign).toBe('−');
  });

  it('reads the sum aloud and shows the labels, sign and result', () => {
    render(
      <FB
        props={{
          bars: [
            { parts: 9, shaded: 4, label: '4/9' },
            { parts: 9, shaded: 2, label: '2/9' },
          ],
          sign: '+',
          result: '6/9 = 2/3',
        }}
        reduced
      />,
    );
    expect(screen.getByRole('img')).toHaveAccessibleName('Fraction bars: 4/9 + 2/9 = 6/9 = 2/3');
    expect(screen.getByText('4/9')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
    expect(screen.getByText('6/9 = 2/3')).toBeInTheDocument();
  });
});
