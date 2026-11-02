import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { useSettings } from '@/state/settingsStore';
import { AskQuestion, type AskMode, type AskOutcome } from './AskQuestion';
import { realQuestion } from './testUtils';

const BANNED = /\b(wrong|bad|careless|fail(ed)?|hurry|incorrect|error)\b/i;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

// che-matter-1-p4 (mcq, practice, has a hint): "A liquid takes the shape of ..."
const MCQ = realQuestion('che-matter-1-p4');
const WRONG = MCQ.options!.find((o) => o !== MCQ.answer)!;
const RIGHT = String(MCQ.answer);

function renderAsk(mode: AskMode, extra: { onWatchAgain?: () => void } = {}) {
  const onDone = vi.fn<(o: AskOutcome) => void>();
  const user = userEvent.setup();
  render(<AskQuestion question={MCQ} mode={mode} subjectId="chemistry" onDone={onDone} {...extra} />);
  const pick = (text: string) =>
    user.click(screen.getByRole('radio', { name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }));
  const checkBtn = () => screen.getByRole('button', { name: 'Check my answer' });
  const sheet = () => screen.getByRole('dialog');
  return { onDone, user, pick, checkBtn, sheet };
}

describe('AskQuestion', () => {
  it('Check is disabled until she answers; a first-try right answer is "Yes! ⭐ Spot on!"', async () => {
    const { onDone, user, pick, checkBtn, sheet } = renderAsk('practice');
    expect(checkBtn()).toBeDisabled();
    await pick(RIGHT);
    expect(checkBtn()).toBeEnabled();
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Yes! ⭐ Spot on!');
    expect(sheet()).toHaveTextContent(MCQ.explanation);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: MCQ.id,
        tries: 1,
        revealed: false,
        response: { type: 'mcq', choice: RIGHT },
        result: expect.objectContaining({ correct: true, score: 1 }),
      }),
    );
  });

  it('practice ladder: clue → watch again → worked answer, then Continue with revealed=true', async () => {
    const onWatchAgain = vi.fn();
    const { onDone, user, pick, checkBtn, sheet } = renderAsk('practice', { onWatchAgain });

    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Almost! Here’s a clue 💡');
    expect(sheet()).toHaveTextContent(MCQ.hints![0]!);
    expect(sheet()).not.toHaveTextContent(BANNED);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(checkBtn()).toBeDisabled(); // the choice was cleared

    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Let’s watch that part again — it’ll click! ▶️');
    await user.click(screen.getByRole('button', { name: 'Watch this bit again ▶️' }));
    expect(onWatchAgain).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Let’s fix this one together 🛠️');
    expect(sheet()).toHaveTextContent(`The answer: ${RIGHT}`);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    // the right option is shown in green, hers in soft amber
    expect(screen.getByRole('radio', { name: new RegExp(RIGHT) }).closest('label')).toHaveClass('is-right');
    expect(screen.getByRole('radio', { name: new RegExp(WRONG) }).closest('label')).toHaveClass('is-tried');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        tries: 3,
        revealed: true,
        result: expect.objectContaining({ correct: false }),
      }),
    );
  });

  it('practice without a video: the second clue replaces "watch again"', async () => {
    const { user, pick, checkBtn, sheet } = renderAsk('practice');
    await pick(WRONG);
    await user.click(checkBtn());
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Almost! Here’s another clue 💡');
    expect(screen.queryByRole('button', { name: /Watch/ })).not.toBeInTheDocument();
  });

  it('checkpoint ladder: clue + "Watch that part again", then the answer and Continue (never trapped)', async () => {
    const onWatchAgain = vi.fn();
    const { onDone, user, pick, checkBtn, sheet } = renderAsk('checkpoint', { onWatchAgain });
    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Almost! Here’s a clue 💡');
    await user.click(screen.getByRole('button', { name: 'Watch that part again ▶️' }));
    expect(onWatchAgain).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent(`The answer: ${RIGHT}`);
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ tries: 2, revealed: true }));
  });

  it('check mode: one try, no hints, then the answer with its explanation', async () => {
    const { onDone, user, pick, checkBtn, sheet } = renderAsk('check');
    await pick(WRONG);
    await user.click(checkBtn());
    expect(sheet()).toHaveTextContent('Not quite — here’s how to get it next time 💡');
    expect(sheet()).toHaveTextContent(`The answer: ${RIGHT}`);
    expect(sheet()).toHaveTextContent(MCQ.explanation);
    expect(sheet()).not.toHaveTextContent(MCQ.hints![0]!);
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ tries: 1, revealed: false, result: expect.objectContaining({ score: 0 }) }),
    );
  });

  it('match: "Try again" keeps the right pairs and sends the not-quite ones back to the bank', async () => {
    const q = realQuestion('che-matter-1-q5');
    const user = userEvent.setup();
    render(<AskQuestion question={q} mode="practice" onDone={() => {}} />);
    const place = async (chip: string, row: string) => {
      await user.click(screen.getByRole('button', { name: chip }));
      await user.click(screen.getByRole('button', { name: `${row}: empty` }));
    };
    await place('No definite shape', 'Shape');
    await place('Only one, always flat', 'Volume');
    await place('Definite volume', 'Free surface');
    await user.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(screen.getByRole('button', { name: 'Shape: No definite shape, right' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Shape: No definite shape' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volume: empty' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Free surface: empty' })).toBeInTheDocument();
  });

  it.each([
    ['Got it', 1],
    ['Partly', 0.5],
    ['Missed', 0],
  ] as const)('self-check: model answer with keywords, then "%s" scores %s', async (label, score) => {
    const q = realQuestion('che-matter-1-q6');
    const onDone = vi.fn<(o: AskOutcome) => void>();
    const user = userEvent.setup();
    render(<AskQuestion question={q} mode="check" onDone={onDone} />);
    const show = screen.getByRole('button', { name: /Show the model answer/ });
    expect(show).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: q.prompt }), 'They have a definite shape.');
    await user.click(show);
    expect(screen.getByRole('heading', { name: /Model answer/ })).toBeInTheDocument();
    const marks = Array.from(document.querySelectorAll('mark.kw')).map((m) => m.textContent?.toLowerCase());
    expect(marks).toContain('definite shape');
    expect(screen.getByText('(you used this)')).toBeInTheDocument();
    const cont = screen.getByRole('button', { name: 'Continue' });
    expect(cont).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: new RegExp(label) }));
    await user.click(cont);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        tries: 1,
        response: expect.objectContaining({ type: 'self_check', text: 'They have a definite shape.' }),
        result: expect.objectContaining({ score }),
      }),
    );
  });

  it('fill_blank: Enter in the box checks the answer', async () => {
    const q = realQuestion('che-matter-1-q3');
    const user = userEvent.setup();
    render(<AskQuestion question={q} mode="practice" onDone={() => {}} />);
    await user.type(screen.getByRole('textbox', { name: 'Fill in the blank' }), '  SOLID {Enter}');
    expect(screen.getByRole('dialog')).toHaveTextContent('Yes! ⭐ Spot on!');
  });

  it('buzzes on a right answer only when Vibration is on (off by default)', async () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    const first = renderAsk('practice');
    await first.pick(RIGHT);
    await first.user.click(first.checkBtn());
    expect(vibrate).not.toHaveBeenCalled();
    cleanup();

    const before = useSettings.getState().settings;
    useSettings.setState({ settings: { ...before, vibration: true } });
    try {
      const second = renderAsk('practice');
      await second.pick(RIGHT);
      await second.user.click(second.checkBtn());
      expect(vibrate).toHaveBeenCalledWith(30);
    } finally {
      useSettings.setState({ settings: before });
    }
  });
});
