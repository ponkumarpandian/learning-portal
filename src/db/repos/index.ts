/**
 * The ONLY storage API for feature code (SPEC §14 "Build for this possibility now").
 * Features import from `@/db/repos`, never from `@/db/db` or Dexie directly.
 *
 * TODO(Phase 6): backup export/import (one JSON file of every table) and "wipe" live here,
 * so Export → wipe → Import restores exactly the same state. The wipe must also call
 * clearLookMirror() (settings.ts), the only non-Dexie copy of any state.
 */
export * from './settings';
export * from './contentOverrides';
export * from './slotLog';
export * from './lessonProgress';
export * from './attempts';
export * from './tests';
export * from './mastery';
export * from './rewards';
