import { useMemo, useRef, useState } from 'react';
import type { Video } from '@/content';
import { mediaUrl, type AskOutcome } from '@/features/questions';
import { CuratedFrame, type MediaAdapter } from './CuratedFrame';

type Mp4Video = Extract<Video, { kind: 'mp4' }>;

export interface Mp4PlayerProps {
  video: Mp4Video;
  /** the bundled URL (mediaUrl(video.src)) */
  url: string;
  subjectId: string;
  onWatched: (info: { checkpointsAllCorrect: boolean }) => void;
  onFail: () => void;
  onCheckpointOutcome?: (o: AskOutcome) => void;
  seekTo?: { at?: number; nonce: number };
  endAction?: { label: string; onClick: () => void };
}

/**
 * A local MP4 from content/media/videos (§7.6): works offline, same controls and checkpoints.
 * Captions come from a sibling .vtt file when the parent adds one (same name as the video).
 */
export function Mp4Player({
  video,
  url,
  subjectId,
  onWatched,
  onFail,
  onCheckpointOutcome,
  seekTo,
  endAction,
}: Mp4PlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [adapter, setAdapter] = useState<MediaAdapter | null>(null);
  const vtt = useMemo(() => mediaUrl(video.src.replace(/\.[a-z0-9]+$/i, '.vtt')), [video.src]);

  const onReady = () => {
    const el = ref.current;
    if (!el) return;
    setAdapter({
      play: () => void el.play().catch(() => {}),
      pause: () => el.pause(),
      seek: (t) => {
        el.currentTime = Math.max(0, t);
      },
      time: () => el.currentTime,
      duration: () => (Number.isFinite(el.duration) ? el.duration : 0),
      setRate: (r) => {
        el.playbackRate = r;
      },
      setCaptions: (on) => {
        const track = el.textTracks[0];
        if (track) track.mode = on ? 'showing' : 'hidden';
      },
      ended: () => el.ended,
    });
  };

  return (
    <CuratedFrame
      title={video.title}
      subjectId={subjectId}
      clip={{ start: 0 }}
      checkpoints={video.checkpoints}
      adapter={adapter}
      media={
        <video ref={ref} src={url} playsInline preload="metadata" onLoadedMetadata={onReady} onError={onFail}>
          {vtt && <track kind="captions" src={vtt} srcLang="en" label="English" default />}
        </video>
      }
      onWatched={onWatched}
      onCheckpointOutcome={onCheckpointOutcome}
      seekTo={seekTo}
      endAction={endAction}
    />
  );
}
