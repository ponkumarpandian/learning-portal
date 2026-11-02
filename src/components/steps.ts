export interface CaterpillarStep {
  emoji: string;
  label: string;
}

/** Lesson steps (§15.2): 🎬 Watch · 🃏 Learn · ✋ Try · ✅ Check · ⭐ Stars. */
export const LESSON_STEPS: readonly CaterpillarStep[] = [
  { emoji: '🎬', label: 'Watch' },
  { emoji: '🃏', label: 'Learn' },
  { emoji: '✋', label: 'Try' },
  { emoji: '✅', label: 'Check' },
  { emoji: '⭐', label: 'Stars' },
];
