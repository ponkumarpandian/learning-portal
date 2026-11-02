import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import { isPermutation, orderStart, partCorrect } from '../responses';
import type { InputProps } from './types';

interface ItemProps {
  item: string;
  index: number;
  count: number;
  locked: boolean;
  mark: boolean | undefined;
  revealAt: number | undefined;
  move: (from: number, to: number) => void;
}

function OrderItem({ item, index, count, locked, mark, revealAt, move }: ItemProps) {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: item,
    disabled: locked,
  });
  const first = index === 0;
  const last = index === count - 1;
  const state = mark === undefined ? '' : mark ? ' is-right' : ' is-tried';
  return (
    <li
      ref={setNodeRef}
      className={`ord-item${isDragging ? ' is-dragging' : ''}${state}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      aria-roledescription={attributes['aria-roledescription']}
    >
      <span className="ord-handle" {...listeners}>
        <span className="ord-n" aria-hidden="true">
          {index + 1}
        </span>
        <span className="ord-text">
          {item}
          {mark !== undefined && <span className="sr-only">{mark ? ', right place' : ', not quite'}</span>}
          {mark === false && revealAt !== undefined && (
            <span className="ord-reveal">
              <span aria-hidden="true">💡</span> goes at number {revealAt + 1}
            </span>
          )}
        </span>
        {mark !== undefined ? (
          <span className="ord-mark" aria-hidden="true">
            {mark ? '⭐' : '💡'}
          </span>
        ) : (
          !locked && (
            <span className="ord-grip" aria-hidden="true">
              ⠿
            </span>
          )
        )}
      </span>
      {!locked && (
        <span className="ord-moves">
          <button
            type="button"
            className="ord-btn"
            aria-label={`Move “${item}” up`}
            aria-disabled={first}
            onClick={() => !first && move(index, index - 1)}
          >
            ▲
          </button>
          <button
            type="button"
            className="ord-btn"
            aria-label={`Move “${item}” down`}
            aria-disabled={last}
            onClick={() => !last && move(index, index + 1)}
          >
            ▼
          </button>
        </span>
      )}
    </li>
  );
}

/**
 * order: drag the cards into sequence (dnd-kit sortable), or use ▲ ▼ (tap or keyboard). The list
 * starts shuffled (never already solved) and is her answer as it stands.
 */
export function OrderInput({ q, response, onChange, locked, result, reveal, promptId }: InputProps) {
  const start = useMemo(() => orderStart(q), [q]);
  const given = response?.type === 'order' ? response.sequence : undefined;
  const valid = isPermutation(q, given);
  const seq = valid ? given : start;
  const [say, setSay] = useState('');
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 140, tolerance: 8 } }),
  );

  // The list on screen is her answer: tell the parent as soon as it is shown.
  useEffect(() => {
    if (!valid && !locked) onChange({ type: 'order', sequence: start });
  }, [valid, locked, start, onChange]);

  const move = (from: number, to: number) => {
    if (locked || to < 0 || to >= seq.length) return;
    const next = arrayMove(seq, from, to);
    onChange({ type: 'order', sequence: next });
    setSay(`“${seq[from]}” is now number ${to + 1} of ${seq.length}.`);
  };
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    move(seq.indexOf(String(active.id)), seq.indexOf(String(over.id)));
  };
  const right = q.sequence ?? [];

  return (
    <div className="ord">
      {!locked && (
        <p className="pb-help">
          Drag the cards into order, or use ▲ ▼ to move them <span aria-hidden="true">👆</span>
        </p>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: { draggable: 'Use the up and down buttons to move this card.' },
        }}
      >
        <SortableContext items={seq} strategy={verticalListSortingStrategy}>
          <ol className="ord-list" aria-labelledby={promptId}>
            {seq.map((item, i) => {
              const mark = locked && result ? partCorrect(result, item, right[i] === item) : undefined;
              return (
                <OrderItem
                  key={item}
                  item={item}
                  index={i}
                  count={seq.length}
                  locked={locked}
                  mark={mark}
                  revealAt={reveal ? right.indexOf(item) : undefined}
                  move={move}
                />
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
      <p className="sr-only" aria-live="polite">
        {say}
      </p>
    </div>
  );
}
