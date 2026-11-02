import {
  DndContext,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useState, type CSSProperties, type ReactNode } from 'react';

/** One place a chip can go: a left-hand match item, or a numbered diagram hotspot. */
export interface BoardTarget {
  id: string;
  /** what the row shows on the left (text, or a numbered badge) */
  head: ReactNode;
  /** plain words for screen readers ("Shape", "Spot 1") */
  name: string;
}

export interface BoardSpot {
  id: string;
  /** percent of the picture width / height */
  x: number;
  y: number;
  n: number;
}

export interface PairBoardProps {
  targets: BoardTarget[];
  /** every chip, in the order the bank shows them (duplicates allowed) */
  choices: string[];
  placed: Record<string, string>;
  onPlace: (next: Record<string, string>) => void;
  locked: boolean;
  /** per target, after checking: right or not quite */
  marks?: Record<string, boolean>;
  /** per target, the right chip (shown under not-quite rows when the answer is revealed) */
  reveal?: Record<string, string>;
  /** the label_diagram picture with tappable numbered spots */
  diagram?: { src: string | undefined; alt: string; spots: BoardSpot[] };
  /** "word" for match, "label" for diagrams */
  noun: string;
}

type Selection = { kind: 'chip'; index: number } | { kind: 'target'; id: string } | null;
interface ChipData {
  value: string;
  from?: string;
}

const BANK = 'bank';

/** The chip indexes still in the bank (one bank chip is used up per placed value). */
function bankIndexes(choices: string[], placed: Record<string, string>): number[] {
  const used = Object.values(placed);
  const left: number[] = [];
  choices.forEach((c, i) => {
    const k = used.indexOf(c);
    if (k >= 0) used.splice(k, 1);
    else left.push(i);
  });
  return left;
}

function Chip({
  id,
  data,
  selected,
  locked,
  onTap,
  label,
}: {
  id: string;
  data: ChipData;
  selected: boolean;
  locked: boolean;
  onTap: () => void;
  label: string;
}) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id, data, disabled: locked });
  const style: CSSProperties = { transform: CSS.Translate.toString(transform) };
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`pb-chip${selected ? ' is-picked' : ''}${isDragging ? ' is-dragging' : ''}`}
      style={style}
      aria-pressed={selected}
      disabled={locked}
      onClick={onTap}
      {...listeners}
    >
      {label}
    </button>
  );
}

/** A placed chip inside a target: drag it to another place or back to the bank. Tapping is the row's. */
function PlacedChip({ id, data, locked }: { id: string; data: ChipData; locked: boolean }) {
  const { setNodeRef, listeners, transform, isDragging } = useDraggable({ id, data, disabled: locked });
  return (
    <span
      ref={setNodeRef}
      className={`pb-placed${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
    >
      {data.value}
    </span>
  );
}

function Drop({
  id,
  children,
  disabled,
}: {
  id: string;
  children: (isOver: boolean, ref: (el: HTMLElement | null) => void) => ReactNode;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return <>{children(isOver, setNodeRef)}</>;
}

/**
 * Pairs things up (match, label_diagram): tap a chip then its place (or the place then the chip), or
 * drag the chip. Enter/Space work like taps, so the keyboard path is the same as the tap path.
 * A placed chip is tapped (or dragged) to take it back.
 */
export function PairBoard({
  targets,
  choices,
  placed,
  onPlace,
  locked,
  marks,
  reveal,
  diagram,
  noun,
}: PairBoardProps) {
  const [sel, setSel] = useState<Selection>(null);
  const [say, setSay] = useState('');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
  );
  const bank = bankIndexes(choices, placed);
  const nameOf = (id: string) => targets.find((t) => t.id === id)?.name ?? id;

  const put = (value: string, id: string, from?: string) => {
    const next = { ...placed };
    const old = next[id];
    if (from && from !== id) {
      delete next[from];
      if (old) next[from] = old;
    }
    next[id] = value;
    onPlace(next);
    setSel(null);
    setSay(`${value} is on ${nameOf(id)}.`);
  };
  const takeBack = (id: string) => {
    const value = placed[id];
    if (!value) return;
    const next = { ...placed };
    delete next[id];
    onPlace(next);
    setSay(`${value} is back with the ${noun}s.`);
  };

  const tapChip = (index: number) => {
    if (locked) return;
    const value = choices[index];
    if (value === undefined) return;
    if (sel?.kind === 'target') return put(value, sel.id);
    if (sel?.kind === 'chip' && sel.index === index) return setSel(null);
    setSel({ kind: 'chip', index });
    setSay(`${value} picked. Now tap where it goes.`);
  };
  const tapTarget = (id: string) => {
    if (locked) return;
    if (sel?.kind === 'chip') {
      const value = choices[sel.index];
      if (value !== undefined) put(value, id);
      return;
    }
    if (placed[id]) {
      takeBack(id);
      setSel({ kind: 'target', id });
      return;
    }
    if (sel?.kind === 'target' && sel.id === id) return setSel(null);
    setSel({ kind: 'target', id });
    setSay(`${nameOf(id)} picked. Now tap a ${noun}.`);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const data = active.data.current as ChipData | undefined;
    if (!data || !over) return;
    const overId = String(over.id);
    if (overId === BANK) {
      if (data.from) takeBack(data.from);
      return;
    }
    const target = overId.replace(/^(row|spot):/, '');
    if (targets.some((t) => t.id === target)) put(data.value, target, data.from);
  };

  const rowState = (id: string) =>
    locked && marks && id in marks ? (marks[id] ? ' is-right' : ' is-tried') : '';
  const pickedTarget = sel?.kind === 'target' ? sel.id : undefined;
  const spotNo = (id: string) => diagram?.spots.find((s) => s.id === id)?.n;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={() => setSel(null)}
      onDragEnd={onDragEnd}
      accessibility={{
        screenReaderInstructions: { draggable: `Tap a ${noun}, then tap where it goes.` },
      }}
    >
      <div className={`pb${locked ? ' is-locked' : ''}${sel?.kind === 'chip' ? ' is-armed' : ''}`}>
        {diagram && (
          <div className="pb-diagram">
            <div className="pb-canvas">
              {diagram.src ? (
                <img className="pb-img" src={diagram.src} alt={diagram.alt} draggable={false} />
              ) : (
                <div className="pb-img is-missing" role="img" aria-label={diagram.alt}>
                  <span aria-hidden="true">🖼️</span> The picture is on its way
                </div>
              )}
              {diagram.spots.map((s) => (
                <Drop key={s.id} id={`spot:${s.id}`} disabled={locked}>
                  {(isOver, ref) => (
                    <button
                      ref={ref}
                      type="button"
                      className={`pb-spot${placed[s.id] ? ' is-filled' : ''}${pickedTarget === s.id ? ' is-picked' : ''}${isOver ? ' is-over' : ''}${rowState(s.id)}`}
                      style={{
                        left: `clamp(calc(29 * var(--px)), ${s.x}%, calc(100% - 29 * var(--px)))`,
                        top: `clamp(calc(29 * var(--px)), ${s.y}%, calc(100% - 29 * var(--px)))`,
                      }}
                      aria-label={`Spot ${s.n}: ${placed[s.id] ?? 'empty'}`}
                      aria-pressed={pickedTarget === s.id}
                      disabled={locked}
                      onClick={() => tapTarget(s.id)}
                    >
                      {s.n}
                    </button>
                  )}
                </Drop>
              ))}
            </div>
          </div>
        )}

        <ul className="pb-rows">
          {targets.map((t) => {
            const value = placed[t.id];
            const mark = locked && marks && t.id in marks ? marks[t.id] : undefined;
            const spoken = `${t.name}: ${value ?? 'empty'}${mark === undefined ? '' : mark ? ', right' : ', not quite'}`;
            return (
              <li key={t.id}>
                <Drop id={`row:${t.id}`} disabled={locked}>
                  {(isOver, ref) => (
                    <button
                      ref={ref}
                      type="button"
                      className={`pb-row${value ? ' is-filled' : ''}${pickedTarget === t.id ? ' is-picked' : ''}${isOver ? ' is-over' : ''}${rowState(t.id)}`}
                      aria-label={spoken}
                      aria-pressed={pickedTarget === t.id}
                      disabled={locked}
                      onClick={() => tapTarget(t.id)}
                    >
                      <span className="pb-head" aria-hidden="true">
                        {t.head}
                      </span>
                      <span className="pb-arrow" aria-hidden="true">
                        →
                      </span>
                      <span className="pb-slot" aria-hidden="true">
                        {value ? (
                          <PlacedChip id={`placed:${t.id}`} data={{ value, from: t.id }} locked={locked} />
                        ) : (
                          <span className="pb-empty">
                            {pickedTarget === t.id
                              ? `Now tap a ${noun}`
                              : sel?.kind === 'chip'
                                ? 'Put it here'
                                : 'Tap to place'}
                          </span>
                        )}
                        {mark !== undefined && <span className="pb-mark">{mark ? '⭐' : '💡'}</span>}
                      </span>
                    </button>
                  )}
                </Drop>
                {mark === false && reveal?.[t.id] && (
                  <p className="q-reveal pb-reveal">
                    <span aria-hidden="true">💡</span>{' '}
                    {spotNo(t.id) !== undefined ? `Spot ${spotNo(t.id)} is` : `${t.name} goes with`}{' '}
                    <b>{reveal[t.id]}</b>
                  </p>
                )}
              </li>
            );
          })}
        </ul>

        {!locked && (
          <Drop id={BANK} disabled={locked}>
            {(isOver, ref) => (
              <div ref={ref} className={`pb-bank${isOver ? ' is-over' : ''}`}>
                <p className="pb-help">
                  {bank.length
                    ? `Tap a ${noun}, then tap its place — or drag it 👆`
                    : `All placed! Tap one to move it, or check your answer.`}
                </p>
                {bank.length > 0 && (
                  <div
                    className="pb-chips"
                    role="group"
                    aria-label={`${noun[0]?.toUpperCase()}${noun.slice(1)}s`}
                  >
                    {bank.map((i) => (
                      <Chip
                        key={`chip:${i}`}
                        id={`chip:${i}`}
                        data={{ value: choices[i]! }}
                        label={choices[i]!}
                        selected={sel?.kind === 'chip' && sel.index === i}
                        locked={locked}
                        onTap={() => tapChip(i)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Drop>
        )}
        <p className="sr-only" aria-live="polite">
          {say}
        </p>
      </div>
    </DndContext>
  );
}
