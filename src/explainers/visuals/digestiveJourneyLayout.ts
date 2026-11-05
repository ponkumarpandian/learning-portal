/**
 * DigestiveJourney layout (pure, no React) — SPEC §7.5 Biology.
 *
 * A schematic of the alimentary canal (mouth → anus, top to bottom) with the digestive glands beside it.
 * Props: highlight (an organ id, a list of ids, or "all") · food (organ id where the food dot sits) ·
 *        foodLabel (chip, e.g. "bolus") · label (chip, e.g. "Fig. 4.1")
 * Organ ids: mouth oesophagus stomach small-intestine large-intestine anus salivary-glands liver pancreas
 */

export const CANAL = [
  { id: 'mouth', name: 'Mouth' },
  { id: 'oesophagus', name: 'Oesophagus' },
  { id: 'stomach', name: 'Stomach' },
  { id: 'small-intestine', name: 'Small intestine' },
  { id: 'large-intestine', name: 'Large intestine' },
  { id: 'anus', name: 'Anus' },
] as const;

/** Glands, each drawn beside the canal organ it sits next to in Fig. 4.1 / Fig. 4.5. */
export const GLANDS = [
  { id: 'salivary-glands', name: 'Salivary glands', beside: 'mouth' },
  { id: 'liver', name: 'Liver', beside: 'stomach' },
  { id: 'pancreas', name: 'Pancreas', beside: 'small-intestine' },
] as const;

export type OrganId = (typeof CANAL)[number]['id'] | (typeof GLANDS)[number]['id'];
const ALL_IDS: readonly OrganId[] = [...CANAL.map((o) => o.id), ...GLANDS.map((g) => g.id)];
const isOrgan = (v: unknown): v is OrganId =>
  typeof v === 'string' && (ALL_IDS as readonly string[]).includes(v);

export interface JourneyScene {
  highlight: OrganId[];
  food?: (typeof CANAL)[number]['id'];
  foodLabel?: string;
  label?: string;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

export function parseJourney(props: Record<string, unknown>): JourneyScene {
  const h = props.highlight;
  const highlight = h === 'all' ? [...ALL_IDS] : Array.isArray(h) ? h.filter(isOrgan) : isOrgan(h) ? [h] : [];
  const food = CANAL.find((o) => o.id === props.food)?.id;
  return {
    highlight: [...new Set(highlight)],
    food,
    foodLabel: text(props.foodLabel),
    label: text(props.label),
  };
}

export interface Box {
  id: OrganId;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  on: boolean;
}

export interface JourneyLayout {
  width: number;
  height: number;
  canal: Box[];
  glands: (Box & { joinY: number })[];
  arrows: { x: number; y1: number; y2: number }[];
  food?: { x: number; y: number };
}

export const VIEW_W = 400;
const CANAL_X = 16;
const CANAL_W = 218;
const GLAND_X = 262;
const GLAND_W = 128;
const BOX_H = 50;
const GAP = 24;

export function layoutJourney(scene: JourneyScene): JourneyLayout {
  const top = scene.label || scene.foodLabel ? 76 : 14;
  const on = new Set(scene.highlight);
  const canal: Box[] = CANAL.map((o, i) => ({
    id: o.id,
    name: o.name,
    x: CANAL_X,
    y: top + i * (BOX_H + GAP),
    w: CANAL_W,
    h: BOX_H,
    on: on.has(o.id),
  }));
  const rowOf = (id: string) => canal.find((b) => b.id === id)!;
  const glands = GLANDS.map((g) => {
    const row = rowOf(g.beside);
    return {
      id: g.id,
      name: g.name,
      x: GLAND_X,
      y: row.y,
      w: GLAND_W,
      h: BOX_H,
      on: on.has(g.id),
      joinY: row.y + BOX_H / 2,
    };
  });
  const arrows = canal.slice(1).map((b) => ({ x: CANAL_X + CANAL_W / 2, y1: b.y - GAP + 4, y2: b.y - 4 }));
  const fb = scene.food ? rowOf(scene.food) : undefined;
  const last = canal.at(-1)!;
  return {
    width: VIEW_W,
    height: last.y + BOX_H + 14,
    canal,
    glands,
    arrows,
    food: fb ? { x: fb.x + fb.w - 24, y: fb.y + BOX_H / 2 } : undefined,
  };
}

/** What a screen reader hears. */
export function describeJourney(scene: JourneyScene): string {
  const names = new Map<string, string>([...CANAL, ...GLANDS].map((o) => [o.id, o.name.toLowerCase()]));
  const parts = [
    'Digestive system: mouth, oesophagus, stomach, small intestine, large intestine and anus, with the salivary glands, liver and pancreas',
  ];
  if (scene.highlight.length) parts.push(`Showing: ${scene.highlight.map((id) => names.get(id)).join(', ')}`);
  if (scene.food)
    parts.push(
      `The food is in the ${names.get(scene.food)}${scene.foodLabel ? ` (${scene.foodLabel})` : ''}`,
    );
  if (scene.label) parts.push(scene.label);
  return parts.join('. ') + '.';
}
