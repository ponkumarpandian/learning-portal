/**
 * Which video a lesson plays (SPEC §7.1, §7.6) — pure, so the fallback rules are unit-tested.
 *
 *  primary   → the primary video if playable, else the lesson's explainer.
 *  alternate → ("Explain it another way 🔄") the alternate if playable, else the explainer again at 0.75×.
 *  playable  → explainer: the explainer exists · youtube: a real id (not REPLACE_ME) and online ·
 *              mp4: the file is bundled under content/media.
 * Nothing playable → [] and the lesson goes straight to the cards (never an error screen).
 */
import {
  REPLACE_ME,
  getExplainer,
  type ContentBundle,
  type Explainer,
  type Lesson,
  type Question,
  type Video,
} from '@/content';

type YoutubeVideo = Extract<Video, { kind: 'youtube' }>;
type Mp4Video = Extract<Video, { kind: 'mp4' }>;

export type PlaySource =
  | { key: string; kind: 'explainer'; explainer: Explainer; speed: number }
  | { key: string; kind: 'youtube'; video: YoutubeVideo }
  | { key: string; kind: 'mp4'; video: Mp4Video; url: string };

export interface SourceEnv {
  online: boolean;
  mediaUrl: (path: string) => string | undefined;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function toSource(
  v: Video,
  b: Pick<ContentBundle, 'explainers'>,
  env: SourceEnv,
  speed = 1,
): PlaySource | undefined {
  if (v.kind === 'explainer') {
    const explainer = getExplainer(b, v.explainerId);
    return explainer
      ? { key: `explainer:${explainer.id}@${speed}`, kind: 'explainer', explainer, speed }
      : undefined;
  }
  if (v.kind === 'youtube') {
    if (v.youtubeId === REPLACE_ME || !YT_ID.test(v.youtubeId) || !env.online) return undefined;
    return { key: `youtube:${v.youtubeId}`, kind: 'youtube', video: v };
  }
  const url = env.mediaUrl(v.src);
  return url ? { key: `mp4:${v.src}`, kind: 'mp4', video: v, url } : undefined;
}

/** Playable sources in the order to try them (a runtime failure moves on to the next one). */
export function planSources(
  lesson: Pick<Lesson, 'videos'>,
  b: Pick<ContentBundle, 'explainers'>,
  which: 'primary' | 'alternate',
  env: SourceEnv,
): PlaySource[] {
  const primary = lesson.videos.find((v) => v.role === 'primary');
  const alternate = lesson.videos.find((v) => v.role === 'alternate');
  const explainers = [...lesson.videos]
    .filter((v) => v.kind === 'explainer')
    .sort((a, c) => (a.role === 'primary' ? -1 : 0) - (c.role === 'primary' ? -1 : 0));
  const out: (PlaySource | undefined)[] =
    which === 'alternate'
      ? [alternate && toSource(alternate, b, env), ...explainers.map((v) => toSource(v, b, env, 0.75))]
      : [primary && toSource(primary, b, env), ...explainers.map((v) => toSource(v, b, env))];
  const seen = new Set<string>();
  return out.filter((s): s is PlaySource => {
    if (!s || seen.has(s.key)) return false;
    seen.add(s.key);
    return true;
  });
}

/** Any question by id: an explainer's own questions first, then every chapter question. */
export function findQuestion(
  b: Pick<ContentBundle, 'explainers' | 'chapters'>,
  id: string,
  prefer?: Pick<Explainer, 'questions'>,
): Question | undefined {
  const own = prefer?.questions.find((q) => q.id === id);
  if (own) return own;
  for (const e of b.explainers) {
    const q = e.questions.find((x) => x.id === id);
    if (q) return q;
  }
  for (const c of b.chapters) {
    const q =
      c.questionBank.find((x) => x.id === id) ??
      c.lessons.flatMap((l) => [...l.practice, ...l.check]).find((x) => x.id === id);
    if (q) return q;
  }
  return undefined;
}

/** navigator.onLine, treating "unknown" as online. */
export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false;

/** §7.6: what the kid reads when no video can play (the lesson goes on with cards). */
export const VIDEO_UNAVAILABLE = 'Video not available right now — let’s learn with cards! 🃏';
