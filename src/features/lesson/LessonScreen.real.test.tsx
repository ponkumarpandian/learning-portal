/**
 * The lesson with the REAL video player and question widget (no stubs): an unplayable video falls
 * back to the cards, and two not-quite practice answers never trap her.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db } from '@/db/db';
import { getLessonProgress, listAttempts, saveLessonProgress } from '@/db/repos';
import { fixedClock } from '@/engine/clock';
import { VIDEO_UNAVAILABLE } from '@/features/video';
import { ClockContext } from '@/state/clock';
import { useContent } from '@/state/content';
import { LessonScreen } from './LessonScreen';
import { emptyData, type QuestionRecord } from './lessonFlow';

const original = useContent.getState().bundle;
const chem = original.chapters.find((c) => c.id === 'che-matter')!;
const che1 = chem.lessons[0]!;
const FRI_CHEM = original.timetable.days.fri.findIndex((s) => s.subject === 'chemistry');
const PATH = `/lesson/2026-11-06/${FRI_CHEM}`;
const SLOT_KEY = `2026-11-06#${FRI_CHEM}`;

// whole lessons are long user journeys; give them room when the suite runs in parallel
vi.setConfig({ testTimeout: 30_000 });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  useContent.setState({ bundle: original });
});
afterEach(() => {
  useContent.setState({ bundle: original });
});

const renderLesson = () =>
  render(
    <ClockContext.Provider value={fixedClock('2026-11-06T18:40')}>
      <MemoryRouter initialEntries={[PATH]}>
        <Routes>
          <Route path="/lesson/:date/:slot" element={<LessonScreen />} />
        </Routes>
      </MemoryRouter>
    </ClockContext.Provider>,
  );

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

describe('LessonScreen with the real player and questions', () => {
  it('offline / no playable video: goes straight to the learn cards with the friendly note', async () => {
    const lesson = {
      ...che1,
      videos: [
        {
          role: 'primary' as const,
          kind: 'youtube' as const,
          youtubeId: 'REPLACE_ME',
          title: 'Clip',
          checkpoints: [],
        },
      ],
    };
    useContent.setState({
      bundle: {
        ...original,
        chapters: original.chapters.map((c) =>
          c.id === chem.id ? { ...c, lessons: [lesson, ...c.lessons.slice(1)] } : c,
        ),
      },
    });
    renderLesson();
    expect(await screen.findByRole('heading', { level: 3, name: che1.cards[0]!.title })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(VIDEO_UNAVAILABLE);
    await waitFor(async () =>
      expect((await getLessonProgress(che1.id))?.data).toMatchObject({ unavailable: true, stepId: 'learn' }),
    );
  });

  it('the explainer plays when the YouTube alternate is not set (the real lesson)', async () => {
    renderLesson();
    const explainerId = (che1.videos.find((v) => v.kind === 'explainer') as { explainerId: string })
      .explainerId;
    const explainer = original.explainers.find((e) => e.id === explainerId)!;
    expect(await screen.findByRole('region', { name: `Video: ${explainer.title}` })).toBeInTheDocument();
  });

  it('two not-quite practice answers: a clue, then "watch this bit again" (and back), then the answer — she goes on', async () => {
    const q = che1.practice.find((x) => x.type === 'mcq' && x.videoRef)!;
    const i = che1.practice.indexOf(q);
    const done: Record<string, QuestionRecord> = Object.fromEntries(
      che1.practice.slice(0, i).map((p) => [
        p.id,
        {
          response: { type: 'self_check', text: '' },
          result: { score: 1, correct: true, yourAnswer: '', correctAnswer: '' },
          tries: 1,
          revealed: false,
        },
      ]),
    );
    await saveLessonProgress(che1.id, {
      step: 2,
      data: {
        ...emptyData(SLOT_KEY),
        stepId: 'try',
        furthest: 2,
        watched: true,
        practiceResults: done,
        practiceDone: i,
      },
    });

    const u = userEvent.setup();
    renderLesson();
    expect(await screen.findByText(q.prompt)).toBeInTheDocument();
    const wrong = q.options!.find((o) => o !== q.answer)!;
    const pickWrong = () => u.click(screen.getByRole('radio', { name: new RegExp(esc(wrong)) }));
    const check = () => u.click(screen.getByRole('button', { name: 'Check my answer' }));

    await pickWrong();
    await check();
    expect(screen.getByRole('dialog')).toHaveTextContent('Almost! Here’s a clue 💡');
    await u.click(screen.getByRole('button', { name: 'Try again' }));

    await pickWrong();
    await check();
    expect(screen.getByRole('dialog')).toHaveTextContent('Let’s watch that part again — it’ll click! ▶️');
    await u.click(screen.getByRole('button', { name: 'Watch this bit again ▶️' }));
    expect(screen.getByRole('heading', { level: 2, name: /Watch that bit again/ })).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: 'Back to my question ↩' }));
    expect(screen.getByText(q.prompt)).toBeVisible();

    // the third go shows the worked answer and Continue moves on
    await pickWrong();
    await check();
    expect(screen.getByRole('dialog')).toHaveTextContent(`The answer: ${String(q.answer)}`);
    await u.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { level: 2, name: /Notebook time!/ })).toBeInTheDocument();

    const tries = await listAttempts({ lessonId: che1.id, source: 'practice' });
    expect(tries).toHaveLength(1);
    expect(tries[0]).toMatchObject({ questionId: q.id, score: 0 });
  });
});
