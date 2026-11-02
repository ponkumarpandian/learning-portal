import { useId, useMemo } from 'react';
import { OptionButton, type OptionState } from '@/components/OptionButton';
import { mcqOptions } from '../responses';
import type { InputProps } from './types';

const LETTERS = 'ABCD';

/** mcq: 2–4 OptionButtons, shuffled the same way every time for this question id. */
export function McqInput({ q, response, onChange, locked, result, reveal, promptId }: InputProps) {
  const name = useId();
  const options = useMemo(() => mcqOptions(q), [q]);
  const choice = response?.type === 'mcq' ? response.choice : '';
  return (
    <div className="options" role="radiogroup" aria-labelledby={promptId}>
      {options.map((o, i) => {
        let state: OptionState = 'idle';
        if (locked && result) {
          if (o === choice) state = result.correct ? 'right' : 'tried';
          else if (reveal && o === q.answer) state = 'right';
        }
        return (
          <OptionButton
            key={o}
            name={name}
            value={o}
            letter={LETTERS[i] ?? String(i + 1)}
            text={o}
            checked={o === choice}
            disabled={locked}
            state={state}
            onChange={(v) => onChange({ type: 'mcq', choice: v })}
          />
        );
      })}
    </div>
  );
}

const TF = [
  { value: true, letter: 'T', text: 'True' },
  { value: false, letter: 'F', text: 'False' },
] as const;

/** true_false: two big side-by-side buttons. */
export function TrueFalseInput({ q, response, onChange, locked, result, reveal, promptId }: InputProps) {
  const name = useId();
  const value = response?.type === 'true_false' ? response.value : null;
  return (
    <div className="options tf-options" role="radiogroup" aria-labelledby={promptId}>
      {TF.map((o) => {
        let state: OptionState = 'idle';
        if (locked && result) {
          if (o.value === value) state = result.correct ? 'right' : 'tried';
          else if (reveal && o.value === q.answer) state = 'right';
        }
        return (
          <OptionButton
            key={o.text}
            name={name}
            value={String(o.value)}
            letter={o.letter}
            text={o.text}
            checked={value === o.value}
            disabled={locked}
            state={state}
            onChange={(v) => onChange({ type: 'true_false', value: v === 'true' })}
          />
        );
      })}
    </div>
  );
}
