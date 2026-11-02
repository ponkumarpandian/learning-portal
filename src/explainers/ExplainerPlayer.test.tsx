import { act, fireEvent, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { getExplainer, loadContent, type Explainer } from '@/content';
import { estimateSceneSeconds } from '@/content/validate';
import { ExplainerPlayer } from './ExplainerPlayer';
import { silentNarrator, type Narrator } from './speech';

const bundle = loadContent();
// matter-solids-liquids: scenes 0 and 1 are plain, scene 2 ends with a checkpoint (mcq)
const EX = getExplainer(bundle, 'matter-solids-liquids')!;
const CP = EX.questions.find((q) => q.id === EX.scenes[2]!.checkpoint!.questionId)!;

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

const advance = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });

const partLabel = (n: number, total: number) => `Part ${n} of ${total}`;

describe('ExplainerPlayer (captions only: jsdom has no speechSynthesis)', () => {
  it('starts on a big Play button, shows captions, and auto-advances scenes', () => {
    render(<ExplainerPlayer explainer={EX} narrator={silentNarrator} />);
    const n = EX.scenes.length;
    expect(screen.getByText(partLabel(1, n))).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Play: ${EX.title}` }));
    expect(screen.getByRole('status', { name: 'Captions' })).toHaveTextContent(
      EX.scenes[0]!.narration.split('.')[0]!,
    );
    advance(estimateSceneSeconds(EX.scenes[0]!) + 0.5);
    expect(screen.getByText(partLabel(2, n))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeEnabled();
  });

  it('pauses at a checkpoint with the question, and moves on after Continue', () => {
    render(<ExplainerPlayer explainer={EX} narrator={silentNarrator} />);
    fireEvent.click(screen.getByRole('button', { name: `Play: ${EX.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /^Part 3:/ }));
    advance(estimateSceneSeconds(EX.scenes[2]!) + 0.5);
    expect(screen.getByText('Quick question!')).toBeInTheDocument();
    expect(screen.getByText(CP.prompt)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back 10 s' })).toBeDisabled();
    advance(30); // stays paused
    expect(screen.getByText('Quick question!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: new RegExp(String(CP.answer)) }));
    fireEvent.click(screen.getByRole('button', { name: 'Check my answer' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Yes!');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.queryByText('Quick question!')).not.toBeInTheDocument();
    expect(screen.getByText(partLabel(4, EX.scenes.length))).toBeInTheDocument();
  });

  it('calls onEnded once it reaches the end with every checkpoint answered', () => {
    const tiny: Explainer = {
      id: 'tiny',
      subject: 'chemistry',
      title: 'Tiny',
      sample: true,
      scenes: [{ visual: 'ParticleBox', props: { state: 'gas' }, narration: 'Hi.', minDuration: 2 }],
      questions: [],
    };
    const onEnded = vi.fn();
    render(<ExplainerPlayer explainer={tiny} narrator={silentNarrator} autoPlay onEnded={onEnded} />);
    advance(2.5);
    expect(onEnded).toHaveBeenCalledWith({ checkpointsAllCorrect: true, outcomes: [] });
    expect(screen.getByText('All watched — well done!')).toBeInTheDocument();
  });

  it('narrates sentence by sentence through the injected narrator', () => {
    const spoken: string[] = [];
    let finish = () => {};
    const narrator: Narrator = {
      available: true,
      speak: (text, { onEnd }) => {
        spoken.push(text);
        finish = onEnd;
      },
      cancel: () => {},
      pause: () => {},
      resume: () => {},
    };
    render(<ExplainerPlayer explainer={EX} narrator={narrator} autoPlay />);
    expect(spoken).toEqual(['Look around you.']);
    act(() => finish());
    expect(spoken[1]).toMatch(/^Cups, saucers/);
    expect(screen.getByRole('status', { name: 'Captions' })).toHaveTextContent(/Cups, saucers/);
  });
});
