/**
 * Dexie (IndexedDB) schema — SPEC §14.
 *
 * Feature code must NOT import `db` directly: all storage goes through `src/db/repos/*`,
 * so a sync layer (Phase 8) can be slotted in behind the repos without touching features.
 *
 * Only indexed fields appear in `stores()`; adding non-indexed fields to a record type
 * needs no version bump. Changing indexes or primary keys needs `this.version(n + 1)`.
 */
import Dexie, { type EntityTable } from 'dexie';
import type { ContentOverride } from '@/content/schemas';
import type { Settings } from './repos/settings';

export const DB_NAME = 'avantikas-adventure';

/* ---------- record types ---------- */

export type SlotStatus = 'done' | 'skipped' | 'in_progress';

/** One timetable slot on one IST date. `id` is `${date}#${slotIndex}`. */
export interface SlotLogRecord {
  id: string;
  /** IST `YYYY-MM-DD` */
  date: string;
  /** Index into that weekday's slot list in the timetable */
  slotIndex: number;
  status: SlotStatus;
  updatedAt: number;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'done';

export interface LessonProgressRecord {
  lessonId: string;
  status: LessonStatus;
  /** Current step index inside the lesson flow (§6), for resume */
  step: number;
  /** Step-specific autosave payload (answers so far, video position, …) */
  data?: unknown;
  startedAt: number;
  updatedAt: number;
  completedAt?: number;
}

export type AttemptSource =
  | 'checkpoint'
  | 'warmup'
  | 'practice'
  | 'lesson_check'
  | 'daily'
  | 'weekly_test'
  | 'practice_test'
  | 'fixit'
  | 'mock';

export interface AttemptRecord {
  /** Auto-increment */
  id: number;
  source: AttemptSource;
  lessonId?: string;
  /** Set for test-type sources (`weekly_test`, `practice_test`, `mock`) */
  testId?: string;
  questionId: string;
  response: unknown;
  /** 0..1 (partial marks allowed) */
  score: number;
  /** epoch ms */
  at: number;
}

export type TestStatus = 'not_started' | 'in_progress' | 'submitted' | 'missed';

export interface TestSectionState {
  sectionId: string;
  questionIds: string[];
  status: 'pending' | 'active' | 'submitted';
}

export interface TestRecord {
  /** e.g. `2026-W45-sat`, `2026-W45-sat-practice`, `mock-1` */
  testId: string;
  status: TestStatus;
  /** Seed used by the test builder, so the same test can be rebuilt */
  seed?: string;
  sections: TestSectionState[];
  /** questionId → response */
  answers: Record<string, unknown>;
  /** Remaining seconds of the active section (timer resume) */
  remainingSeconds: number;
  /** Filled at submit time; shape owned by Phase 4 */
  results?: unknown;
  startedAt?: number;
  submittedAt?: number;
  updatedAt: number;
}

export interface MasteryHistoryEntry {
  at: number;
  score: number;
  source: AttemptSource;
}

export interface MasteryRecord {
  lessonId: string;
  /** 0..1 */
  value: number;
  history: MasteryHistoryEntry[];
  updatedAt: number;
}

export interface RewardsRecord {
  id: 'me';
  stars: number;
  level: number;
  badges: string[];
  /** Current streak in days */
  streak: number;
  bestStreak: number;
  /** IST date key of the last day that counted towards the streak */
  lastStreakDate?: string;
  shields: number;
  updatedAt: number;
}

export type SettingsRecord = { id: 'app' } & Settings;

export type ContentOverrideRecord = ContentOverride;

/* ---------- database ---------- */

export class AdventureDB extends Dexie {
  // `declare` (not `!`) so class-field semantics don't overwrite the tables Dexie installs.
  declare slotLog: EntityTable<SlotLogRecord, 'id'>;
  declare lessonProgress: EntityTable<LessonProgressRecord, 'lessonId'>;
  declare attempts: EntityTable<AttemptRecord, 'id'>;
  declare tests: EntityTable<TestRecord, 'testId'>;
  declare mastery: EntityTable<MasteryRecord, 'lessonId'>;
  declare rewards: EntityTable<RewardsRecord, 'id'>;
  declare settings: EntityTable<SettingsRecord, 'id'>;
  declare contentOverrides: EntityTable<ContentOverrideRecord, 'id'>;

  constructor(name: string = DB_NAME) {
    super(name);
    this.version(1).stores({
      slotLog: 'id, date',
      lessonProgress: 'lessonId, status, updatedAt',
      attempts: '++id, source, lessonId, testId, questionId, at',
      tests: 'testId, status',
      mastery: 'lessonId',
      rewards: 'id',
      settings: 'id',
      contentOverrides: 'id, target',
    });
  }
}

export const db = new AdventureDB();
