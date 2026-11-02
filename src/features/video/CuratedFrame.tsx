/**
 * The shared frame for curated videos (YouTube / MP4, SPEC §7.6): the app's controls drive the media
 * through a small adapter; ⭐ checkpoints pause at `at`, "Watch that part again" jumps to `rewindTo`;
 * at the clip's end the app's own end screen covers the player (so YouTube's suggestions never show).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChunkyButton } from '@/components/ChunkyButton';
import { subjectVars } from '@/components/colours';
import { getSubject, type Checkpoint, type Question } from '@/content';
import type { AskOutcome } from '@/features/questions';
import { useBundle } from '@/state/content';
import { CheckpointPanel } from './CheckpointPanel';
import { findQuestion } from './sources';
import { useFullscreen } from './useFullscreen';
import { VideoControls } from './VideoControls';
import './video.css';

export interface MediaAdapter {
  play(): void;
  pause(): void;
  /** absolute media seconds */
  seek(t: number): void;
  time(): number;
  /** total media seconds (0 when unknown) */
  duration(): number;
  setRate(rate: number): void;
  setCaptions(on: boolean): void;
  ended(): boolean;
}

export interface CuratedFrameProps {
  title: string;
  subjectId: string;
  clip: { start: number; end?: number };
  checkpoints: readonly Checkpoint[];
  /** null until the media is ready */
  adapter: MediaAdapter | null;
  media: ReactNode;
  onWatched: (info: { checkpointsAllCorrect: boolean }) => void;
  onCheckpointOutcome?: (o: AskOutcome) => void;
  seekTo?: { at?: number; nonce: number };
  endAction?: { label: string; onClick: () => void };
}

type Status = 'ready' | 'playing' | 'paused' | 'checkpoint' | 'ended';

const cpKey = (c: Checkpoint) => `${c.questionId}@${c.at}`;

export function CuratedFrame({
  title,
  subjectId,
  clip,
  checkpoints,
  adapter,
  media,
  onWatched,
  onCheckpointOutcome,
  seekTo,
  endAction,
}: CuratedFrameProps) {
  const bundle = useBundle();
  const vars = subjectVars(getSubject(bundle, subjectId));
  const [status, setStatus] = useState<Status>('ready');
  const [pos, setPos] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [captions, setCaptions] = useState(true);
  const [answers, setAnswers] = useState<Record<string, AskOutcome>>({});
  const [asking, setAsking] = useState<Checkpoint | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const { ref: frameRef, full, pseudo, toggle: toggleFull, exit: exitFull } = useFullscreen<HTMLDivElement>();
  // a checkpoint whose question is missing is skipped, so it never blocks her
  const sorted = useMemo(
    () => checkpoints.filter((c) => findQuestion(bundle, c.questionId)).sort((a, b) => a.at - b.at),
    [checkpoints, bundle],
  );
  const total = Math.max(1, (clip.end ?? (adapter?.duration() || clip.start + 60)) - clip.start);

  const firstUnanswered = useCallback(
    (done: Record<string, AskOutcome>) => sorted.find((c) => !done[cpKey(c)]),
    [sorted],
  );

  const finish = useCallback(
    (done: Record<string, AskOutcome>) => {
      adapter?.pause();
      const missing = firstUnanswered(done);
      if (missing) {
        setAsking(missing);
        setSweeping(true);
        setStatus('checkpoint');
        return;
      }
      setStatus('ended');
      setSweeping(false);
      const list = sorted.map((c) => done[cpKey(c)]).filter((o): o is AskOutcome => o !== undefined);
      onWatched({ checkpointsAllCorrect: list.every((o) => o.result.correct && !o.revealed) });
    },
    [adapter, firstUnanswered, onWatched, sorted],
  );

  // follow the media clock while playing
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    if (status !== 'playing' || !adapter) return;
    const id = setInterval(() => {
      const t = adapter.time();
      setPos(Math.max(0, t - clip.start));
      if (adapter.ended() || (clip.end !== undefined && t >= clip.end - 0.2)) {
        finish(answersRef.current);
        return;
      }
      const due = sorted.find((c) => !answersRef.current[cpKey(c)] && t >= c.at && t < c.at + 3);
      if (due) {
        adapter.pause();
        setAsking(due);
        setStatus('checkpoint');
      }
    }, 250);
    return () => clearInterval(id);
  }, [status, adapter, clip.start, clip.end, sorted, finish]);

  const play = useCallback(() => {
    if (!adapter) return;
    if (status === 'ended') adapter.seek(clip.start);
    adapter.play();
    setStatus('playing');
  }, [adapter, status, clip.start]);
  const pause = useCallback(() => {
    adapter?.pause();
    setStatus('paused');
  }, [adapter]);

  // "Watch this bit again" from a question or the correction report
  const lastNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!seekTo || !adapter || seekTo.nonce === lastNonce.current) return;
    lastNonce.current = seekTo.nonce;
    adapter.seek(Math.max(clip.start, seekTo.at ?? clip.start));
    adapter.play();
    setStatus('playing');
  }, [seekTo, adapter, clip.start]);

  const question: Question | undefined = asking ? findQuestion(bundle, asking.questionId) : undefined;

  const onDone = (o: AskOutcome) => {
    if (!asking) return;
    const next = { ...answers, [cpKey(asking)]: o };
    answersRef.current = next;
    setAnswers(next);
    setAsking(null);
    onCheckpointOutcome?.(o);
    if (sweeping) return finish(next);
    adapter?.play();
    setStatus('playing');
  };
  const watchAgain = () => {
    if (!asking || !adapter) return;
    adapter.seek(asking.rewindTo);
    adapter.play();
    setAsking(null);
    setSweeping(false);
    setStatus('playing');
  };

  // the checkpoint's feedback sheet lives in <body>: leave full screen so she can see it
  const atCheckpoint = status === 'checkpoint';
  useEffect(() => {
    if (atCheckpoint) exitFull();
  }, [atCheckpoint, exitFull]);

  const playing = status === 'playing';
  return (
    <div className="vplayer" style={vars}>
      <div
        ref={frameRef}
        className={`vframe${pseudo ? ' is-full' : ''}`}
        role="region"
        aria-label={`Video: ${title}`}
      >
        <div className="vstage-wrap">
          <div
            className="vstage is-video"
            style={status === 'checkpoint' ? { visibility: 'hidden', height: 0 } : undefined}
          >
            {media}
            <button
              type="button"
              className="vshield"
              aria-label={playing ? 'Pause' : 'Play'}
              onClick={() => (playing ? pause() : play())}
              disabled={!adapter || status === 'checkpoint' || status === 'ended'}
            />
          </div>
          {status === 'checkpoint' && question && (
            <CheckpointPanel
              question={question}
              subjectId={subjectId}
              onDone={onDone}
              onWatchAgain={watchAgain}
            />
          )}
          {status === 'ready' && (
            <div className="voverlay">
              <button
                type="button"
                className="vbig-play"
                onClick={play}
                disabled={!adapter}
                aria-label={`Play: ${title}`}
              >
                <span aria-hidden="true">▶</span>
              </button>
              <p className="vbig-label">{adapter ? title : 'Getting the video ready…'}</p>
            </div>
          )}
          {status === 'ended' && (
            <div className="voverlay is-end">
              <p className="vend-stars" aria-hidden="true">
                🎬
              </p>
              <h3>All watched — well done!</h3>
              {endAction && (
                <ChunkyButton arrow onClick={endAction.onClick}>
                  {endAction.label}
                </ChunkyButton>
              )}
              <ChunkyButton variant="soft" onClick={play}>
                Watch again 🔁
              </ChunkyButton>
            </div>
          )}
        </div>
        <VideoControls
          playing={playing}
          onPlayPause={() => (playing ? pause() : play())}
          onBack10={() => adapter?.seek(Math.max(clip.start, adapter.time() - 10))}
          speed={speed}
          onSpeed={(s) => {
            setSpeed(s);
            adapter?.setRate(s);
          }}
          captions={captions}
          onCaptions={(on) => {
            setCaptions(on);
            adapter?.setCaptions(on);
          }}
          fullscreen={full}
          onFullscreen={toggleFull}
          position={pos}
          segments={[{ name: title, start: 0, duration: total }]}
          current={0}
          markers={sorted.map((c) => ({ at: c.at - clip.start, done: answers[cpKey(c)] !== undefined }))}
          disabled={status === 'checkpoint' || !adapter}
        />
      </div>
    </div>
  );
}
