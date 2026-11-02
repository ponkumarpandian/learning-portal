import { db, DB_NAME } from './db';
import {
  DEFAULT_REWARDS,
  DEFAULT_SETTINGS,
  addAttempt,
  clearLookMirror,
  clearSlotStatus,
  deleteOverride,
  getLessonProgress,
  getMastery,
  getOverride,
  getRewards,
  getSettings,
  getSlotLog,
  getTest,
  listAttempts,
  listLessonProgress,
  listMastery,
  listOverrides,
  listSlotLogForDate,
  listTests,
  putMastery,
  putOverride,
  readLookMirror,
  saveLessonProgress,
  saveRewards,
  saveSettings,
  saveTest,
  setSlotStatus,
  slotLogId,
} from './repos';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('db', () => {
  it('uses the spec database name and all §14 tables', () => {
    expect(db.name).toBe(DB_NAME);
    expect(DB_NAME).toBe('avantikas-adventure');
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      [
        'attempts',
        'contentOverrides',
        'lessonProgress',
        'mastery',
        'rewards',
        'settings',
        'slotLog',
        'tests',
      ].sort(),
    );
  });
});

describe('settings repo', () => {
  it('returns defaults when nothing is stored', async () => {
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS).toMatchObject({
      world: 'meadow',
      night: 'auto',
      textSize: 'big',
      sound: false,
      vibration: false,
      narration: true,
      mascotName: 'Tara',
      onboarded: false,
    });
  });

  it('merges patches and persists them', async () => {
    const a = await saveSettings({ world: 'ocean' });
    expect(a.world).toBe('ocean');
    const b = await saveSettings({ textSize: 'bigger', pinHash: 'h1' });
    expect(b).toMatchObject({ world: 'ocean', textSize: 'bigger', pinHash: 'h1', mascotName: 'Tara' });
    expect(await getSettings()).toEqual(b);
    expect(b).not.toHaveProperty('id');
  });

  it('removes an optional key when patched with undefined', async () => {
    await saveSettings({ pinHash: 'h1' });
    const s = await saveSettings({ pinHash: undefined });
    expect(s).not.toHaveProperty('pinHash');
    expect(await getSettings()).not.toHaveProperty('pinHash');
  });

  it('fills newly added defaults for older stored records', async () => {
    await db.settings.put({ id: 'app', world: 'space' } as never);
    expect(await getSettings()).toEqual({ ...DEFAULT_SETTINGS, world: 'space' });
  });

  it('keeps the first-paint look mirror in step with Dexie, and clears it', async () => {
    clearLookMirror();
    expect(readLookMirror()).toEqual({});
    await saveSettings({ world: 'ocean', night: 'night', textSize: 'bigger', sound: true });
    expect(readLookMirror()).toEqual({ world: 'ocean', night: 'night', textSize: 'bigger' });
    // a stale mirror (e.g. after a wipe + import) is corrected by the next read from Dexie
    await db.settings.put({ ...DEFAULT_SETTINGS, id: 'app' });
    await getSettings();
    expect(readLookMirror()).toEqual({ world: 'meadow', night: 'auto', textSize: 'big' });
    clearLookMirror();
    expect(readLookMirror()).toEqual({});
  });

  it('does not let callers mutate the defaults', () => {
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true);
  });
});

describe('contentOverrides repo', () => {
  it('supports create, read, update, list and delete', async () => {
    expect(await listOverrides()).toEqual([]);
    const a = await putOverride({
      id: 'chapter:light',
      target: 'chapter',
      targetId: 'light',
      data: { x: 1 },
      updatedAt: 200,
    });
    await putOverride({ id: 'timetable', target: 'timetable', data: { y: 2 }, updatedAt: 100 });
    expect(await getOverride('chapter:light')).toEqual(a);
    expect((await listOverrides()).map((o) => o.id)).toEqual(['timetable', 'chapter:light']);

    await putOverride({ id: 'timetable', target: 'timetable', data: { y: 3 }, updatedAt: 300 });
    const list = await listOverrides();
    expect(list).toHaveLength(2);
    expect(list.map((o) => o.id)).toEqual(['chapter:light', 'timetable']);
    expect(list[1]?.data).toEqual({ y: 3 });

    await deleteOverride('chapter:light');
    expect(await getOverride('chapter:light')).toBeUndefined();
    expect(await listOverrides()).toHaveLength(1);
  });

  it('stamps updatedAt when omitted', async () => {
    const before = Date.now();
    const o = await putOverride({ id: 'subjects', target: 'subjects', data: [] });
    expect(o.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('slotLog repo', () => {
  it('round-trips slot statuses per date', async () => {
    expect(slotLogId('2026-11-02', 3)).toBe('2026-11-02#3');
    await setSlotStatus('2026-11-02', 3, 'in_progress', 10);
    await setSlotStatus('2026-11-02', 1, 'done', 11);
    await setSlotStatus('2026-11-03', 0, 'skipped', 12);
    const done = await setSlotStatus('2026-11-02', 3, 'done', 13);

    expect(await getSlotLog('2026-11-02', 3)).toEqual(done);
    expect(done).toEqual({
      id: '2026-11-02#3',
      date: '2026-11-02',
      slotIndex: 3,
      status: 'done',
      updatedAt: 13,
    });
    expect((await listSlotLogForDate('2026-11-02')).map((r) => r.slotIndex)).toEqual([1, 3]);

    await clearSlotStatus('2026-11-02', 1);
    expect(await getSlotLog('2026-11-02', 1)).toBeUndefined();
  });
});

describe('lessonProgress repo', () => {
  it('creates, then updates keeping startedAt', async () => {
    const a = await saveLessonProgress('phy-light-1', { step: 1 }, 100);
    expect(a).toEqual({
      lessonId: 'phy-light-1',
      status: 'in_progress',
      step: 1,
      startedAt: 100,
      updatedAt: 100,
    });
    const b = await saveLessonProgress('phy-light-1', { step: 4, data: { answers: [1] } }, 200);
    expect(b).toMatchObject({ step: 4, startedAt: 100, updatedAt: 200, data: { answers: [1] } });
    const c = await saveLessonProgress('phy-light-1', { status: 'done', completedAt: 300 }, 300);
    expect(c).toMatchObject({ status: 'done', step: 4, startedAt: 100 });
    expect(await getLessonProgress('phy-light-1')).toEqual(c);
    expect(await listLessonProgress()).toHaveLength(1);
  });
});

describe('attempts repo', () => {
  it('appends with auto ids and filters', async () => {
    const a = await addAttempt({
      source: 'checkpoint',
      lessonId: 'L1',
      questionId: 'q1',
      response: 'a',
      score: 1,
      at: 1,
    });
    await addAttempt({
      source: 'practice',
      lessonId: 'L1',
      questionId: 'q2',
      response: 2,
      score: 0.5,
      at: 2,
    });
    await addAttempt({
      source: 'weekly_test',
      testId: '2026-W45-sat',
      questionId: 'q3',
      response: null,
      score: 0,
      at: 3,
    });
    expect(typeof a.id).toBe('number');

    expect((await listAttempts()).map((r) => r.questionId)).toEqual(['q1', 'q2', 'q3']);
    expect((await listAttempts({ lessonId: 'L1' })).map((r) => r.questionId)).toEqual(['q1', 'q2']);
    expect((await listAttempts({ lessonId: 'L1', source: 'practice' })).map((r) => r.questionId)).toEqual([
      'q2',
    ]);
    expect((await listAttempts({ testId: '2026-W45-sat' })).map((r) => r.questionId)).toEqual(['q3']);
    expect((await listAttempts({ since: 2 })).map((r) => r.questionId)).toEqual(['q2', 'q3']);
  });

  it('stamps `at` and rejects out-of-range scores', async () => {
    const before = Date.now();
    const a = await addAttempt({ source: 'daily', questionId: 'q', response: 1, score: 0 });
    expect(a.at).toBeGreaterThanOrEqual(before);
    await expect(addAttempt({ source: 'daily', questionId: 'q', response: 1, score: 1.5 })).rejects.toThrow(
      RangeError,
    );
    await expect(
      addAttempt({ source: 'daily', questionId: 'q', response: 1, score: Number.NaN }),
    ).rejects.toThrow(RangeError);
  });
});

describe('tests repo', () => {
  it('round-trips a test record', async () => {
    const t = await saveTest({
      testId: '2026-W45-sat',
      status: 'in_progress',
      seed: '2026-W45-sat',
      sections: [{ sectionId: 'A', questionIds: ['q1'], status: 'active' }],
      answers: { q1: 'b' },
      remainingSeconds: 540,
      updatedAt: 5,
    });
    expect(await getTest('2026-W45-sat')).toEqual(t);
    await saveTest({ ...t, remainingSeconds: 500, updatedAt: undefined });
    expect((await getTest('2026-W45-sat'))?.remainingSeconds).toBe(500);
    expect(await listTests()).toHaveLength(1);
  });
});

describe('mastery repo', () => {
  it('round-trips a mastery record', async () => {
    const m = await putMastery({
      lessonId: 'L1',
      value: 0.7,
      history: [{ at: 1, score: 0.7, source: 'lesson_check' }],
      updatedAt: 9,
    });
    expect(await getMastery('L1')).toEqual(m);
    expect(await listMastery()).toEqual([m]);
    const n = await putMastery({ lessonId: 'L2', value: 0, history: [] });
    expect(n.updatedAt).toBeGreaterThan(0);
  });
});

describe('rewards repo', () => {
  it('returns defaults, then merges and persists', async () => {
    expect(await getRewards()).toEqual(DEFAULT_REWARDS);
    const r = await saveRewards({ stars: 12, badges: ['first-lesson'] }, 50);
    expect(r).toMatchObject({ stars: 12, level: 1, badges: ['first-lesson'], streak: 0, shields: 0 });
    expect(await getRewards()).toEqual(r);
    expect((await db.rewards.get('me'))?.updatedAt).toBe(50);
    expect(DEFAULT_REWARDS.badges).toEqual([]);
  });
});
