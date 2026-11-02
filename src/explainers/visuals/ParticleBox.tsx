/**
 * ParticleBox (SPEC §7.5, Chemistry): states of matter as moving particles.
 *
 * Props (all optional; see .claude/skills/explainer-visual/SKILL.md for the table):
 *   state solid|liquid|gas · temperature °C · container none|box|cup|bowl|flask|syringe|balloon|bottle|room
 *   objects [cup, saucer, knife, spoon, stool] · load · heaped · compress 0..1 · pushing
 *   shape round|long|wavy (balloon) · spread 0..1 (scent fills the room) · highlight molecules|force|space
 *   gap 0..1 (two-molecule demo) · zoom · label · glow (plasma) · viscous · compare + row
 *
 * One component instance lives across steps (and across scenes of the same visual), so every change
 * of props is a tween: the same 36 particle slots glide to their new places (melting, pouring,
 * spreading, squeezing). Idle motion shows the state: solids jiggle in place, liquids slide, gases
 * zoom. With `reduced`, nothing loops and changes jump straight to the end frame.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useId, useMemo, useState } from 'react';
import {
  Cold,
  ClipShape,
  Heater,
  Lens,
  ObjectsArt,
  ParticleView,
  StoolScene,
  Thermometer,
  VesselBack,
  VesselFront,
} from './particles/art';
import { idleMotion } from './particles/motion';
import { rectPath } from './particles/shapes';
import { neighbours, type MatterState, type Pt } from './particles/layout';
import {
  PANEL_BOX,
  PANEL_CENTRE,
  PANEL_POOL,
  PANEL_RAMP,
  STATES,
  heat,
  panelLayout,
  parseProps,
  singleLayout,
  type CompareRow,
  type Layout,
  type ParticleProps,
} from './particles/scene';
import { EASE_OUT, svgId, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

const STATE_NAMES: Record<MatterState, { name: string; emoji: string }> = {
  solid: { name: 'Solids', emoji: '🧊' },
  liquid: { name: 'Liquids', emoji: '💧' },
  gas: { name: 'Gases', emoji: '💨' },
};

const ROW_TITLES: Record<CompareRow, string> = {
  'shape-volume': 'Shape and volume',
  position: 'Where the molecules are',
  compression: 'Can we squeeze it?',
  flow: 'Does it flow?',
  'spaces-forces': 'Spaces and forces',
  surfaces: 'Free surfaces',
};

const HIGHLIGHT_WORDS = {
  molecules: 'molecule',
  force: 'intermolecular force',
  space: 'intermolecular space',
} as const;

/** Temperature trend between renders (heating ↑ / cooling ↓), using the "adjust state on change" pattern. */
function useTrend(t: number | undefined): 'up' | 'down' | 'none' {
  const [prev, setPrev] = useState(t);
  const [trend, setTrend] = useState<'up' | 'down' | 'none'>('none');
  if (t !== prev) {
    setPrev(t);
    if (t !== undefined && prev !== undefined) setTrend(t > prev ? 'up' : 'down');
  }
  return trend;
}

function Springs({
  pts,
  count,
  maxDist,
  width,
}: {
  pts: Pt[];
  count: number;
  maxDist: number;
  width: number;
}) {
  const pairs = neighbours(pts.slice(0, count), maxDist);
  return (
    <g aria-hidden="true">
      {pairs.map(([a, b]) => {
        const p = pts[a]!;
        const q = pts[b]!;
        return (
          <path
            key={`${a}-${b}`}
            d={`M${p.x} ${p.y} L${q.x} ${q.y}`}
            className="pb-spring"
            style={{ strokeWidth: width }}
          />
        );
      })}
    </g>
  );
}

function Particles({
  layout,
  p,
  reduced,
  calm,
  signs,
}: {
  layout: Layout;
  p: Pick<ParticleProps, 'viscous' | 'temperature'>;
  reduced: boolean;
  calm?: boolean;
  signs?: boolean;
}) {
  const h = heat(p.temperature);
  return (
    <g>
      {layout.pts.map((at, i) => (
        <ParticleView
          key={i}
          i={i}
          at={at}
          r={layout.r}
          visible={i < layout.count}
          reduced={reduced}
          sign={signs ? (i % 2 ? '−' : '+') : undefined}
          idle={idleMotion(layout.idle, i, h, { viscous: p.viscous, calm, loop: layout.loops?.[i] })}
        />
      ))}
    </g>
  );
}

function LiquidBody({
  layout,
  reduced,
  space,
  clip,
}: {
  layout: Layout;
  reduced: boolean;
  space?: boolean;
  clip?: string;
}) {
  if (layout.level === undefined || !layout.vessel) return null;
  const { x0, x1 } = layout.vessel.bounds;
  const bottom = layout.vessel.floor + 12;
  const tween = reduced ? { duration: 0 } : { duration: 1.6, ease: EASE_OUT };
  return (
    <g clipPath={clip}>
      <motion.rect
        x={x0 - 20}
        width={x1 - x0 + 40}
        initial={false}
        animate={{ y: layout.level, height: Math.max(0, bottom - layout.level) }}
        transition={tween}
        className={space ? 'pb-space' : 'pb-liquid'}
      />
      <motion.path
        initial={false}
        animate={{ d: `M${x0 - 20} ${layout.level} H${x1 + 20}` }}
        transition={tween}
        className="pb-surface"
      />
    </g>
  );
}

function Callout({ text, x, y, from, to }: { text: string; x: number; y: number; from: Pt; to: Pt }) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const head = (da: number) => `${to.x - Math.cos(ang + da) * 12} ${to.y - Math.sin(ang + da) * 12}`;
  return (
    <g>
      <path
        d={`M${from.x} ${from.y} L${to.x} ${to.y} M${head(0.5)} L${to.x} ${to.y} L${head(-0.5)}`}
        className="pb-arrow"
      />
      <text x={x} y={y} textAnchor="middle" className="pb-text">
        {text}
      </text>
    </g>
  );
}

function GapDemo({ layout, reduced }: { layout: Layout; reduced: boolean }) {
  const pair = layout.pair!;
  const { a, b, gap } = pair;
  const r = layout.r;
  const len = 18 + (1 - gap) * 36;
  const w = 3 + (1 - gap) * 10;
  const hw = w * 1.3;
  const arrow = (from: number, dir: 1 | -1, y: number) => {
    const x1 = from + dir * (len - hw);
    const x2 = from + dir * len;
    return `M${from} ${y - w / 2} H${x1} V${y - hw} L${x2} ${y} L${x1} ${y + hw} V${y + w / 2} H${from} Z`;
  };
  const tween = reduced ? { duration: 0 } : { duration: 1.4, ease: EASE_OUT };
  const y = a.y;
  return (
    <g>
      <motion.path
        initial={false}
        animate={{ d: arrow(a.x + r + 4, 1, y) }}
        transition={tween}
        className="pb-force"
      />
      <motion.path
        initial={false}
        animate={{ d: arrow(b.x - r - 4, -1, y) }}
        transition={tween}
        className="pb-force"
      />
      <text x={200} y={112} textAnchor="middle" className="pb-text">
        {gap < 0.4 ? 'strong force 💪' : gap > 0.7 ? 'weak force' : 'force'}
      </text>
      <motion.path
        initial={false}
        animate={{ d: `M${a.x + r} 222 H${b.x - r} M${a.x + r} 212 V232 M${b.x - r} 212 V232` }}
        transition={tween}
        className="pb-measure"
      />
      <text x={200} y={262} textAnchor="middle" className="pb-text">
        space
      </text>
    </g>
  );
}

function Plasma({ uid, reduced }: { uid: string; reduced: boolean }) {
  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id={`${uid}-glow`}>
          <stop offset="0%" style={{ stopColor: 'var(--gold)', stopOpacity: 0.85 }} />
          <stop offset="55%" style={{ stopColor: 'var(--catch)', stopOpacity: 0.35 }} />
          <stop offset="100%" style={{ stopColor: 'var(--catch)', stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      <motion.circle
        cx={200}
        cy={156}
        r={150}
        fill={`url(#${uid}-glow)`}
        initial={false}
        animate={reduced ? { scale: 1 } : { scale: [1, 1.06, 1] }}
        transition={reduced ? { duration: 0 } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />
    </g>
  );
}

/** Viscous: a thick, slow drip from a spoon into the flask. */
function HoneyDrip({ reduced }: { reduced: boolean }) {
  return (
    <g aria-hidden="true">
      <path d="M232 22 L300 6" className="pb-handle" />
      <ellipse cx={222} cy={24} rx={20} ry={9} className="pb-obj-soft" />
      <motion.path
        d="M206 26 C204 38 196 46 196 58 C196 68 210 68 210 58 C210 46 204 38 206 26 Z"
        className="pb-drip"
        style={{ originX: '50%', originY: '0%' }}
        initial={false}
        animate={reduced ? { scaleY: 1 } : { scaleY: [0.55, 1.25, 0.55] }}
        transition={reduced ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </g>
  );
}

/* ---------- single view ---------- */

function SingleView({ p, reduced, uid }: { p: ParticleProps; reduced: boolean; uid: string }) {
  const layout = useMemo(() => singleLayout(p), [p]);
  const trend = useTrend(p.temperature);
  const clipId = `${uid}-clip`;
  const clip = `url(#${clipId})`;
  const contained = layout.mode === 'vessel' && p.state !== 'solid';
  const hl = p.highlight;
  const honey = p.viscous ? ' pb-honey' : '';
  const t = p.temperature;
  const heating = t !== undefined && (trend === 'up' || (trend === 'none' && t >= 40));
  const cooling = t !== undefined && !heating && (trend === 'down' || t <= 0);
  // the ringed molecule: the left-most one in the middle row (close to the label)
  const mid = layout.lens?.cy ?? 150;
  const pivot =
    layout.pts
      .slice(0, layout.count)
      .filter(
        (q) =>
          Math.abs(q.y - mid) <= layout.r * 1.5 &&
          (!layout.lens || q.x >= layout.lens.cx - layout.lens.R * 0.7),
      )
      .sort((a, b) => a.x - b.x)[0] ?? layout.pts[0];

  const vesselKey = layout.mode === 'vessel' || layout.mode === 'free' ? p.container : layout.mode;
  const vesselTween = reduced ? { duration: 0 } : { duration: 0.8, ease: EASE_OUT };

  const matter = (
    <>
      {layout.mode === 'vessel' && (
        <LiquidBody layout={layout} reduced={reduced} space={hl === 'space'} clip={clip} />
      )}
      {hl === 'force' && (
        <Springs pts={layout.pts} count={layout.count} maxDist={layout.r * 2 + 11} width={4} />
      )}
      <g clipPath={contained ? clip : undefined}>
        <Particles
          layout={layout}
          p={p}
          reduced={reduced}
          calm={hl === 'force'}
          signs={layout.mode === 'plasma'}
        />
      </g>
    </>
  );

  return (
    <svg viewBox="0 0 400 300" className={`pb-svg${honey}`} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          <ClipShape container={p.container} shape={p.shape} syringe={layout.syringe} reduced={reduced} />
        </clipPath>
      </defs>

      {layout.mode === 'plasma' && <Plasma uid={uid} reduced={reduced} />}

      <AnimatePresence initial={false}>
        <motion.g
          key={vesselKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={
            reduced
              ? { opacity: 0, transition: { duration: 0 } }
              : { opacity: 0, rotate: -28, y: -24, transition: { duration: 0.9 } }
          }
          transition={vesselTween}
          style={{ originX: '50%', originY: '50%' }}
        >
          {layout.mode === 'vessel' && (
            <VesselBack container={p.container} shape={p.shape} reduced={reduced} />
          )}
          {layout.mode === 'heap' && <ellipse cx={200} cy={254} rx={136} ry={14} className="pb-plate" />}
          {layout.mode === 'block' && <path d="M56 262 H344" className="pb-ground" />}
          {layout.mode === 'objects' && <ObjectsArt objects={p.objects} />}
          {layout.mode === 'stool' && <StoolScene load={p.load} reduced={reduced} />}
          {layout.mode === 'lens' && (
            <g>
              <rect x={30} y={170} width={84} height={80} rx={12} className="pb-chunk" />
              <path d="M114 172 L170 82 M114 248 L170 228" className="pb-connector" />
            </g>
          )}
        </motion.g>
      </AnimatePresence>

      {layout.lens ? (
        <Lens cx={layout.lens.cx} cy={layout.lens.cy} R={layout.lens.R} clipId={`${uid}-lens`}>
          {matter}
        </Lens>
      ) : (
        matter
      )}

      {layout.mode === 'block' && layout.block && (
        <path d={rectPath(layout.block, 8)} className="pb-outline" />
      )}
      {layout.mode === 'vessel' && (
        <VesselFront
          container={p.container}
          shape={p.shape}
          syringe={layout.syringe}
          reduced={reduced}
          pushing={p.pushing || (p.state === 'gas' && p.compress > 0)}
        />
      )}
      {layout.mode === 'gap' && <GapDemo layout={layout} reduced={reduced} />}

      {hl === 'molecules' && pivot && (
        <g>
          <motion.circle
            cx={pivot.x}
            cy={pivot.y}
            r={layout.r + 7}
            className="pb-ring"
            initial={false}
            animate={reduced ? { scale: 1 } : { scale: [1, 1.15, 1] }}
            transition={reduced ? { duration: 0 } : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <Callout
            text={HIGHLIGHT_WORDS.molecules}
            x={layout.lens ? 78 : 200}
            y={layout.lens ? 110 : 40}
            from={layout.lens ? { x: 96, y: 122 } : { x: 200, y: 50 }}
            to={{ x: pivot.x - layout.r - 9, y: pivot.y - layout.r * 0.6 }}
          />
        </g>
      )}
      {(hl === 'force' || hl === 'space') && layout.mode !== 'gap' && (
        <text x={200} y={44} textAnchor="middle" className="pb-text">
          {HIGHLIGHT_WORDS[hl]}
        </text>
      )}

      {p.viscous && p.container === 'flask' && <HoneyDrip reduced={reduced} />}
      {t !== undefined && <Thermometer temperature={t} reduced={reduced} />}
      {heating && <Heater heatLevel={heat(t)} reduced={reduced} />}
      {cooling && <Cold />}
    </svg>
  );
}

/* ---------- compare (three panels) ---------- */

function PanelExtras({ row, state }: { row: CompareRow; state: MatterState }) {
  if (row === 'flow') {
    if (state === 'solid') return <ellipse cx={100} cy={214} rx={84} ry={11} className="pb-plate" />;
    if (state === 'liquid') {
      const { from, to } = PANEL_RAMP;
      return (
        <g>
          <path d={`M${from.x} ${from.y} L${to.x} ${to.y}`} className="pb-ramp" />
          <path d={rectPath(PANEL_POOL, 8)} className="pb-glass" />
        </g>
      );
    }
    const c = PANEL_CENTRE;
    return (
      <g aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
          const x1 = c.x + Math.cos(a) * 44;
          const y1 = c.y + Math.sin(a) * 44;
          const x2 = c.x + Math.cos(a) * 80;
          const y2 = c.y + Math.sin(a) * 80;
          const hx = Math.cos(a + 2.6) * 9;
          const hy = Math.sin(a + 2.6) * 9;
          const kx = Math.cos(a - 2.6) * 9;
          const ky = Math.sin(a - 2.6) * 9;
          return (
            <path
              key={i}
              d={`M${x1} ${y1} L${x2} ${y2} M${x2 + hx} ${y2 + hy} L${x2} ${y2} L${x2 + kx} ${y2 + ky}`}
              className="pb-arrow"
            />
          );
        })}
      </g>
    );
  }
  return null;
}

function Panel({
  row,
  state,
  p,
  reduced,
  uid,
}: {
  row: CompareRow;
  state: MatterState;
  p: ParticleProps;
  reduced: boolean;
  uid: string;
}) {
  const layout = useMemo(() => panelLayout(row, state, p.compress), [row, state, p.compress]);
  const clipId = `${uid}-${state}`;
  const clip = `url(#${clipId})`;
  const noBox = row === 'flow' || (row === 'surfaces' && state === 'solid');
  const boxPath = rectPath(PANEL_BOX, 14);
  const g = layout.syringe;
  const spaces = row === 'spaces-forces';
  const pushing = row === 'compression' && p.compress > 0;

  return (
    <svg viewBox="0 0 200 240" className="pb-svg" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id={clipId}>
          {g ? (
            <rect
              x={g.barrel.x0}
              y={g.barrel.y0}
              width={g.barrel.x1 - g.barrel.x0}
              height={g.barrel.y1 - g.barrel.y0}
            />
          ) : (
            <path d={boxPath} />
          )}
        </clipPath>
      </defs>
      {!noBox && !g && <path d={boxPath} className="pb-glass" />}
      <PanelExtras row={row} state={state} />

      {spaces && state === 'gas' && <path d={boxPath} className="pb-space" />}
      {spaces && state === 'solid' && layout.block && (
        <path d={rectPath(layout.block, 6)} className="pb-space" />
      )}
      {layout.level !== undefined && layout.vessel && (
        <LiquidBody layout={layout} reduced={reduced} space={spaces} clip={clip} />
      )}
      {row === 'flow' && state === 'liquid' && layout.level !== undefined && (
        <g clipPath={`url(#${clipId}-pool)`}>
          <clipPath id={`${clipId}-pool`}>
            <path d={rectPath(PANEL_POOL, 8)} />
          </clipPath>
          <rect
            x={PANEL_POOL.x0}
            y={layout.level}
            width={PANEL_POOL.x1 - PANEL_POOL.x0}
            height={PANEL_POOL.y1 - layout.level}
            className="pb-liquid"
          />
        </g>
      )}
      {spaces && state !== 'gas' && (
        <Springs
          pts={layout.pts}
          count={layout.count}
          maxDist={layout.r * 2 + (state === 'solid' ? 4 : 9)}
          width={state === 'solid' ? 4.5 : 2}
        />
      )}
      {row === 'position' && state === 'solid' && (
        <g aria-hidden="true">
          {layout.pts.slice(0, layout.count).map((q, i) => (
            <circle key={i} cx={q.x} cy={q.y} r={layout.r + 2.5} className="pb-home" />
          ))}
        </g>
      )}
      <g clipPath={state !== 'solid' && row !== 'flow' ? clip : undefined}>
        <Particles layout={layout} p={p} reduced={reduced} calm={spaces} />
      </g>
      {row === 'shape-volume' && state === 'solid' && layout.block && (
        <path d={rectPath(layout.block, 6)} className="pb-outline" />
      )}
      {row === 'surfaces' && state === 'solid' && layout.block && (
        <g>
          <path d="M20 224 H180" className="pb-ground" />
          <path d={rectPath(layout.block, 4)} className="pb-free" />
        </g>
      )}
      {row === 'surfaces' && state === 'liquid' && layout.level !== undefined && (
        <path d={`M${PANEL_BOX.x0 + 4} ${layout.level} H${PANEL_BOX.x1 - 4}`} className="pb-free" />
      )}
      {!noBox && !g && <path d={boxPath} className="pb-edge" />}
      {g && <VesselFront container="syringe" shape="round" syringe={g} reduced={reduced} pushing={pushing} />}
    </svg>
  );
}

function CompareView({ p, reduced, uid }: { p: ParticleProps; reduced: boolean; uid: string }) {
  return (
    <div className="pb-compare">
      <p className="pb-row-title">{ROW_TITLES[p.row]}</p>
      <div className="pb-panels">
        {STATES.map((s) => (
          <figure key={s} className="pb-panel">
            <Panel row={p.row} state={s} p={p} reduced={reduced} uid={uid} />
            <figcaption>
              <span aria-hidden="true">{STATE_NAMES[s].emoji}</span> {STATE_NAMES[s].name}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/* ---------- the visual ---------- */

/** Short description for screen readers (the captions carry the narration). */
function describeParticles(p: ParticleProps): string {
  if (p.compare) return `Solids, liquids and gases side by side: ${ROW_TITLES[p.row].toLowerCase()}`;
  if (p.gap !== undefined) return 'Two molecules, with the force between them';
  if (p.glow) return 'Glowing plasma particles';
  const where = p.container === 'none' ? '' : ` in a ${p.container}`;
  return `Particles of a ${p.state}${where}`;
}

export function ParticleBox({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- parse once per distinct prop set
  const p = useMemo(() => parseProps(props), [key]);
  const uid = svgId(useId());
  const t = p.temperature;
  return (
    <div className="pb" style={vars} role="img" aria-label={describeParticles(p)}>
      {p.compare ? (
        <CompareView p={p} reduced={reduced} uid={uid} />
      ) : (
        <SingleView p={p} reduced={reduced} uid={uid} />
      )}
      {(p.label || t !== undefined) && (
        <div className="vis-chips" aria-hidden="true">
          {p.label ? <span className="vis-chip">{p.label}</span> : <span />}
          {t !== undefined && <span className="vis-chip">🌡️ {t} °C</span>}
        </div>
      )}
    </div>
  );
}
