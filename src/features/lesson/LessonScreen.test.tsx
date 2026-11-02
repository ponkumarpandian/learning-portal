/**
 * The lesson screen end to end, with the video player and the question widget replaced by small stubs
 * (their own behaviour is tested in src/features/video and src/features/questions; the real ones run
 * in LessonScreen.real.test.tsx). Storage is fake-indexeddb, time is a fixed IST clock.
 */
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'framer-motion';
import { MemoryRouter, Route, Routes } from 'react-router';
import { db } from '@/db/db';
import { addStars, getLessonProgress, getRewards, getSlotLog, listAttempts, setSlotStatus } from '@/db/repos';
import { fixedClock } from '@/engine/clock';
import type { AskQuestionProps } from '@/features/questions';
import type { LessonVideoProps } from '@/features/video';
import { TodayScreen } from '@/features/today/TodayScreen';
import { ClockContext } from '@/state/clock';
import { useContent } from '@/state/content';
import { LessonScreen } from './LessonScreen';

vi.mock('@/features/video', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/video')>();
  function StubVideo(p: LessonVideoProps) {
    return (
      <div data-testid="video" data-which={p.which ?? 'primary'} data-seek={JSON.stringify(p.seekTo ?? null)}>
        <button type="button" onClick={() => p.onWatched({ checkpointsAllCorrect: true })}>
          stub: reach the end
        </button>
        <button
          type="button"
          onClick={() =>
            p.onCheckpointOutcome?.({
              questionId: 'cp-1',
              response: { type: 'true_false', value: true },
              result: { score: 1, correct: true, yourAnswer: 'True', correctAnswer: 'True' },
              tries: 1,
              revealed: false,
            })
          }
        >
          stub: checkpoint right
        </button>
        <button type="button" onClick={() => p.onUnavailable()}>
          stub: no video
        </button>
      </div>
    );
  }
  return { ...real, LessonVideo: StubVideo };
});

vi.mock('@/features/questions', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/questions')>();
  function StubAsk(p: AskQuestionProps) {
    const answer = (score: number) =>
      p.onDone({
        questionId: p.question.id,
        response: { type: 'self_check', text: `answer ${score}` },
        result: { score, correct: score === 1, yourAnswer: 'mine', correctAnswer: 'the right one' },
        tries: score === 1 ? 1 : 3,
        revealed: score !== 1 && p.mode === 'practice',
      });
    return (
      <div data-testid="ask" data-mode={p.mode}>
        <p>{p.question.prompt}</p>
        <button type="button" onClick={() => answer(1)}>
          stub: answer right
        </button>
        <button type="button" onClick={() => answer(0)}>
          stub: answer not quite
        </button>
        {p.onWatchAgain && (
          <button type="button" onClick={p.onWatchAgain}>
            stub: watch again
          </button>
        )}
      </div>
    );
  }
  return { ...real, AskQuestion: StubAsk };
});

const original = useContent.getState().bundle;
const chem = original.chapters.find((c) => c.id === 'che-matter')!;
const che1 = chem.lessons[0]!;
const che2 = chem.lessons[1]!;
const phy1 = original.chapters.find((c) => c.id === 'phy-light')!.lessons[0]!;
const FRI_CHEM = original.timetable.days.fri.findIndex((s) => s.subject === 'chemistry');
const SAT_CHEM = original.timetable.days.sat.findIndex((s) => s.subject === 'chemistry');
const MON_PHYS = original.timetable.days.mon.findIndex((s) => s.subject === 'physics');

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

function renderAt(wall: string, path: string) {
  return render(
    <ClockContext.Provider value={fixedClock(wall)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/lesson/:date/:slot" element={<LessonScreen />} />
        </Routes>
      </MemoryRouter>
    </ClockContext.Provider>,
  );
}

const user = () => userEvent.setup();
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const currentStep = () =>
  screen.getByRole('list', { name: 'Lesson steps' }).querySelector('[aria-current="step"]')?.textContent;

async function finishVideo(u: ReturnType<typeof userEvent.setup>) {
  await screen.findByTestId('video');
  await u.click(btn('stub: checkpoint right'));
  await u.click(btn('stub: reach the end'));
}

async function answerAll(u: ReturnType<typeof userEvent.setup>, n: number, right = true) {
  for (let i = 0; i < n; i++) {
    await u.click(
      await screen.findByRole('button', { name: right ? 'stub: answer right' : 'stub: answer not quite' }),
    );
  }
}

describe('LessonScreen', () => {
  it('Friday 18:40: Start Chemistry on Today plays che-matter-1 from start to finish (§6)', async () => {
    const u = user();
    renderAt('2026-11-06T18:40', '/');
    await u.click(await screen.findByRole('button', { name: /Start Chemistry/ }));

    expect(await screen.findByRole('heading', { level: 1, name: che1.title })).toBeInTheDocument();
    expect(currentStep()).toMatch(/Watch/);
    // the first time, Next waits for the end of the video
    expect(btn(/Next: learn cards/)).toBeDisabled();
    expect(screen.getByText('Watch to the end to unlock Next ⭐')).toBeInTheDocument();
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));

    // learn cards, one per screen
    expect(currentStep()).toMatch(/Learn/);
    for (let i = 0; i < che1.cards.length; i++) {
      expect(screen.getByRole('heading', { level: 3, name: che1.cards[i]!.title })).toBeInTheDocument();
      if (che1.cards[i]!.didYouKnow) expect(screen.getByText('Did you know? 🤩')).toBeInTheDocument();
      await u.click(btn(i < che1.cards.length - 1 ? /Next card/ : /Next: try it/));
    }

    // try: every practice question, then the notebook
    expect(currentStep()).toMatch(/Try/);
    expect(screen.getByTestId('ask')).toHaveAttribute('data-mode', 'practice');
    await answerAll(u, che1.practice.length);
    expect(await screen.findByText(che1.notebook)).toBeInTheDocument();
    await u.click(btn(/Done ✅/));

    // lesson check: 5 questions (45-minute template), then the score
    expect(currentStep()).toMatch(/Check/);
    expect(screen.getByTestId('ask')).toHaveAttribute('data-mode', 'check');
    await answerAll(u, 5);
    await screen.findByRole('heading', { level: 2, name: /Your Lesson Check/ });
    expect(screen.getByText('Yes! ⭐ Every one spot on!')).toBeInTheDocument();
    expect(screen.getByTestId('confetti')).toBeInTheDocument();
    expect(screen.getByText(/Nothing to fix/)).toBeInTheDocument();

    // key rules + stars
    await u.click(btn(/Next: my stars/));
    expect(screen.getByRole('heading', { level: 3, name: 'You earned 3 stars!' })).toBeInTheDocument();
    for (const r of che1.keyRules) expect(screen.getByText(r)).toBeInTheDocument();
    expect(screen.getByText(`Next time in Chemistry: ${che2.title}`)).toBeInTheDocument();
    expect(screen.getByText(/Up next today: .*Physics at 8:30/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to my trail/ })).toHaveAttribute('href', '/');

    await waitFor(async () => expect((await getLessonProgress(che1.id))?.status).toBe('done'));
    expect((await getSlotLog('2026-11-06', FRI_CHEM))?.status).toBe('done');
    expect((await getRewards()).stars).toBe(3);
    const attempts = await listAttempts({ lessonId: che1.id });
    expect(attempts.filter((a) => a.source === 'practice')).toHaveLength(che1.practice.length);
    expect(attempts.filter((a) => a.source === 'lesson_check')).toHaveLength(5);
    expect(attempts.filter((a) => a.source === 'checkpoint')).toHaveLength(1);

    // back on Today: the stone is done (gold ✓), 1 of 3 done, the Up now card moved on
    await u.click(screen.getByRole('link', { name: /Back to my trail/ }));
    expect(await screen.findByText('1 of 3 done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Chemistry, 6:30–7:15/ })).toHaveAttribute(
      'data-state',
      'done',
    );
    expect(screen.queryByRole('button', { name: /Start Chemistry/ })).not.toBeInTheDocument();
    // English (4:15) is still waiting as a catch-up; Physics is next
    const card = screen.getByRole('heading', { level: 2, name: 'English' }).closest('.upnow') as HTMLElement;
    expect(within(card).getByText(/Next:.*Physics at 8:30/)).toBeInTheDocument();
    cleanup();

    // the next chemistry slot (Saturday) picks che-matter-2
    renderAt('2026-11-07T10:20', `/lesson/2026-11-07/${SAT_CHEM}`);
    expect(await screen.findByRole('heading', { level: 1, name: che2.title })).toBeInTheDocument();
    // che-matter-2 has a warm-up: it counts under Watch
    expect(currentStep()).toMatch(/Watch/);
    expect(screen.getByRole('heading', { level: 2, name: /Warm-up/ })).toBeInTheDocument();
  });

  it('the sample physics lesson can be completed start to finish, warm-up first', async () => {
    const u = user();
    renderAt('2026-11-02T17:40', `/lesson/2026-11-02/${MON_PHYS}`);
    expect(await screen.findByRole('heading', { level: 1, name: phy1.title })).toBeInTheDocument();
    for (const card of phy1.warmup ?? []) {
      await u.click(screen.getByRole('button', { name: /Tap to see the answer/ }));
      expect(screen.getByText(card.back)).toBeInTheDocument();
      await u.click(btn('Not yet 🤔'));
    }
    expect(screen.getByText(/Warm-up done!/)).toBeInTheDocument();
    await u.click(btn(/Next: watch the video/));
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));
    for (let i = 0; i < phy1.cards.length; i++)
      await u.click(btn(i < phy1.cards.length - 1 ? /Next card/ : /Next: try it/));
    await answerAll(u, phy1.practice.length);
    await u.click(await screen.findByRole('button', { name: /Done ✅/ }));
    // two right, one not quite → the correction report lists it
    await answerAll(u, 2);
    await answerAll(u, 1, false);
    await screen.findByRole('heading', { level: 2, name: /Your Lesson Check/ });
    expect(screen.queryByTestId('confetti')).not.toBeInTheDocument();
    expect(screen.getByText(/Let’s fix these together 🛠️/)).toBeInTheDocument();
    await u.click(btn(/Next: my stars/));
    // 2/3 = 67% → no check star; finish + checkpoints
    expect(screen.getByRole('heading', { level: 3, name: 'You earned 2 stars!' })).toBeInTheDocument();
    await waitFor(async () => expect((await getLessonProgress(phy1.id))?.status).toBe('done'));
    const warm = await listAttempts({ lessonId: phy1.id, source: 'warmup' });
    expect(warm.map((a) => a.score)).toEqual((phy1.warmup ?? []).map(() => 0));
  });

  it('the correction report jumps back into the video and offers a similar question when one exists', async () => {
    const u = user();
    renderAt('2026-11-02T17:40', `/lesson/2026-11-02/${MON_PHYS}`);
    await screen.findByRole('heading', { level: 1, name: phy1.title });
    for (let i = 0; i < (phy1.warmup ?? []).length; i++) {
      await u.click(screen.getByRole('button', { name: /Tap to see the answer/ }));
      await u.click(btn('I knew it 👍'));
    }
    await u.click(btn(/Next: watch the video/));
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));
    for (let i = 0; i < phy1.cards.length; i++)
      await u.click(btn(i < phy1.cards.length - 1 ? /Next card/ : /Next: try it/));
    await answerAll(u, phy1.practice.length);
    await u.click(await screen.findByRole('button', { name: /Done ✅/ }));
    await answerAll(u, phy1.check.length, false);
    await screen.findByRole('heading', { level: 2, name: /Your Lesson Check/ });

    const withRef = phy1.check.find((q) => q.videoRef)!;
    const report = screen.getByRole('region', { name: /Let’s fix these together/ });
    const rows = within(report).getAllByRole('listitem');
    const row = rows.find((r) => r.textContent?.includes(withRef.prompt.slice(0, 20)))!;
    await u.click(within(row).getByRole('button', { name: /Watch this bit again/ }));
    const seek = JSON.parse(screen.getByTestId('video').getAttribute('data-seek') ?? 'null') as {
      scene?: number;
      at?: number;
    };
    expect(seek.scene).toBe(withRef.videoRef?.scene);
    expect(seek.at).toBe(withRef.videoRef?.at);
    await u.click(btn('Back to my results ↩'));

    // phy-light-1-c2 has a bank variant (phy-light-1-q4) → "Try a similar one"
    const similar = within(screen.getByRole('region', { name: /Let’s fix these together/ })).getAllByRole(
      'button',
      {
        name: /Try a similar one/,
      },
    );
    expect(similar.length).toBeGreaterThan(0);
    await u.click(similar[0]!);
    expect(screen.getByRole('heading', { level: 2, name: /Try a similar one/ })).toBeInTheDocument();
    await u.click(btn('stub: answer right'));
    expect(await screen.findByRole('heading', { level: 2, name: /Your Lesson Check/ })).toBeInTheDocument();
  });

  it('reloading mid-lesson resumes at the same step with the answers intact', async () => {
    const u = user();
    const path = `/lesson/2026-11-06/${FRI_CHEM}`;
    const first = renderAt('2026-11-06T18:40', path);
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));
    await u.click(btn(/Next card/));
    await u.click(btn(/Next card/));
    expect(screen.getByRole('heading', { level: 3, name: che1.cards[2]!.title })).toBeInTheDocument();
    await waitFor(async () =>
      expect((await getLessonProgress(che1.id))?.data).toMatchObject({ cardIndex: 2 }),
    );
    first.unmount();

    renderAt('2026-11-06T18:40', path);
    expect(await screen.findByRole('heading', { level: 3, name: che1.cards[2]!.title })).toBeInTheDocument();
    expect(currentStep()).toMatch(/Learn/);
    // forward to Try, answer one, reload again
    for (let i = 2; i < che1.cards.length; i++)
      await u.click(btn(i < che1.cards.length - 1 ? /Next card/ : /Next: try it/));
    await answerAll(u, 1);
    expect(await screen.findByText(che1.practice[1]!.prompt)).toBeInTheDocument();
    await waitFor(async () =>
      expect((await getLessonProgress(che1.id))?.data).toMatchObject({ practiceDone: 1 }),
    );
    cleanup();

    renderAt('2026-11-06T18:40', path);
    expect(await screen.findByText(che1.practice[1]!.prompt)).toBeInTheDocument();
    const saved = (await getLessonProgress(che1.id))?.data as { answers: Record<string, unknown> };
    expect(saved.answers[che1.practice[0]!.id]).toEqual({ type: 'self_check', text: 'answer 1' });
    // Back still reaches the cards and the video (watched, so Next is open)
    await u.click(btn(/Back/));
    expect(currentStep()).toMatch(/Learn/);
  });

  it('two not-quite answers in practice still let her go on', async () => {
    const u = user();
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));
    for (let i = 0; i < che1.cards.length; i++)
      await u.click(btn(i < che1.cards.length - 1 ? /Next card/ : /Next: try it/));
    await answerAll(u, 2, false);
    expect(await screen.findByText(che1.practice[2]!.prompt)).toBeInTheDocument();
    await answerAll(u, che1.practice.length - 2, false);
    expect(await screen.findByText(che1.notebook)).toBeInTheDocument();
  });

  it('"Watch this bit again" from practice jumps to the video moment and returns to the same question', async () => {
    const u = user();
    const q = che1.practice.find((x) => x.videoRef)!;
    const before = che1.practice.indexOf(q);
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    await finishVideo(u);
    await u.click(btn(/Next: learn cards/));
    for (let i = 0; i < che1.cards.length; i++)
      await u.click(btn(i < che1.cards.length - 1 ? /Next card/ : /Next: try it/));
    await answerAll(u, before);
    expect(await screen.findByText(q.prompt)).toBeInTheDocument();
    await u.click(btn('stub: watch again'));
    expect(screen.getByRole('heading', { level: 2, name: /Watch that bit again/ })).toBeInTheDocument();
    expect(screen.getByTestId('video')).toHaveAttribute('data-which', q.videoRef!.video);
    expect(JSON.parse(screen.getByTestId('video').getAttribute('data-seek')!)).toMatchObject({
      scene: q.videoRef!.scene,
    });
    await u.click(btn('Back to my question ↩'));
    expect(screen.getByText(q.prompt)).toBeVisible();
    expect(currentStep()).toMatch(/Try/);
  });

  it('an unavailable video skips to the cards with a friendly note', async () => {
    const u = user();
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    await screen.findByTestId('video');
    await u.click(btn('stub: no video'));
    expect(
      await screen.findByText('Video not available right now — let’s learn with cards! 🃏'),
    ).toBeInTheDocument();
    expect(currentStep()).toMatch(/Learn/);
    expect(screen.getByRole('heading', { level: 3, name: che1.cards[0]!.title })).toBeInTheDocument();
  });

  it('homework first (§5.3): 30 min on a 50-minute slot → timer → the mini lesson (watch + 3 questions)', async () => {
    const u = user();
    const fri = original.timetable.days.fri.map((s, i) =>
      i === FRI_CHEM ? { ...s, kind: 'homework_lesson' as const, end: '19:20' } : s,
    );
    useContent.setState({
      bundle: {
        ...original,
        timetable: { ...original.timetable, days: { ...original.timetable.days, fri } },
      },
    });
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: /Do you have school homework for Chemistry today\?/,
      }),
    ).toBeInTheDocument();
    expect(btn(/No homework/)).toBeInTheDocument();
    expect(btn(/15 min/)).toBeInTheDocument();
    expect(btn(/45 min/)).toBeInTheDocument();
    await u.click(btn(/30 min/));
    expect(screen.getByRole('progressbar', { name: 'Homework time' })).toBeInTheDocument();
    expect(screen.getByText(/About 0 of 30 minutes/)).toBeInTheDocument();
    await u.click(btn(/I’ve finished my homework ✅/));

    const steps = screen.getByRole('list', { name: 'Lesson steps' });
    expect(
      within(steps)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Watch/),
        expect.stringMatching(/Check/),
        expect.stringMatching(/Stars/),
      ]),
    );
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    await finishVideo(u);
    await u.click(btn(/Next: Lesson Check/));
    await answerAll(u, 3);
    await screen.findByRole('heading', { level: 2, name: /Your Lesson Check/ });
    expect(screen.getByRole('progressbar', { name: 'Lesson Check score' })).toHaveAttribute(
      'aria-valuemax',
      '3',
    );
    await u.click(btn(/Next: my stars/));
    expect(screen.getByRole('heading', { level: 2, name: /Great work today!/ })).toBeInTheDocument();
    // a mini lesson logs the slot but keeps the lesson in the queue (the skipped part comes back)
    await waitFor(async () => expect((await getSlotLog('2026-11-06', FRI_CHEM))?.status).toBe('done'));
    expect((await getLessonProgress(che1.id))?.status).toBe('in_progress');
  });

  it('homework 30 min on the 45-minute slot leaves 15 minutes: Check only (§5.3)', async () => {
    const u = user();
    const fri = original.timetable.days.fri.map((s, i) =>
      i === FRI_CHEM ? { ...s, kind: 'homework_lesson' as const } : s,
    );
    useContent.setState({
      bundle: {
        ...original,
        timetable: { ...original.timetable, days: { ...original.timetable.days, fri } },
      },
    });
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    await u.click(await screen.findByRole('button', { name: /30 min/ }));
    await u.click(btn(/I’ve finished my homework ✅/));
    expect(currentStep()).toMatch(/Check/);
    expect(screen.queryByTestId('video')).not.toBeInTheDocument();
  });

  it('✕ asks "Leave the lesson?" with Keep going as the default', async () => {
    const u = user();
    renderAt('2026-11-06T18:40', `/lesson/2026-11-06/${FRI_CHEM}`);
    await screen.findByTestId('video');
    await u.click(btn('Leave the lesson'));
    const sheet = screen.getByRole('dialog', { name: 'Leave the lesson?' });
    expect(within(sheet).getByText('Your progress is saved.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Keep going' })).toHaveFocus();
    await u.click(within(sheet).getByRole('button', { name: 'Leave for now' }));
    expect(await screen.findByRole('heading', { level: 1, name: /Good evening/ })).toBeInTheDocument();
  });

  it.each([
    ['2026-11-07', '2', 'This one’s for another day 🙂', /opens on Saturday at 10:15/], // tomorrow: locked
    ['2026-11-05', '1', 'This one’s for another day 🙂', /That day is over/],
    ['2026-11-06', '99', 'This stone isn’t on your trail 🙂', /pick one/],
  ])('%s #%s → "%s"', async (date, slot, title, line) => {
    renderAt('2026-11-06T18:40', `/lesson/${date}/${slot}`);
    expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Back to my trail/ })).toBeInTheDocument();
  });

  it('revise / test / review slots say they are coming soon', () => {
    renderAt('2026-11-08T09:10', '/lesson/2026-11-08/0');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Coming in the next part of your adventure 🛠️' }),
    ).toBeInTheDocument();
  });

  it('a subject with no lessons left asks a grown-up for the next chapter', async () => {
    useContent.setState({
      bundle: {
        ...original,
        chapters: original.chapters.map((c) =>
          c.subject === 'physics' ? { ...c, status: 'draft' as const } : c,
        ),
      },
    });
    renderAt('2026-11-02T17:40', `/lesson/2026-11-02/${MON_PHYS}`);
    expect(
      await screen.findByRole('heading', {
        level: 2,
        name: 'No new Physics lessons are ready yet — ask a grown-up to add the next chapter 📚',
      }),
    ).toBeInTheDocument();
  });
});

describe('Today with done slots (slotLog)', () => {
  it('shows done stones, "N of M done", and moves the Up now card on', async () => {
    await setSlotStatus('2026-11-02', MON_PHYS, 'done', 1);
    await addStars(4, 1);
    renderAt('2026-11-02T17:40', '/');
    expect(await screen.findByText('1 of 4 done')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Physics, 5:30–6:15/ })).toHaveAttribute('data-state', 'done');
    // Physics was "up now"; it's done, so the card moves on (Maths is still waiting as a catch-up)
    expect(screen.queryByRole('button', { name: /^Start Physics/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Maths' })).toBeInTheDocument();
    expect(screen.getByText(/1 done, 3 to go/)).toBeInTheDocument();
    expect(screen.getByText('⭐ 4')).toBeInTheDocument();
    // a done stone is not a catch-up; tapping it says so kindly
    await userEvent.setup().click(screen.getByRole('button', { name: /^Physics, 5:30–6:15/ }));
    expect(screen.getByRole('dialog', { name: 'Physics is done! ✅' })).toBeInTheDocument();
  });

  it('addStars adds in one go and refuses a negative number', async () => {
    expect((await addStars(2, 1)).stars).toBe(2);
    expect((await addStars(3, 2)).stars).toBe(5);
    await expect(addStars(-1)).rejects.toThrow(RangeError);
  });
});
