/**
 * The 13 badges from §10 (app rules, not parent content). Phase 3 adds the unlock rules
 * (engine/rewards.ts); this list only gives each sticker its look.
 */
export interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  /** tokens.css colour token for the sticker disc */
  colour: string;
}

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-lesson', name: 'First Lesson', emoji: '🌱', colour: 'biology' },
  { id: 'first-100', name: 'First 100%', emoji: '💯', colour: 'english' },
  { id: 'streak-5', name: '5-Day Streak', emoji: '🔥', colour: 'fun' },
  { id: 'streak-14', name: '2-Week Streak', emoji: '🚀', colour: 'physics' },
  { id: 'full-week', name: 'Full Week Done', emoji: '🗓️', colour: 'geography' },
  { id: 'test-taker', name: 'Test Taker', emoji: '📝', colour: 'maths' },
  { id: 'subject-star', name: 'Subject Star', emoji: '🌟', colour: 'gold' },
  { id: 'mistake-fixer', name: 'Mistake Fixer', emoji: '🛠️', colour: 'chemistry' },
  { id: 'video-detective', name: 'Video Detective', emoji: '🔎', colour: 'history' },
  { id: 'chapter-complete', name: 'Chapter Complete', emoji: '📗', colour: 'biology' },
  { id: 'all-chapters', name: 'All Chapters', emoji: '🏔️', colour: 'maths' },
  { id: 'revision-hero', name: 'Revision Hero', emoji: '🦸', colour: 'dance' },
  { id: 'mock-master', name: 'Mock Exam Master', emoji: '🎓', colour: 'physics' },
];
