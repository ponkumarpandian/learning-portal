import { useMemo } from 'react';
import { mediaUrl } from '../media';
import { labelChoices, labelKey, matchChoices, matchKey, partCorrect } from '../responses';
import { PairBoard, type BoardTarget } from './PairBoard';
import type { InputProps } from './types';

function marksFor(
  ids: string[],
  key: Record<string, string>,
  placed: Record<string, string>,
  result: InputProps['result'],
) {
  return Object.fromEntries(ids.map((id) => [id, partCorrect(result, id, placed[id] === key[id])]));
}

/** match: left items as rows; the right items are chips to drag or tap into place. */
export function MatchInput({ q, response, onChange, locked, result, reveal }: InputProps) {
  const choices = useMemo(() => matchChoices(q), [q]);
  const key = useMemo(() => matchKey(q), [q]);
  const pairs = response?.type === 'match' ? response.pairs : {};
  const targets: BoardTarget[] = (q.pairs ?? []).map(([left]) => ({ id: left, head: left, name: left }));
  const ids = targets.map((t) => t.id);
  return (
    <PairBoard
      targets={targets}
      choices={choices}
      placed={pairs}
      onPlace={(next) => onChange({ type: 'match', pairs: next })}
      locked={locked}
      marks={locked && result ? marksFor(ids, key, pairs, result) : undefined}
      reveal={reveal ? key : undefined}
      noun="word"
    />
  );
}

/** label_diagram: the picture with numbered spots (at the hotspot x/y %), and label chips to place. */
export function LabelDiagramInput({ q, response, onChange, locked, result, reveal }: InputProps) {
  const choices = useMemo(() => labelChoices(q), [q]);
  const key = useMemo(() => labelKey(q), [q]);
  const placed = response?.type === 'label_diagram' ? response.placed : {};
  const spots = (q.hotspots ?? []).map((h, i) => ({ id: h.id, x: h.x, y: h.y, n: i + 1 }));
  const targets: BoardTarget[] = spots.map((s) => ({
    id: s.id,
    name: `Spot ${s.n}`,
    head: (
      <span className="pb-num">
        <b>{s.n}</b>
      </span>
    ),
  }));
  return (
    <PairBoard
      targets={targets}
      choices={choices}
      placed={placed}
      onPlace={(next) => onChange({ type: 'label_diagram', placed: next })}
      locked={locked}
      marks={
        locked && result
          ? marksFor(
              spots.map((s) => s.id),
              key,
              placed,
              result,
            )
          : undefined
      }
      reveal={reveal ? key : undefined}
      diagram={{ src: q.image ? mediaUrl(q.image) : undefined, alt: `Picture for: ${q.prompt}`, spots }}
      noun="label"
    />
  );
}
