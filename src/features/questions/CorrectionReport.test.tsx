import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { grade } from '@/engine/grading';
import { CorrectionReport } from './CorrectionReport';
import { realQuestion } from './testUtils';

const blank = realQuestion('phy-light-1-q4'); // fill_blank with a videoRef
const match = realQuestion('phy-light-1-q6'); // match with a videoRef
const tf = realQuestion('phy-light-1-q3'); // true_false, no videoRef

const items = [
  { question: blank, result: grade(blank, { type: 'fill_blank', text: 'clear' }) },
  {
    question: match,
    result: grade(match, {
      type: 'match',
      pairs: {
        Transparent: 'Almost all light passes',
        Translucent: 'No light passes',
        Opaque: 'Some light passes',
      },
    }),
  },
  { question: tf, result: grade(tf, { type: 'true_false', value: true }) }, // right: not in the report
];

describe('CorrectionReport', () => {
  it('lists only the not-quite answers, with your answer, the correct answer and why', () => {
    render(<CorrectionReport items={items} />);
    expect(
      screen.getByRole('heading', { name: 'Let’s fix these together 🛠️ — each one makes you stronger.' }),
    ).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    const first = within(rows[0]!);
    expect(first.getByText('Your answer').nextSibling).toHaveTextContent('clear');
    expect(first.getByText('Correct answer').nextSibling).toHaveTextContent('opaque');
    expect(first.getByText('Why — and how to get it next time').nextSibling).toHaveTextContent(
      blank.explanation,
    );
    expect(first.getByText('Let’s fix this one')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Partly there 🤏')).toBeInTheDocument();
    expect(screen.queryByText(tf.prompt)).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/\b(wrong|bad|careless|fail)/i);
  });

  it('"Watch this bit again" sends the videoRef; "Try a similar one" shows only when a variant exists', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    const onTrySimilar = vi.fn();
    render(
      <CorrectionReport
        items={items}
        onWatch={onWatch}
        onTrySimilar={onTrySimilar}
        hasSimilar={(q) => q.id === blank.id}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    await user.click(within(rows[0]!).getByRole('button', { name: 'Watch this bit again ▶️' }));
    expect(onWatch).toHaveBeenCalledWith(blank.videoRef);
    await user.click(within(rows[0]!).getByRole('button', { name: 'Try a similar one 🔁' }));
    expect(onTrySimilar).toHaveBeenCalledWith(blank);
    expect(within(rows[1]!).queryByRole('button', { name: /Try a similar one/ })).not.toBeInTheDocument();
    expect(within(rows[1]!).getByRole('button', { name: 'Watch this bit again ▶️' })).toBeInTheDocument();
  });

  it('with nothing to fix it says so kindly', () => {
    render(<CorrectionReport items={[items[2]!]} />);
    expect(screen.getByRole('heading', { name: /Nothing to fix/ })).toBeInTheDocument();
  });
});
