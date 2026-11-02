import { useEffect, useRef, useState } from 'react';
import type { Video } from '@/content';
import type { AskOutcome } from '@/features/questions';
import { CuratedFrame, type MediaAdapter } from './CuratedFrame';
import { YT_ENDED, loadYouTubeApi, type YTNamespace, type YTPlayer } from './youtubeApi';

type YoutubeVideo = Extract<Video, { kind: 'youtube' }>;

export interface YouTubePlayerProps {
  video: YoutubeVideo;
  subjectId: string;
  onWatched: (info: { checkpointsAllCorrect: boolean }) => void;
  /** the API did not load in time, the video errored, or the device is offline */
  onFail: () => void;
  onCheckpointOutcome?: (o: AskOutcome) => void;
  seekTo?: { at?: number; nonce: number };
  endAction?: { label: string; onClick: () => void };
  /** injectable for tests */
  loadApi?: (timeoutMs: number) => Promise<YTNamespace>;
  timeoutMs?: number;
}

function adapterFor(p: YTPlayer): MediaAdapter {
  return {
    play: () => p.playVideo(),
    pause: () => p.pauseVideo(),
    seek: (t) => p.seekTo(t, true),
    time: () => p.getCurrentTime() || 0,
    duration: () => p.getDuration() || 0,
    setRate: (r) => p.setPlaybackRate(r),
    setCaptions: (on) => (on ? p.loadModule?.('captions') : p.unloadModule?.('captions')),
    ended: () => p.getPlayerState() === YT_ENDED,
  };
}

/**
 * A parent-approved YouTube clip on youtube-nocookie.com (§7.6, §12): IFrame API, YouTube's own
 * controls hidden, our controls on top, a shield over the iframe (no taps reach YouTube's links),
 * and our end screen covering the player at the clip's end.
 */
export function YouTubePlayer({
  video,
  subjectId,
  onWatched,
  onFail,
  onCheckpointOutcome,
  seekTo,
  endAction,
  loadApi = loadYouTubeApi,
  timeoutMs = 8000,
}: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [adapter, setAdapter] = useState<MediaAdapter | null>(null);
  const failRef = useRef(onFail);
  useEffect(() => {
    failRef.current = onFail;
  }, [onFail]);

  const { youtubeId, start = 0, end } = video;
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let player: YTPlayer | undefined;
    let ready = false;
    let gone = false;
    const fail = () => {
      if (!gone) failRef.current();
    };
    const slot = document.createElement('div');
    slot.className = 'yt-host';
    host.appendChild(slot);
    const timer = setTimeout(() => !ready && fail(), timeoutMs);
    loadApi(timeoutMs)
      .then((YT) => {
        if (gone) return;
        const vars: Record<string, string | number> = {
          enablejsapi: 1,
          rel: 0,
          playsinline: 1,
          start,
          cc_load_policy: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          origin: window.location.origin,
        };
        if (end !== undefined) vars.end = end;
        player = new YT.Player(slot, {
          host: 'https://www.youtube-nocookie.com',
          videoId: youtubeId,
          width: '100%',
          height: '100%',
          playerVars: vars,
          events: {
            onReady: (e) => {
              ready = true;
              clearTimeout(timer);
              if (!gone) setAdapter(adapterFor(e.target));
            },
            onError: () => fail(),
          },
        });
      })
      .catch(() => fail());
    return () => {
      gone = true;
      clearTimeout(timer);
      try {
        player?.destroy();
      } catch {
        /* already gone */
      }
      host.replaceChildren();
      setAdapter(null);
    };
  }, [youtubeId, start, end, loadApi, timeoutMs]);

  return (
    <CuratedFrame
      title={video.title}
      subjectId={subjectId}
      clip={{ start, end }}
      checkpoints={video.checkpoints}
      adapter={adapter}
      media={<div ref={hostRef} className="yt-host" />}
      onWatched={onWatched}
      onCheckpointOutcome={onCheckpointOutcome}
      seekTo={seekTo}
      endAction={endAction}
    />
  );
}
