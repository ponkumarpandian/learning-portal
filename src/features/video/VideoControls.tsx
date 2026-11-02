import { SegmentedControl } from '@/components/SegmentedControl';
import './video.css';

export interface TrackSegment {
  name: string;
  /** seconds from the start */
  start: number;
  duration: number;
  /** a ⭐ checkpoint question at the end of this segment */
  checkpoint?: boolean;
  checkpointDone?: boolean;
}

/** ⭐ markers inside one long segment (curated videos), seconds from the start. */
export interface TrackMarker {
  at: number;
  done: boolean;
}

export interface VideoControlsProps {
  playing: boolean;
  onPlayPause: () => void;
  onBack10: () => void;
  speed: number;
  onSpeed: (speed: number) => void;
  captions: boolean;
  onCaptions: (on: boolean) => void;
  fullscreen: boolean;
  onFullscreen: () => void;
  /** seconds from the start */
  position: number;
  segments: TrackSegment[];
  current: number;
  onSeekSegment?: (index: number) => void;
  markers?: TrackMarker[];
  /** while a checkpoint question is open */
  disabled?: boolean;
}

const SPEED_OPTIONS = [
  { value: '0.75', label: '0.75×', icon: '🐢' },
  { value: '1', label: '1×' },
  { value: '1.25', label: '1.25×', icon: '🐇' },
] as const;
type SpeedValue = (typeof SPEED_OPTIONS)[number]['value'];

const toSpeedValue = (n: number): SpeedValue => (n < 0.9 ? '0.75' : n > 1.1 ? '1.25' : '1');

/** The scene track (§7.2: named chapters + ⭐ checkpoint markers). Tap a part to jump to it. */
export function VideoTrack({
  position,
  segments,
  current,
  onSeekSegment,
  markers,
  disabled,
}: Pick<VideoControlsProps, 'position' | 'segments' | 'current' | 'onSeekSegment' | 'markers' | 'disabled'>) {
  const now = segments[current];
  return (
    <div>
      <div className="vtrack" role="group" aria-label="Parts of the video">
        {segments.map((s, i) => {
          const fill =
            i < current
              ? 1
              : i > current
                ? 0
                : Math.max(0, Math.min(1, (position - s.start) / Math.max(1, s.duration)));
          return (
            <button
              key={i}
              type="button"
              className={i === current ? 'vseg is-current' : 'vseg'}
              style={{ flexGrow: Math.max(1, s.duration) }}
              aria-label={`Part ${i + 1}: ${s.name}${s.checkpoint ? ', with a star question' : ''}`}
              aria-current={i === current ? 'step' : undefined}
              disabled={disabled || !onSeekSegment}
              onClick={() => onSeekSegment?.(i)}
            >
              <span className="vseg-bar" aria-hidden="true">
                <span className="vseg-fill" style={{ width: `${fill * 100}%` }} />
              </span>
              {s.checkpoint && (
                <span className={s.checkpointDone ? 'vseg-star is-done' : 'vseg-star'} aria-hidden="true">
                  ⭐
                </span>
              )}
              {markers?.map((m) => (
                <span
                  key={m.at}
                  className={m.done ? 'vseg-star vmarker is-done' : 'vseg-star vmarker'}
                  style={{ left: `${(100 * (m.at - s.start)) / Math.max(1, s.duration)}%`, right: 'auto' }}
                  aria-hidden="true"
                >
                  ⭐
                </span>
              ))}
            </button>
          );
        })}
      </div>
      {now && (
        <p className="vnow">
          <span>
            <b>{now.name}</b>
          </span>
          {segments.length > 1 && (
            <span>
              Part {current + 1} of {segments.length}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * The app's own video controls (§7.2), shared by the explainer, YouTube and MP4 players:
 * back 10 s, a ≥56px play/pause, captions and full screen (icon + word each), then speed.
 */
export function VideoControls(p: VideoControlsProps) {
  return (
    <>
      <VideoTrack {...p} />
      <div className="vctrl">
        <button type="button" className="vbtn" onClick={p.onBack10} disabled={p.disabled}>
          <span className="vbtn-ico" aria-hidden="true">
            ⏪
          </span>
          Back 10 s
        </button>
        <button
          type="button"
          className="vplay"
          onClick={p.onPlayPause}
          disabled={p.disabled}
          aria-label={p.playing ? 'Pause' : 'Play'}
        >
          <span aria-hidden="true">{p.playing ? '⏸' : '▶'}</span>
        </button>
        <button
          type="button"
          className="vbtn"
          aria-pressed={p.captions}
          onClick={() => p.onCaptions(!p.captions)}
        >
          <span className="vbtn-ico" aria-hidden="true">
            💬
          </span>
          Captions
        </button>
        <button type="button" className="vbtn" aria-pressed={p.fullscreen} onClick={p.onFullscreen}>
          <span className="vbtn-ico" aria-hidden="true">
            {p.fullscreen ? '↙️' : '⛶'}
          </span>
          {p.fullscreen ? 'Smaller' : 'Full screen'}
        </button>
      </div>
      <div className="vspeed">
        <SegmentedControl
          label="Speed"
          options={SPEED_OPTIONS}
          value={toSpeedValue(p.speed)}
          onChange={(v) => p.onSpeed(Number(v))}
        />
      </div>
    </>
  );
}
