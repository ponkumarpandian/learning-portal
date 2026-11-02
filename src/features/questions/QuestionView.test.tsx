import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { Question } from '@/content';
import { grade, type Response } from '@/engine/grading';
import { mediaUrl } from './media';
import { QuestionView } from './QuestionView';
import { startResponse } from './responses';
import { seededShuffle } from './shuffle';
import { NUMERIC_FIXTURE, realQuestion } from './testUtils';

function setup(q: Question, initial?: Response) {
  const seen: Response[] = [];
  function Harness() {
    const [r, setR] = useState<Response>(initial ?? startResponse(q));
    return (
      <QuestionView
        question={q}
        response={r}
        onChange={(x) => {
          seen.push(x);
          setR(x);
        }}
      />
    );
  }
  const utils = render(<Harness />);
  return { ...utils, last: () => seen.at(-1), seen, user: userEvent.setup() };
}

describe('QuestionView', () => {
  it('mcq: shows every option once, in the same shuffled order every time, and reports the choice', async () => {
    const q = realQuestion('phy-light-1-cp1');
    const { unmount } = setup(q);
    const labels = () => screen.getAllByRole('radio').map((r) => r.closest('label')!.textContent!);
    const first = labels();
    expect(first.map((t) => t.slice(1))).toEqual(seededShuffle(q.options!, `${q.id}:options`));
    expect([...first.map((t) => t.slice(1))].sort()).toEqual([...q.options!].sort());
    expect(first.map((t) => t[0])).toEqual(['A', 'B', 'C', 'D']);
    unmount();
    setup(q);
    expect(labels()).toEqual(first); // stable across a "reload"
  });

  it('mcq: reports the option text chosen', async () => {
    const q = realQuestion('che-matter-1-q1');
    const { last, user } = setup(q);
    expect(screen.getByRole('heading', { name: q.prompt })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /A spoon/ }));
    expect(last()).toEqual({ type: 'mcq', choice: 'A spoon' });
  });

  it('true_false: two big choices give a boolean', async () => {
    const q = realQuestion('che-matter-1-q2');
    const { last, user } = setup(q);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    await user.click(screen.getByRole('radio', { name: /False/ }));
    expect(last()).toEqual({ type: 'true_false', value: false });
    await user.click(screen.getByRole('radio', { name: /True/ }));
    expect(last()).toEqual({ type: 'true_false', value: true });
  });

  it('fill_blank: the text box sits inside the sentence', async () => {
    const q = realQuestion('che-matter-1-q3');
    const { last, user } = setup(q);
    const box = screen.getByRole('textbox', { name: 'Fill in the blank' });
    expect(box.closest('p')).toHaveTextContent(/is called\s*\.?$/);
    await user.type(box, 'Solid');
    expect(last()).toEqual({ type: 'fill_blank', text: 'Solid' });
  });

  it('numeric: number box (decimal pad) and a unit picker for the question unit', async () => {
    const { last, user } = setup(NUMERIC_FIXTURE);
    const box = screen.getByRole('textbox', { name: NUMERIC_FIXTURE.prompt });
    expect(box).toHaveAttribute('inputmode', 'decimal');
    await user.type(box, '12.5');
    expect(last()).toEqual({ type: 'numeric', value: 12.5 });
    const units = within(screen.getByRole('radiogroup', { name: 'Unit' })).getAllByRole('radio');
    expect(units.map((u) => (u as HTMLInputElement).value)).toEqual(['mm', 'cm', 'm', 'km']);
    await user.click(screen.getByRole('radio', { name: 'cm' }));
    expect(last()).toEqual({ type: 'numeric', value: 12.5, unit: 'cm' });
    await user.clear(box);
    expect(last()).toEqual({ type: 'numeric', value: null, unit: 'cm' });
  });

  it('match: tap a word then its place, or the place then the word; tap a placed one to take it back', async () => {
    const q = realQuestion('che-matter-1-q5');
    const { last, user } = setup(q);
    // word first, then place
    await user.click(screen.getByRole('button', { name: 'Definite volume' }));
    await user.click(screen.getByRole('button', { name: 'Volume: empty' }));
    expect(last()).toEqual({ type: 'match', pairs: { Volume: 'Definite volume' } });
    expect(screen.queryByRole('button', { name: 'Definite volume' })).not.toBeInTheDocument(); // left the bank
    // place first, then word
    await user.click(screen.getByRole('button', { name: 'Shape: empty' }));
    await user.click(screen.getByRole('button', { name: 'No definite shape' }));
    expect(last()).toEqual({
      type: 'match',
      pairs: { Volume: 'Definite volume', Shape: 'No definite shape' },
    });
    // take one back
    await user.click(screen.getByRole('button', { name: 'Volume: Definite volume' }));
    expect(last()).toEqual({ type: 'match', pairs: { Shape: 'No definite shape' } });
    expect(screen.getByRole('button', { name: 'Definite volume' })).toBeInTheDocument();
  });

  it('match: the keyboard (Enter / Space) picks and places', async () => {
    const q = realQuestion('che-matter-1-q5');
    const { last, user } = setup(q);
    screen.getByRole('button', { name: 'Only one, always flat' }).focus();
    await user.keyboard('{Enter}');
    screen.getByRole('button', { name: 'Free surface: empty' }).focus();
    await user.keyboard(' ');
    expect(last()).toEqual({ type: 'match', pairs: { 'Free surface': 'Only one, always flat' } });
  });

  it('match (locked with a result): each pair shows right or not quite', () => {
    const q = realQuestion('che-matter-1-q5');
    const r: Response = {
      type: 'match',
      pairs: {
        Shape: 'No definite shape',
        Volume: 'Only one, always flat',
        'Free surface': 'Definite volume',
      },
    };
    render(<QuestionView question={q} response={r} onChange={() => {}} locked result={grade(q, r)} />);
    expect(screen.getByRole('button', { name: 'Shape: No definite shape, right' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Volume: Only one, always flat, not quite' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/wrong/i)).not.toBeInTheDocument();
  });

  it('label_diagram: shows the picture and places labels by tap-tap on the spots or the rows', async () => {
    const q = realQuestion('che-matter-1-p3');
    expect(mediaUrl(q.image!)).toBeTruthy();
    const { last, user } = setup(q);
    const img = screen.getByRole('img', { name: /Label the syringe/ });
    expect(img).toHaveAttribute('src', mediaUrl(q.image!));
    const spot1 = screen.getAllByRole('button', { name: 'Spot 1: empty' })[0]!;
    expect(spot1.style.left).toContain('15%');
    await user.click(screen.getByRole('button', { name: 'Plunger' }));
    await user.click(spot1);
    expect(last()).toEqual({ type: 'label_diagram', placed: { h1: 'Plunger' } });
    // the row for spot 3, then the label
    const rows = screen.getAllByRole('button', { name: 'Spot 3: empty' });
    expect(rows).toHaveLength(2); // the marker on the picture and the row below it
    await user.click(rows[1]!);
    await user.click(screen.getByRole('button', { name: 'Sealed nozzle' }));
    expect(last()).toEqual({ type: 'label_diagram', placed: { h1: 'Plunger', h3: 'Sealed nozzle' } });
  });

  it('order: starts shuffled (never solved), and the ▲ ▼ buttons reorder it from the keyboard', async () => {
    const q = realQuestion('che-matter-2-q4');
    const { last, user } = setup(q, { type: 'order', sequence: [] });
    const start = last();
    expect(start?.type).toBe('order');
    const seq = start?.type === 'order' ? start.sequence : [];
    expect([...seq].sort()).toEqual([...q.sequence!].sort());
    expect(seq).not.toEqual(q.sequence);

    const items = () =>
      within(screen.getByRole('list', { name: q.prompt }))
        .getAllByRole('listitem')
        .map((li) => li.querySelector('.ord-text')!.textContent);
    expect(items()).toEqual(seq);
    const firstItem = seq[0]!;
    screen.getByRole('button', { name: `Move “${firstItem}” down` }).focus();
    await user.keyboard('{Enter}');
    expect(last()).toEqual({ type: 'order', sequence: [seq[1], seq[0], ...seq.slice(2)] });
    expect(screen.getByRole('button', { name: `Move “${firstItem}” down` })).toHaveFocus();
    expect(screen.getByText(`“${firstItem}” is now number 2 of ${seq.length}.`)).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(items()[2]).toBe(firstItem);
    // the top item's ▲ does nothing
    const top = items()[0]!;
    await user.click(screen.getByRole('button', { name: `Move “${top}” up` }));
    expect(items()[0]).toBe(top);
  });

  it.each(['che-matter-1-q6', 'che-matter-1-q7'])('%s (self-check types): a text box', async (id) => {
    const q = realQuestion(id);
    const { last, user } = setup(q);
    await user.type(screen.getByRole('textbox', { name: q.prompt }), 'Definite shape');
    expect(last()).toEqual({ type: 'self_check', text: 'Definite shape' });
  });
});
