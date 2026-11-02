/**
 * The Concept Explainer player (SPEC §7.2–7.4): a video-like sequence of scenes drawn by the §7.5
 * visuals, narrated sentence by sentence (or captions only), with the app's own controls and ⭐
 * checkpoint questions that pause at the end of their scene.
 */
import { useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChunkyButton } from '@/components/ChunkyButton';
import { subjectVars } from '@/components/colours';
import { getSubject, type Explainer, type Question } from '@/content';
import type { AskOutcome } from '@/features/questions';
import { CheckpointPanel } from '@/features/video/CheckpointPanel';
import { findQuestion as findAnyQuestion } from '@/features/video/sources';
import { useFullscreen } from '@/features/video/useFullscreen';
import { VideoControls, type TrackSegment } from '@/features/video/VideoControls';
import { useBundle } from '@/state/content';
import { useSettings } from '@/state/settingsStore';
import { browserNarrator, type Narrator } from './speech';
import { locate } from './timeline';
import { useExplainerTimeline } from './useExplainerTimeline';
import { VISUALS } from './visuals';
import '@/features/video/video.css';

export interface ExplainerEndInfo {
  /** every checkpoint answered right without the answer being shown */
  checkpointsAllCorrect: boolean;
  outcomes: AskOutcome[];
}

export interface ExplainerPlayerProps {
  explainer: Explainer;
  /** defaults to explainer.subject */
  subjectId?: string;
  narrator?: Narrator;
  initialSpeed?: number;
  autoPlay?: boolean;
  /** jump to a scene (0-based) and/or seconds; a new nonce re-applies it */
  seekTo?: { scene?: number; at?: number; nonce: number };
  /** reached the end with every checkpoint answered */
  onEnded?: (info: ExplainerEndInfo) => void;
  onCheckpointOutcome?: (o: AskOutcome) => void;
  /** the go button on the end screen (e.g. "Next: learn cards") */
  endAction?: { label: string; onClick: () => void };
}

export function ExplainerPlayer({
  explainer,
  subjectId,
  narrator: injected,
  initialSpeed = 1,
  autoPlay = false,
  seekTo,
  onEnded,
  onCheckpointOutcome,
  endAction,
}: ExplainerPlayerProps) {
  const bundle = useBundle();
  const subject = subjectId ?? explainer.subject;
  const vars = subjectVars(getSubject(bundle, subject));
  const reduced = useReducedMotion() ?? false;
  const narrationOn = useSettings((s) => s.settings.narration);
  const narrator = useMemo(() => injected ?? browserNarrator(), [injected]);
  const scenes = explainer.scenes;
  const tl = useExplainerTimeline(scenes, { narrator, narrationOn, initialSpeed, autoPlay });
  const { state, timeline } = tl;
  const [captions, setCaptions] = useState(true);
  const [outcomes, setOutcomes] = useState<Record<number, AskOutcome>>({});
  const { ref: frameRef, full, pseudo, toggle: toggleFull, exit: exitFull } = useFullscreen<HTMLDivElement>();

  const scene = scenes[state.scene];
  const Visual = scene ? VISUALS[scene.visual] : undefined;

  // seekTo from "Watch this bit again"
  const { seek, play } = tl;
  const lastNonce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!seekTo || seekTo.nonce === lastNonce.current) return;
    lastNonce.current = seekTo.nonce;
    if (seekTo.scene !== undefined) seek(seekTo.scene, seekTo.at ?? 0);
    else if (seekTo.at !== undefined) {
      const where = locate(timeline, seekTo.at);
      seek(where.scene, where.at);
    }
    play();
  }, [seekTo, seek, play, timeline]);

  // reached the end
  const ended = state.status === 'ended';
  const endedFor = useRef(false);
  const checkpointScenes = useMemo(
    () => scenes.map((s, i) => (s.checkpoint ? i : -1)).filter((i) => i >= 0),
    [scenes],
  );
  useEffect(() => {
    if (!ended) {
      endedFor.current = false;
      return;
    }
    if (endedFor.current) return;
    endedFor.current = true;
    const list = checkpointScenes.map((i) => outcomes[i]).filter((o): o is AskOutcome => o !== undefined);
    onEnded?.({
      checkpointsAllCorrect:
        list.length === checkpointScenes.length && list.every((o) => o.result.correct && !o.revealed),
      outcomes: list,
    });
  }, [ended, outcomes, checkpointScenes, onEnded]);

  const asking = state.asking;
  const askScene = asking !== null ? scenes[asking] : undefined;
  const question: Question | undefined = askScene?.checkpoint
    ? findAnyQuestion(bundle, askScene.checkpoint.questionId, explainer)
    : undefined;
  // a checkpoint whose question is missing never blocks her
  const { answered } = tl;
  useEffect(() => {
    if (asking !== null && !question) answered();
  }, [asking, question, answered]);

  const segments: TrackSegment[] = timeline.scenes.map((s) => ({
    name: s.name,
    start: s.start,
    duration: s.duration,
    checkpoint: s.checkpoint,
    checkpointDone: outcomes[s.index] !== undefined,
  }));
  const stars = Object.values(outcomes).filter((o) => o.result.correct).length;

  const onDone = (o: AskOutcome) => {
    if (asking !== null) setOutcomes((prev) => ({ ...prev, [asking]: o }));
    onCheckpointOutcome?.(o);
    answered();
  };

  // the checkpoint's feedback sheet lives in <body>: leave full screen so she can see it
  const atCheckpoint = state.status === 'checkpoint';
  useEffect(() => {
    if (atCheckpoint) exitFull();
  }, [atCheckpoint, exitFull]);

  const playing = state.status === 'playing';
  const frameClass = `vframe${pseudo ? ' is-full' : ''}`;

  return (
    <div className="vplayer" style={vars}>
      <div ref={frameRef} className={frameClass} aria-label={`Video: ${explainer.title}`} role="region">
        <div className="vstage-wrap">
          {state.status === 'checkpoint' && question ? (
            <CheckpointPanel
              question={question}
              subjectId={subject}
              onDone={onDone}
              onWatchAgain={tl.watchAgain}
            />
          ) : (
            <div className="vstage">
              {scene && Visual ? (
                <Visual key={scene.visual} props={tl.props} subjectId={subject} reduced={reduced} />
              ) : (
                <div className="vsoon">
                  <b aria-hidden="true">🎨</b>
                  <span>The picture for this part is coming soon — listen and read along!</span>
                </div>
              )}
            </div>
          )}

          {state.status === 'ready' && (
            <div className="voverlay">
              <button
                type="button"
                className="vbig-play"
                onClick={tl.play}
                aria-label={`Play: ${explainer.title}`}
              >
                <span aria-hidden="true">▶</span>
              </button>
              <p className="vbig-label">{explainer.title}</p>
            </div>
          )}

          {ended && (
            <div className="voverlay is-end">
              <p className="vend-stars" aria-hidden="true">
                {checkpointScenes.length ? '⭐'.repeat(Math.max(1, stars)) : '🎬'}
              </p>
              <h3>All watched — well done!</h3>
              {checkpointScenes.length > 0 && (
                <p>You answered all {checkpointScenes.length} star questions.</p>
              )}
              {endAction && (
                <ChunkyButton arrow onClick={endAction.onClick}>
                  {endAction.label}
                </ChunkyButton>
              )}
              <ChunkyButton variant="soft" onClick={tl.restart}>
                Watch again 🔁
              </ChunkyButton>
            </div>
          )}
        </div>

        <div
          className={captions ? 'vcap' : 'vcap is-off'}
          aria-live={state.narrated ? 'off' : 'polite'}
          aria-label="Captions"
          role="status"
        >
          {captions && state.status !== 'checkpoint' && (
            <>
              <span className="vcap-icon" aria-hidden="true">
                {state.narrated ? '🔊' : '💬'}
              </span>
              <span>{tl.caption}</span>
            </>
          )}
        </div>

        <VideoControls
          playing={playing}
          onPlayPause={tl.toggle}
          onBack10={() => tl.back(10)}
          speed={state.speed}
          onSpeed={tl.setSpeed}
          captions={captions}
          onCaptions={setCaptions}
          fullscreen={full}
          onFullscreen={toggleFull}
          position={tl.position}
          segments={segments}
          current={state.scene}
          onSeekSegment={(i) => tl.seek(i, 0)}
          disabled={state.status === 'checkpoint'}
        />
      </div>
    </div>
  );
}
