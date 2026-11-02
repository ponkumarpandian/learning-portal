/** Lesson video (SPEC §7): the explainer / YouTube / MP4 player with the app's own controls. */
export { LessonVideo, type LessonVideoProps } from './LessonVideo';
export { YouTubePlayer, type YouTubePlayerProps } from './YouTubePlayer';
export { Mp4Player, type Mp4PlayerProps } from './Mp4Player';
export {
  VideoControls,
  VideoTrack,
  type TrackMarker,
  type TrackSegment,
  type VideoControlsProps,
} from './VideoControls';
export { CuratedFrame, type MediaAdapter } from './CuratedFrame';
export { VIDEO_UNAVAILABLE, findQuestion, planSources, type PlaySource } from './sources';
export { ExplainerPlayer, type ExplainerPlayerProps } from '@/explainers/ExplainerPlayer';
