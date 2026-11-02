/**
 * LightRay (SPEC §7.5, Physics): light travels in straight lines — torch beam, corners, materials,
 * shadows and the pinhole camera.
 *
 * Props: scene torch|corner|materials|shadow|pinhole · beam · object (toy|ball) · showBlockedRay ·
 *        material transparent|translucent|opaque · showShadow · showImage
 * Rays draw themselves in (pathLength) when they appear; with `reduced` they are simply there.
 */
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { EASE_OUT, type VisualProps } from './types';
import { useSubjectVars } from './useSubjectVars';
import './visuals.css';

const SCENES = ['torch', 'corner', 'materials', 'shadow', 'pinhole'] as const;
type LightScene = (typeof SCENES)[number];
const MATERIALS = ['transparent', 'translucent', 'opaque'] as const;
type Material = (typeof MATERIALS)[number];

const MATERIAL_CHIP: Record<Material, string> = {
  transparent: '🪟 Transparent',
  translucent: '🧻 Translucent',
  opaque: '🪵 Opaque',
};
/** how much light gets through each material */
const PASS: Record<Material, number> = { transparent: 1, translucent: 0.38, opaque: 0 };

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;

function Ray({
  d,
  on,
  reduced,
  delay = 0,
  className = 'lr-ray',
}: {
  d: string;
  on: boolean;
  reduced: boolean;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.path
      d={d}
      className={className}
      initial={false}
      animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
      transition={reduced ? { duration: 0 } : { duration: 1.1, ease: EASE_OUT, delay: on ? delay : 0 }}
    />
  );
}

function Torch({ on, x = 20, y = 150 }: { on: boolean; x?: number; y?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={-20} width={74} height={40} rx={10} className="lr-torch" />
      <rect x={26} y={-28} width={18} height={10} rx={4} className={on ? 'lr-switch is-on' : 'lr-switch'} />
      <path d="M74 -24 L98 -36 V36 L74 24 Z" className="lr-head" />
      <path d="M98 -32 V32" className={on ? 'lr-glass is-on' : 'lr-glass'} />
    </g>
  );
}

function Txt({
  x,
  y,
  children,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="lr-text">
      {children}
    </text>
  );
}

function TorchScene({ beam, reduced }: { beam: boolean; reduced: boolean }) {
  return (
    <g>
      <motion.g
        initial={false}
        animate={{ opacity: beam ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.8 }}
      >
        <path d="M118 116 L388 110 V190 L118 184 Z" className="lr-beam" />
      </motion.g>
      {[126, 150, 174].map((y, i) => (
        <g key={y}>
          <Ray d={`M120 ${y} H384`} on={beam} reduced={reduced} delay={i * 0.12} />
          <Ray
            d={`M244 ${y - 9} L256 ${y} L244 ${y + 9}`}
            on={beam}
            reduced={reduced}
            delay={0.6 + i * 0.12}
            className="lr-chev"
          />
        </g>
      ))}
      <Torch on={beam} />
      <path d="M140 232 H372" className="lr-ruler" />
      <Txt x={256} y={266}>
        straight!
      </Txt>
    </g>
  );
}

function CornerScene({ blocked, reduced }: { blocked: boolean; reduced: boolean }) {
  // ray from the toy towards the eye hits the wall at (232, 137)
  return (
    <g>
      <rect x={172} y={18} width={60} height={160} rx={6} className="lr-wall" />
      <path d="M172 178 H232" className="lr-floorline" />
      <text x={306} y={118} textAnchor="middle" className="lr-emoji" aria-hidden="true">
        🧸
      </text>
      <text x={74} y={252} textAnchor="middle" className="lr-emoji" aria-hidden="true">
        👀
      </text>
      <path d="M232 137 L84 222" className="lr-ghost" />
      <Ray d="M290 100 L234 136" on={blocked} reduced={reduced} />
      <motion.g
        initial={false}
        animate={{ opacity: blocked ? 1 : 0, scale: blocked ? 1 : 0.4 }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, delay: blocked ? 0.9 : 0, ease: EASE_OUT }}
        style={{ originX: '234px', originY: '136px' }}
      >
        <path
          d="M234 120 L238 132 L250 130 L240 138 L248 148 L236 142 L230 154 L230 141 L218 140 L229 134 Z"
          className="lr-bonk"
        />
      </motion.g>
      <motion.g
        initial={false}
        animate={{ opacity: blocked ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.5, delay: blocked ? 1.2 : 0 }}
      >
        <circle cx={118} cy={196} r={22} className="lr-think" />
        <Txt x={118} y={204}>
          ?
        </Txt>
      </motion.g>
    </g>
  );
}

function Sheet({ material }: { material: Material }) {
  if (material === 'opaque')
    return (
      <g>
        <rect x={194} y={70} width={22} height={160} rx={5} className="lr-wood" />
        <path d="M200 86 V122 M208 140 V188 M201 200 V222" className="lr-grain" />
      </g>
    );
  if (material === 'translucent')
    return (
      <g>
        <rect x={194} y={70} width={22} height={160} rx={5} className="lr-paper" />
        <path
          d="M198 92 L212 84 M198 132 L212 124 M198 172 L212 164 M198 212 L212 204"
          className="lr-grain lr-grain-soft"
        />
      </g>
    );
  return (
    <g>
      <rect x={194} y={70} width={22} height={160} rx={5} className="lr-glass-sheet" />
      <path d="M200 84 V126" className="lr-gleam" />
    </g>
  );
}

function MaterialsScene({ material, reduced }: { material: Material; reduced: boolean }) {
  const pass = PASS[material];
  const tween = reduced ? { duration: 0 } : { duration: 0.9, ease: EASE_OUT };
  return (
    <g>
      <path d="M118 116 L196 114 V186 L118 184 Z" className="lr-beam" />
      {[126, 150, 174].map((y) => (
        <path key={y} d={`M120 ${y} H194`} className="lr-ray" />
      ))}
      <motion.g initial={false} animate={{ opacity: pass }} transition={tween}>
        <path d="M216 114 L352 112 V188 L216 186 Z" className="lr-beam" />
        {[126, 150, 174].map((y) => (
          <path key={y} d={`M218 ${y} H350`} className="lr-ray" />
        ))}
      </motion.g>
      <rect x={352} y={56} width={18} height={188} rx={5} className="lr-screen" />
      <motion.ellipse
        cx={352}
        cy={150}
        rx={10}
        ry={42}
        className="lr-spot"
        initial={false}
        animate={{ opacity: pass }}
        transition={tween}
      />
      <Sheet material={material} />
      <Torch on />
    </g>
  );
}

function ShadowScene({ show, reduced }: { show: boolean; reduced: boolean }) {
  const tween = reduced ? { duration: 0 } : { duration: 1, ease: EASE_OUT };
  return (
    <g>
      <path d="M118 120 L340 34 V266 L118 180 Z" className="lr-beam" />
      <rect x={340} y={28} width={20} height={244} rx={5} className="lr-screen" />
      <Ray d="M118 140 L210 116 L340 82" on={show} reduced={reduced} />
      <Ray d="M118 160 L210 184 L340 218" on={show} reduced={reduced} delay={0.1} />
      <motion.ellipse
        cx={342}
        cy={150}
        rx={9}
        ry={64}
        className="lr-shadow"
        initial={false}
        animate={{ opacity: show ? 1 : 0, scaleY: show ? 1 : 0.3 }}
        transition={tween}
      />
      <motion.path
        d="M210 150 L340 150"
        className="lr-umbra"
        initial={false}
        animate={{ opacity: show ? 1 : 0 }}
        transition={tween}
      />
      <circle cx={210} cy={150} r={34} className="lr-ball" />
      <circle cx={198} cy={138} r={9} className="lr-shine" />
      <Torch on />
      <Txt x={68} y={216}>
        light source
      </Txt>
      <Txt x={210} y={222}>
        object
      </Txt>
      <Txt x={350} y={296}>
        screen
      </Txt>
    </g>
  );
}

const FLAME = 'M0 0 C-11 -10 -8 -22 0 -30 C8 -22 11 -10 0 0 Z';

function PinholeScene({ show, reduced }: { show: boolean; reduced: boolean }) {
  return (
    <g>
      {/* the object: a candle */}
      <rect x={50} y={140} width={24} height={60} rx={4} className="lr-candle" />
      <path d={FLAME} transform="translate(62 142)" className="lr-flame" />
      <Txt x={62} y={234}>
        object
      </Txt>
      {/* the camera (side view) */}
      <rect x={170} y={78} width={172} height={170} rx={8} className="lr-box" />
      <path d="M170 78 V152 M170 168 V248" className="lr-box-front" />
      <rect x={334} y={84} width={10} height={158} rx={3} className="lr-screen" />
      <Txt x={170} y={70}>
        tiny hole
      </Txt>
      {/* rays through the hole */}
      <Ray d="M62 112 L170 160 L334 233" on={show} reduced={reduced} />
      <Ray
        d="M62 200 L170 160 L334 97"
        on={show}
        reduced={reduced}
        delay={0.15}
        className="lr-ray lr-ray-2"
      />
      {/* the image: upside down */}
      <motion.g
        initial={false}
        animate={{ opacity: show ? 1 : 0 }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, delay: show ? 1.1 : 0 }}
      >
        <rect x={318} y={97} width={16} height={95} rx={3} className="lr-candle" />
        <path d={FLAME} transform="translate(326 190) scale(1.4 -1.4)" className="lr-flame" />
      </motion.g>
      <Txt x={256} y={292}>
        upside down!
      </Txt>
    </g>
  );
}

export function LightRay({ props, subjectId, reduced }: VisualProps) {
  const vars = useSubjectVars(subjectId);
  const scene: LightScene = pick(SCENES, props.scene, 'torch');
  const material = pick(MATERIALS, props.material, 'transparent');
  const label: Record<LightScene, string> = {
    torch: props.beam === true ? 'A torch beam going in a straight line' : 'A torch, switched off',
    corner: 'A toy hidden behind a wall; its light cannot bend round the corner',
    materials: `Light shining on a ${material} sheet`,
    shadow: 'A ball in front of a torch, making a shadow on the screen',
    pinhole: 'A pinhole camera making an upside-down image of a candle',
  };
  return (
    <div className="lr" style={vars} role="img" aria-label={label[scene]}>
      <svg viewBox="0 0 400 300" className="lr-svg" aria-hidden="true" focusable="false">
        {scene === 'torch' && <TorchScene beam={props.beam === true} reduced={reduced} />}
        {scene === 'corner' && <CornerScene blocked={props.showBlockedRay === true} reduced={reduced} />}
        {scene === 'materials' && <MaterialsScene material={material} reduced={reduced} />}
        {scene === 'shadow' && <ShadowScene show={props.showShadow === true} reduced={reduced} />}
        {scene === 'pinhole' && <PinholeScene show={props.showImage === true} reduced={reduced} />}
      </svg>
      {scene === 'materials' && (
        <div className="vis-chips" aria-hidden="true">
          <span className="vis-chip">{MATERIAL_CHIP[material]}</span>
        </div>
      )}
    </div>
  );
}
