import { useId, useState } from 'react';
import { parseNumber, unitChoices } from '../units';
import type { InputProps } from './types';

const BLANK = /_{2,}/;

function markClass(locked: boolean, correct: boolean | undefined): string {
  if (!locked || correct === undefined) return '';
  return correct ? ' is-right' : ' is-tried';
}

/**
 * fill_blank: the sentence with a big text box where "____" is. FillBlankInput renders the prompt
 * itself (QuestionView skips its heading), so the box sits inside the sentence.
 */
export function FillBlankInput({ q, response, onChange, locked, result, reveal, promptId }: InputProps) {
  const text = response?.type === 'fill_blank' ? response.text : '';
  const [before, ...rest] = q.prompt.split(BLANK);
  const hasBlank = rest.length > 0;
  const after = rest.join('____');
  const input = (
    <input
      className={`fb-input${markClass(locked, result?.correct)}`}
      type="text"
      value={text}
      readOnly={locked}
      autoComplete="off"
      autoCapitalize="off"
      spellCheck={false}
      enterKeyHint="done"
      aria-label="Fill in the blank"
      aria-describedby={`${promptId}-full`}
      size={Math.max(6, Math.min(18, text.length + 2))}
      onChange={(e) => onChange({ type: 'fill_blank', text: e.target.value })}
    />
  );
  return (
    <div className="fb">
      <span id={`${promptId}-full`} className="sr-only">
        {q.prompt.replace(BLANK, 'blank')}
      </span>
      {hasBlank ? (
        <p className="question fb-sentence" id={promptId}>
          {before}
          {input}
          {after}
        </p>
      ) : (
        <>
          <h2 className="question" id={promptId}>
            {q.prompt}
          </h2>
          <p className="fb-sentence">{input}</p>
        </>
      )}
      {locked && result && !result.correct && reveal && (
        <p className="q-reveal">
          <span aria-hidden="true">💡</span> It’s <b>{result.correctAnswer}</b>
        </p>
      )}
    </div>
  );
}

/** numeric: a big number box (number pad on tablets/phones) plus a unit picker when the question has a unit. */
export function NumericInput({ q, response, onChange, locked, result, reveal, promptId }: InputProps) {
  const r = response?.type === 'numeric' ? response : undefined;
  const [text, setText] = useState(() => (r && r.value !== null ? String(r.value) : ''));
  const units = unitChoices(q.unit);
  const unitName = useId();
  const emit = (value: number | null, unit: string | undefined) =>
    onChange(unit ? { type: 'numeric', value, unit } : { type: 'numeric', value });

  return (
    <div className="num">
      <div className="num-row">
        <input
          className={`num-input${markClass(locked, result?.correct)}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={text}
          readOnly={locked}
          aria-labelledby={promptId}
          placeholder="0"
          onChange={(e) => {
            const v = e.target.value.replace(/[^\d.,-]/g, '');
            setText(v);
            emit(parseNumber(v), r?.unit);
          }}
        />
        {q.unit && units.length === 0 && <span className="num-unit">{q.unit}</span>}
      </div>
      {units.length > 0 && (
        <div className="unit-pick" role="radiogroup" aria-label="Unit">
          {units.map((u) => (
            <label key={u} className="unit-chip">
              <input
                className="sr-only"
                type="radio"
                name={unitName}
                value={u}
                checked={r?.unit === u}
                disabled={locked}
                onChange={() => emit(r?.value ?? parseNumber(text), u)}
              />
              {u}
            </label>
          ))}
        </div>
      )}
      {locked && result && !result.correct && reveal && (
        <p className="q-reveal">
          <span aria-hidden="true">💡</span> It’s <b>{result.correctAnswer}</b>
        </p>
      )}
    </div>
  );
}

/** short_answer / think_write: a text box. The self-check (model answer + rating) is in AskQuestion. */
export function SelfCheckInput({ q, response, onChange, locked, promptId }: InputProps) {
  const r = response?.type === 'self_check' ? response : undefined;
  const big = q.type === 'think_write';
  return (
    <div className="sc">
      {big && (
        <p className="sc-tag">
          <span aria-hidden="true">💭</span> Think and write
        </p>
      )}
      <textarea
        className={`sc-text${big ? ' is-big' : ''}`}
        rows={big ? 6 : 3}
        value={r?.text ?? ''}
        readOnly={locked}
        aria-labelledby={promptId}
        placeholder={big ? 'Take your time. Write what you think…' : 'Write your answer here…'}
        onChange={(e) =>
          onChange(
            r?.rating
              ? { type: 'self_check', text: e.target.value, rating: r.rating }
              : { type: 'self_check', text: e.target.value },
          )
        }
      />
    </div>
  );
}
