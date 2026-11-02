/**
 * The "Watch" step of a lesson (SPEC §6 step 2, §7): plays the lesson's primary video — a Concept
 * Explainer, a parent-approved YouTube clip or a local MP4 — with the same controls and ⭐ checkpoints,
 * and falls back quietly: an unplayable YouTube/MP4 → the explainer; nothing at all → onUnavailable()
 * (the lesson goes on with cards). "Explain it another way 🔄" plays the alternate video, or the
 * explainer again at 0.75×.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { ChunkyButton } from '@/components/ChunkyButton';
import type { Lesson } from '@/content';
import { ExplainerPlayer } from '@/explainers/ExplainerPlayer';
import type { Narrator } from '@/explainers/speech';
import { mediaUrl, type AskOutcome } from '@/features/questions';
import { useBundle } from '@/state/content';
import { Mp4Player } from './Mp4Player';
import { VIDEO_UNAVAILABLE, isOnline, planSources } from './sources';
import { YouTubePlayer } from './YouTubePlayer';
import './video.css';

export interface LessonVideoProps {
  lesson: Lesson;
  subjectId: string;
  /** "Explain it another way 🔄" switches to alternate (or replays the explainer at 0.75×) */
  which?: 'primary' | 'alternate';
  /** reached the end with all checkpoints answered */
  onWatched: (info: { checkpointsAllCorrect: boolean }) => void;
  /** no playable video at all → the lesson skips to cards */
  onUnavailable: () => void;
  /** "Watch this bit again" from questions / the correction report */
  seekTo?: { scene?: number; at?: number; nonce: number };
  /** so the lesson records attempts (source 'checkpoint') */
  onCheckpointOutcome?: (o: AskOutcome) => void;
  /** injectable for tests; default browserNarrator() */
  narrator?: Narrator;
  /** optional go button on the player's end screen (e.g. "Next: learn cards") */
  endAction?: { label: string; onClick: () => void };
}

export function LessonVideo({
  lesson,
  subjectId,
  which = 'primary',
  onWatched,
  onUnavailable,
  seekTo,
  onCheckpointOutcome,
  narrator,
  endAction,
}: LessonVideoProps) {
  const bundle = useBundle();
  const [mode, setMode] = useState(which);
  const [prevWhich, setPrevWhich] = useState(which);
  if (which !== prevWhich) {
    setPrevWhich(which);
    setMode(which);
  }
  const [failed, setFailed] = useState<ReadonlySet<string>>(new Set());
  const [online] = useState(isOnline);

  const plan = useMemo(
    () => planSources(lesson, bundle, mode, { online, mediaUrl }),
    [lesson, bundle, mode, online],
  );
  const source = plan.find((s) => !failed.has(s.key));
  const key = source?.key;

  useEffect(() => {
    if (!key) onUnavailable();
    // only when the outcome changes, not when the parent re-renders with a new callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const fail = useCallback(() => {
    if (key) setFailed((prev) => new Set(prev).add(key));
  }, [key]);

  const another =
    mode === 'primary' && planSources(lesson, bundle, 'alternate', { online, mediaUrl }).length > 0;

  if (!source) {
    return (
      <Card className="vunavailable" aria-live="polite">
        <b aria-hidden="true">🃏</b>
        <p>{VIDEO_UNAVAILABLE}</p>
      </Card>
    );
  }

  return (
    <div className="vplayer">
      {source.kind === 'explainer' && (
        <ExplainerPlayer
          key={source.key}
          explainer={source.explainer}
          subjectId={subjectId}
          narrator={narrator}
          initialSpeed={source.speed}
          autoPlay={mode === 'alternate'}
          seekTo={seekTo}
          onEnded={({ checkpointsAllCorrect }) => onWatched({ checkpointsAllCorrect })}
          onCheckpointOutcome={onCheckpointOutcome}
          endAction={endAction}
        />
      )}
      {source.kind === 'youtube' && (
        <YouTubePlayer
          key={source.key}
          video={source.video}
          subjectId={subjectId}
          onWatched={onWatched}
          onFail={fail}
          onCheckpointOutcome={onCheckpointOutcome}
          seekTo={seekTo}
          endAction={endAction}
        />
      )}
      {source.kind === 'mp4' && (
        <Mp4Player
          key={source.key}
          video={source.video}
          url={source.url}
          subjectId={subjectId}
          onWatched={onWatched}
          onFail={fail}
          onCheckpointOutcome={onCheckpointOutcome}
          seekTo={seekTo}
          endAction={endAction}
        />
      )}
      {another && (
        <ChunkyButton variant="soft" onClick={() => setMode('alternate')}>
          I didn’t get it — explain it another way 🔄
        </ChunkyButton>
      )}
    </div>
  );
}
