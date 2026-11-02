/**
 * ParticleBox drawing parts: particles, vessels, everyday objects, lens, thermometer, heater.
 * Colours: subject vars (--s / --sd / --on-s) and theme tokens only (see visuals.css).
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE_OUT } from '../types';
import type { IdleMotion } from './motion';
import { PATHS, bottleTransform } from './shapes';
import {
  BALLOON_CENTER,
  BOTTLE_BIG,
  BOTTLE_IN_ROOM,
  ROOM,
  balloonPath,
  balloonRadius,
  type BalloonShape,
  type Pt,
  type SyringeGeom,
} from './layout';
import type { ContainerKind, ObjectKind } from './scene';

/* ---------- particles ---------- */

export interface ParticleViewProps {
  i: number;
  at: Pt;
  r: number;
  visible: boolean;
  idle: IdleMotion | null;
  reduced: boolean;
  /** plasma: charged particle */
  sign?: '+' | '−';
  /** extra stagger for big re-arrangements (melting, pouring) */
  stagger?: boolean;
}

export function ParticleView({ i, at, r, visible, idle, reduced, sign, stagger = true }: ParticleViewProps) {
  const move = reduced
    ? { duration: 0 }
    : { duration: 1.5, ease: EASE_OUT, delay: stagger ? (i % 12) * 0.035 : 0 };
  const cls = sign === '+' ? 'pb-p pb-plus' : sign === '−' ? 'pb-p pb-minus' : 'pb-p';
  return (
    <motion.g
      initial={false}
      animate={{ x: at.x, y: at.y, opacity: visible ? 1 : 0, scale: visible ? 1 : 0.2 }}
      transition={move}
    >
      <motion.g
        initial={false}
        animate={!reduced && visible && idle ? idle.animate : { x: 0, y: 0, opacity: 1 }}
        transition={!reduced && visible && idle ? idle.transition : { duration: reduced ? 0 : 0.5 }}
      >
        <circle r={r} className={cls} />
        {!sign && <circle cx={-r * 0.32} cy={-r * 0.36} r={r * 0.32} className="pb-shine" />}
        {sign && (
          <text className="pb-sign" y={6.5} textAnchor="middle" aria-hidden="true">
            {sign}
          </text>
        )}
      </motion.g>
    </motion.g>
  );
}

/* ---------- vessels ---------- */

/** The clip shape for matter inside a vessel (same outline the glass is drawn with). */
export function ClipShape({
  container,
  shape,
  syringe,
  reduced,
}: {
  container: ContainerKind;
  shape: BalloonShape;
  syringe?: SyringeGeom;
  reduced: boolean;
}) {
  switch (container) {
    case 'box':
      return <path d={PATHS.box} />;
    case 'cup':
      return <path d={PATHS.cup} />;
    case 'bowl':
      return <path d={PATHS.bowl} />;
    case 'flask':
      return <path d={PATHS.flask} />;
    case 'bottle':
      return <path d={PATHS.bottle} transform={bottleTransform(BOTTLE_BIG)} />;
    case 'room':
      return <path d={PATHS.room} />;
    case 'balloon':
      return (
        <motion.path
          initial={false}
          animate={{ d: balloonPath(shape) }}
          transition={reduced ? { duration: 0 } : { duration: 1.2, ease: EASE_OUT }}
        />
      );
    case 'syringe':
      return syringe ? (
        <rect
          x={syringe.barrel.x0}
          y={syringe.barrel.y0}
          width={syringe.barrel.x1 - syringe.barrel.x0}
          height={syringe.barrel.y1 - syringe.barrel.y0}
        />
      ) : null;
    default:
      return <rect x={0} y={0} width={400} height={300} />;
  }
}

/** Glass + decorations behind the matter. */
export function VesselBack({
  container,
  shape,
  reduced,
}: {
  container: ContainerKind;
  shape: BalloonShape;
  reduced: boolean;
}) {
  switch (container) {
    case 'box':
      return <path d={PATHS.box} className="pb-glass" />;
    case 'cup':
      return <path d={PATHS.cup} className="pb-glass" />;
    case 'bowl':
      return <path d={PATHS.bowl} className="pb-glass" />;
    case 'flask':
      return <path d={PATHS.flask} className="pb-glass" />;
    case 'bottle':
      return <path d={PATHS.bottle} transform={bottleTransform(BOTTLE_BIG)} className="pb-glass" />;
    case 'balloon':
      return (
        <motion.path
          className="pb-balloon"
          initial={false}
          animate={{ d: balloonPath(shape) }}
          transition={reduced ? { duration: 0 } : { duration: 1.2, ease: EASE_OUT }}
        />
      );
    case 'room':
      return <RoomBack />;
    default:
      return null;
  }
}

/** Outlines + rims in front of the matter. */
export function VesselFront({
  container,
  shape,
  syringe,
  reduced,
  pushing,
}: {
  container: ContainerKind;
  shape: BalloonShape;
  syringe?: SyringeGeom;
  reduced: boolean;
  pushing: boolean;
}) {
  switch (container) {
    case 'box':
      return (
        <g>
          <path d={PATHS.box} className="pb-edge" />
          <path d="M124 74 V140" className="pb-gleam" />
        </g>
      );
    case 'cup':
      return (
        <g>
          <path d="M270 132 C320 132 320 214 258 214" className="pb-handle" />
          <path d={PATHS.cupStroke} className="pb-edge" />
          <path d="M118 104 H282" className="pb-rim" />
          <path d="M146 122 L156 196" className="pb-gleam" />
        </g>
      );
    case 'bowl':
      return (
        <g>
          <path d={PATHS.bowlStroke} className="pb-edge" />
          <path d="M48 126 H352" className="pb-rim" />
          <path d="M168 256 H232" className="pb-rim" />
          <path d="M84 150 Q96 196 132 222" className="pb-gleam" />
        </g>
      );
    case 'flask':
      return (
        <g>
          <path d={PATHS.flaskStroke} className="pb-edge" />
          <path d="M170 44 H230" className="pb-rim" />
          <path d="M188 60 V112" className="pb-gleam" />
        </g>
      );
    case 'bottle':
      return <BottleFront at={BOTTLE_BIG} />;
    case 'balloon': {
      const bottom = balloonRadius(shape, Math.PI / 2) + BALLOON_CENTER.y;
      return (
        <motion.g
          initial={false}
          animate={{ y: bottom - 252 }}
          transition={reduced ? { duration: 0 } : { duration: 1.2, ease: EASE_OUT }}
        >
          <path d="M192 260 L200 250 L208 260 Z" className="pb-knot" />
          <path d="M200 260 C190 272 212 282 200 300" className="pb-string" />
          <path d="M150 90 Q164 70 186 66" className="pb-gleam" />
        </motion.g>
      );
    }
    case 'syringe':
      return syringe ? <SyringeFront g={syringe} reduced={reduced} pushing={pushing} /> : null;
    case 'room':
      return <RoomFront />;
    default:
      return null;
  }
}

function BottleFront({ at }: { at: { x: number; y: number; s: number } }) {
  return (
    <g transform={bottleTransform(at)}>
      <path d={PATHS.bottle} className="pb-edge" />
      <rect x={-24} y={-100} width={48} height={26} rx={7} className="pb-cap" />
      <path d="M-44 -20 V40" className="pb-gleam" />
    </g>
  );
}

function RoomBack() {
  return (
    <g>
      <rect
        x={ROOM.x0}
        y={ROOM.y0}
        width={ROOM.x1 - ROOM.x0}
        height={ROOM.y1 - ROOM.y0}
        rx={12}
        className="pb-wall"
      />
      <rect x={ROOM.x0} y={244} width={ROOM.x1 - ROOM.x0} height={ROOM.y1 - 244} className="pb-floor" />
      <rect x={258} y={52} width={92} height={76} rx={6} className="pb-window" />
      <path d="M304 52 V128 M258 90 H350" className="pb-frame" />
      <rect x={40} y={236} width={88} height={9} rx={4} className="pb-table" />
      <path d="M52 245 V262 M116 245 V262" className="pb-table-leg" />
    </g>
  );
}

function RoomFront() {
  return (
    <g>
      <BottleFront at={BOTTLE_IN_ROOM} />
      <text x={336} y={250} className="pb-emoji" textAnchor="middle" aria-hidden="true">
        🧒
      </text>
      <rect
        x={ROOM.x0}
        y={ROOM.y0}
        width={ROOM.x1 - ROOM.x0}
        height={ROOM.y1 - ROOM.y0}
        rx={12}
        className="pb-edge"
      />
    </g>
  );
}

function SyringeFront({ g, reduced, pushing }: { g: SyringeGeom; reduced: boolean; pushing: boolean }) {
  const { barrel, head, nozzle } = g;
  const cx = (barrel.x0 + barrel.x1) / 2;
  const w = barrel.x1 - barrel.x0;
  const rod = Math.max(30, barrel.y1 - barrel.y0) * 0.2;
  const tween = reduced ? { duration: 0 } : { duration: 1.3, ease: EASE_OUT };
  const ticks = Array.from({ length: 6 }, (_, i) => barrel.y0 + 22 + (i * (barrel.y1 - barrel.y0 - 30)) / 5);
  return (
    <g>
      <rect
        x={nozzle.x0}
        y={nozzle.y0}
        width={nozzle.x1 - nozzle.x0}
        height={nozzle.y1 - nozzle.y0}
        rx={3}
        className="pb-edge pb-nozzle"
      />
      <circle cx={cx} cy={nozzle.y1 + 3} r={8} className="pb-seal" />
      <rect x={barrel.x0} y={barrel.y0} width={w} height={barrel.y1 - barrel.y0} rx={6} className="pb-edge" />
      {ticks.map((y) => (
        <path key={y} d={`M${barrel.x0} ${y} h${w * 0.22}`} className="pb-tick" />
      ))}
      <rect
        x={barrel.x0 - w * 0.3}
        y={barrel.y0 - 6}
        width={w * 1.6}
        height={8}
        rx={4}
        className="pb-flange"
      />
      <motion.g initial={false} animate={{ y: head }} transition={tween}>
        <rect x={cx - 6} y={-rod - 6} width={12} height={rod + 2} className="pb-rod" />
        <rect x={cx - w * 0.38} y={-rod - 14} width={w * 0.76} height={9} rx={4} className="pb-rod" />
        <rect x={barrel.x0 + 3} y={-10} width={w - 6} height={10} rx={3} className="pb-head" />
        {pushing && (
          <motion.g
            initial={false}
            animate={reduced ? { y: 0 } : { y: [0, 5, 0] }}
            transition={reduced ? { duration: 0 } : { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <path
              d={`M${cx} ${-rod - 52} V${-rod - 22} M${cx - 11} ${-rod - 32} L${cx} ${-rod - 20} L${cx + 11} ${-rod - 32}`}
              className="pb-push"
            />
          </motion.g>
        )}
      </motion.g>
    </g>
  );
}

/* ---------- everyday objects (solids keep their shape) ---------- */

function ObjectArt({ kind }: { kind: ObjectKind }) {
  switch (kind) {
    case 'cup':
      return (
        <g>
          <path d="M26 -12 C50 -12 50 20 22 18" className="pb-handle pb-handle-s" />
          <path d="M-32 -28 L-26 26 Q-25 32 -18 32 L18 32 Q25 32 26 26 L32 -28 Z" className="pb-obj" />
          <path d="M-34 -28 H34" className="pb-rim" />
        </g>
      );
    case 'saucer':
      return (
        <g>
          <ellipse cx={0} cy={14} rx={46} ry={13} className="pb-obj-soft" />
          <ellipse cx={0} cy={11} rx={24} ry={6} className="pb-obj-inner" />
        </g>
      );
    case 'knife':
      return (
        <g transform="rotate(-18)">
          <path d="M12 -8 L-38 -8 Q-50 -6 -46 6 L12 8 Z" className="pb-obj-soft" />
          <rect x={10} y={-8} width={38} height={16} rx={7} className="pb-wood" />
        </g>
      );
    case 'spoon':
      return (
        <g transform="rotate(16)">
          <ellipse cx={-28} cy={0} rx={18} ry={12} className="pb-obj-soft" />
          <rect x={-12} y={-4} width={58} height={8} rx={4} className="pb-obj-soft" />
        </g>
      );
    case 'stool':
      return <StoolArt />;
  }
}

function StoolArt() {
  return (
    <g>
      <path d="M-58 0 L-70 78 M58 0 L70 78 M0 0 V74" className="pb-leg" />
      <path d="M-46 44 H46" className="pb-leg pb-leg-s" />
      <rect x={-80} y={-18} width={160} height={20} rx={10} className="pb-wood" />
    </g>
  );
}

const OBJECT_SLOTS: Pt[] = [
  { x: 188, y: 116 },
  { x: 72, y: 116 },
  { x: 72, y: 222 },
  { x: 188, y: 222 },
];

export function ObjectsArt({ objects }: { objects: ObjectKind[] }) {
  return (
    <g>
      {objects.slice(0, 4).map((o, i) => {
        const at = OBJECT_SLOTS[i]!;
        return (
          <g key={o} transform={`translate(${at.x} ${at.y})`}>
            <ObjectArt kind={o} />
          </g>
        );
      })}
      <path d="M222 104 L256 124 M222 132 L254 168" className="pb-connector" />
    </g>
  );
}

export function StoolScene({ load, reduced }: { load: boolean; reduced: boolean }) {
  return (
    <g>
      <StoolVolume />
      <g transform="translate(150 186)">
        <StoolArt />
      </g>
      <motion.g
        initial={false}
        animate={{ y: load ? 0 : -50, opacity: load ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT }}
      >
        <g aria-hidden="true">
          <path d="M120 166 Q118 122 150 120 Q182 122 180 166 Z" className="pb-friend" />
          <path d="M136 166 L130 224 M164 166 L170 224" className="pb-friend-legs" />
          <text x={150} y={124} className="pb-emoji pb-emoji-head" textAnchor="middle">
            🧒
          </text>
        </g>
      </motion.g>
      <path d="M232 180 L256 168" className="pb-connector" />
    </g>
  );
}

/** The stool keeps its own volume: a fixed dashed frame round the stool itself. */
export function StoolVolume() {
  return <rect x={66} y={160} width={168} height={108} rx={12} className="pb-volume-line" />;
}

export function Lens({
  cx,
  cy,
  R,
  children,
  clipId,
  handle = true,
}: {
  cx: number;
  cy: number;
  R: number;
  children: ReactNode;
  clipId: string;
  handle?: boolean;
}) {
  const hx = cx + R * 0.72;
  const hy = cy + R * 0.72;
  return (
    <g>
      {handle && <path d={`M${hx} ${hy} L${hx + R * 0.38} ${hy + R * 0.4}`} className="pb-lens-handle" />}
      <circle cx={cx} cy={cy} r={R} className="pb-lens-bg" />
      <clipPath id={clipId}>
        <circle cx={cx} cy={cy} r={R - 3} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{children}</g>
      <circle cx={cx} cy={cy} r={R} className="pb-lens" />
      <path
        d={`M${cx - R * 0.62} ${cy - R * 0.3} Q${cx - R * 0.55} ${cy - R * 0.62} ${cx - R * 0.25} ${cy - R * 0.68}`}
        className="pb-gleam"
      />
    </g>
  );
}

/* ---------- heat ---------- */

export function Thermometer({ temperature, reduced }: { temperature: number; reduced: boolean }) {
  const frac = Math.max(0, Math.min(1, (temperature + 10) / 120));
  const top = 232 - frac * 150;
  return (
    <g aria-hidden="true">
      <rect x={342} y={70} width={20} height={172} rx={10} className="pb-thermo" />
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <path key={t} d={`M362 ${232 - t * 150} h8`} className="pb-tick" />
      ))}
      <motion.rect
        x={347}
        width={10}
        rx={5}
        initial={false}
        animate={{ y: top, height: 246 - top }}
        transition={reduced ? { duration: 0 } : { duration: 2.2, ease: EASE_OUT }}
        className="pb-mercury"
      />
      <circle cx={352} cy={252} r={16} className="pb-bulb" />
    </g>
  );
}

export function Heater({ heatLevel, reduced }: { heatLevel: number; reduced: boolean }) {
  const s = 0.6 + heatLevel * 0.7;
  return (
    <g aria-hidden="true" transform={`translate(200 298) scale(${s})`}>
      {[-34, 0, 34].map((x, i) => (
        <motion.g
          key={x}
          style={{ originX: '50%', originY: '100%' }}
          initial={false}
          animate={reduced ? { scaleY: 1 } : { scaleY: [1, 1.18, 0.92, 1] }}
          transition={
            reduced ? { duration: 0 } : { duration: 0.9 + i * 0.15, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <path
            d={`M${x} 0 C${x - 16} -12 ${x - 10} -30 ${x} -44 C${x + 10} -30 ${x + 16} -12 ${x} 0 Z`}
            className="pb-flame"
          />
          <path
            d={`M${x} 0 C${x - 7} -6 ${x - 5} -16 ${x} -24 C${x + 5} -16 ${x + 7} -6 ${x} 0 Z`}
            className="pb-flame-in"
          />
        </motion.g>
      ))}
    </g>
  );
}

export function Cold() {
  return (
    <g aria-hidden="true">
      <text x={62} y={118} className="pb-emoji" textAnchor="middle">
        ❄️
      </text>
      <text x={62} y={222} className="pb-emoji" textAnchor="middle">
        ❄️
      </text>
    </g>
  );
}
