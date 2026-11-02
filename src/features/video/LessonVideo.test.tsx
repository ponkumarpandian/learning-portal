import { act, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'framer-motion';
import { approvedChapters, loadContent, type Lesson, type Video } from '@/content';
import { silentNarrator } from '@/explainers/speech';
import { LessonVideo } from './LessonVideo';
import { VIDEO_UNAVAILABLE, findQuestion, planSources } from './sources';
import { YouTubePlayer } from './YouTubePlayer';

const bundle = loadContent();
const chapter = approvedChapters(bundle).find((c) => c.id === 'che-matter')!;
const real = chapter.lessons[0]!;
const explainerId = (real.videos.find((v) => v.kind === 'explainer') as Extract<Video, { kind: 'explainer' }>)
  .explainerId;
const explainer = bundle.explainers.find((e) => e.id === explainerId)!;

const yt = (youtubeId: string, role: 'primary' | 'alternate' = 'primary'): Video => ({
  role,
  kind: 'youtube',
  youtubeId,
  title: 'A clip',
  start: 0,
  end: 60,
  checkpoints: [],
});
const lessonWith = (videos: Video[]): Lesson => ({ ...real, videos });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false;
});

describe('planSources', () => {
  const env = { online: true, mediaUrl: () => undefined };

  it('primary: the real lesson plays its explainer; alternate (REPLACE_ME) replays it at 0.75×', () => {
    expect(planSources(real, bundle, 'primary', env).map((s) => s.key)).toEqual([
      `explainer:${explainerId}@1`,
    ]);
    const alt = planSources(real, bundle, 'alternate', env);
    expect(alt).toHaveLength(1);
    expect(alt[0]).toMatchObject({ kind: 'explainer', speed: 0.75 });
  });

  it('a real YouTube id plays first, but not offline', () => {
    const l = lessonWith([yt('dQw4w9WgXcQ'), { role: 'alternate', kind: 'explainer', explainerId }]);
    expect(planSources(l, bundle, 'primary', env).map((s) => s.kind)).toEqual(['youtube', 'explainer']);
    expect(planSources(l, bundle, 'primary', { ...env, online: false }).map((s) => s.kind)).toEqual([
      'explainer',
    ]);
  });

  it('an MP4 plays only when the file is bundled', () => {
    const mp4: Video = {
      role: 'primary',
      kind: 'mp4',
      src: 'media/videos/x.mp4',
      title: 'x',
      checkpoints: [],
    };
    expect(planSources(lessonWith([mp4]), bundle, 'primary', env)).toEqual([]);
    expect(
      planSources(lessonWith([mp4]), bundle, 'primary', { ...env, mediaUrl: () => '/x.mp4' })[0],
    ).toMatchObject({
      kind: 'mp4',
      url: '/x.mp4',
    });
  });

  it('finds checkpoint questions in explainers and chapters', () => {
    expect(
      findQuestion(bundle, explainer.scenes.find((s) => s.checkpoint)!.checkpoint!.questionId),
    ).toBeDefined();
    expect(findQuestion(bundle, real.check[0]!.id)?.id).toBe(real.check[0]!.id);
    expect(findQuestion(bundle, 'nope')).toBeUndefined();
  });
});

describe('LessonVideo', () => {
  it('falls back to the explainer when the YouTube id is REPLACE_ME', () => {
    const onUnavailable = vi.fn();
    render(
      <LessonVideo
        lesson={lessonWith([yt('REPLACE_ME'), { role: 'alternate', kind: 'explainer', explainerId }])}
        subjectId="chemistry"
        narrator={silentNarrator}
        onWatched={() => {}}
        onUnavailable={onUnavailable}
      />,
    );
    expect(screen.getByRole('region', { name: `Video: ${explainer.title}` })).toBeInTheDocument();
    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('calls onUnavailable (and shows the friendly card) when nothing can play', () => {
    const onUnavailable = vi.fn();
    render(
      <LessonVideo
        lesson={lessonWith([yt('REPLACE_ME')])}
        subjectId="chemistry"
        narrator={silentNarrator}
        onWatched={() => {}}
        onUnavailable={onUnavailable}
      />,
    );
    expect(onUnavailable).toHaveBeenCalledTimes(1);
    expect(screen.getByText(VIDEO_UNAVAILABLE)).toBeInTheDocument();
  });

  it('"explain it another way" replays the explainer at 0.75×', () => {
    render(
      <LessonVideo
        lesson={real}
        subjectId="chemistry"
        narrator={silentNarrator}
        onWatched={() => {}}
        onUnavailable={() => {}}
      />,
    );
    act(() => screen.getByRole('button', { name: /explain it another way/ }).click());
    expect(screen.getByRole('radio', { name: /0\.75×/ })).toBeChecked();
    expect(screen.queryByRole('button', { name: /explain it another way/ })).not.toBeInTheDocument();
  });
});

describe('YouTubePlayer', () => {
  it('uses youtube-nocookie with rel=0, and falls back when the API fails', async () => {
    const created: { host?: string; playerVars?: Record<string, string | number> }[] = [];
    class FakePlayer {
      constructor(_el: HTMLElement, opts: { host?: string; playerVars?: Record<string, string | number> }) {
        created.push(opts);
      }
      destroy() {}
    }
    const { unmount } = render(
      <YouTubePlayer
        video={yt('dQw4w9WgXcQ') as Extract<Video, { kind: 'youtube' }>}
        subjectId="physics"
        onWatched={() => {}}
        onFail={() => {}}
        loadApi={() => Promise.resolve({ Player: FakePlayer as never })}
      />,
    );
    await act(async () => {});
    expect(created[0]?.host).toBe('https://www.youtube-nocookie.com');
    expect(created[0]?.playerVars).toMatchObject({
      rel: 0,
      enablejsapi: 1,
      playsinline: 1,
      cc_load_policy: 1,
    });
    unmount();

    const onFail = vi.fn();
    render(
      <YouTubePlayer
        video={yt('dQw4w9WgXcQ') as Extract<Video, { kind: 'youtube' }>}
        subjectId="physics"
        onWatched={() => {}}
        onFail={onFail}
        loadApi={() => Promise.reject(new Error('blocked'))}
      />,
    );
    await act(async () => {});
    expect(onFail).toHaveBeenCalled();
  });
});
