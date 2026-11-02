import {
  approvedChapters,
  getChapter,
  getSubject,
  loadContent,
  type Chapter,
  type ContentOverride,
  type Timetable,
} from './index';

const ov = (o: Partial<ContentOverride> & Pick<ContentOverride, 'target' | 'data'>): ContentOverride => ({
  id: o.id ?? `ov-${Math.random().toString(36).slice(2)}`,
  updatedAt: o.updatedAt ?? 1,
  ...o,
});

describe('loadContent (bundled)', () => {
  it('loads every content file with no warnings', () => {
    const b = loadContent();
    expect(b.warnings).toEqual([]);
    expect(b.subjects.map((s) => s.id)).toEqual([
      'maths',
      'physics',
      'chemistry',
      'biology',
      'english',
      'history',
      'geography',
    ]);
    expect(b.timetable.timezone).toBe('Asia/Kolkata');
    expect(b.timetable.days.mon).toHaveLength(9);
    expect(b.plan.chapterOrder.physics).toEqual(['phy-light']);
    expect(b.blueprint.sectionMarks).toBe(15);
    expect(b.chapters.map((c) => c.id)).toContain('phy-light');
    // Every explainer file on disk is loaded (imports add more, so don't pin the list).
    const explainerFiles = Object.keys(import.meta.glob('/content/explainers/*.json'));
    expect(b.explainers).toHaveLength(explainerFiles.length);
    expect(b.explainers.map((e) => e.id)).toEqual(
      expect.arrayContaining(['light-straight-line', 'states-of-matter']),
    );
  });

  it('keeps the spec text exactly (emoji and curly quotes)', () => {
    const b = loadContent();
    expect(getSubject(b, 'history')).toEqual({
      id: 'history',
      name: 'History / Civics',
      emoji: '🏛️',
      colour: '#b45309',
      sessionsPerWeek: 3,
    });
    expect(b.timetable.days.mon[5]?.label).toBe('Bharatanatyam class');
    expect(getChapter(b, 'phy-light')?.questionBank.length).toBeGreaterThanOrEqual(10);
  });

  it('getSubject returns undefined for unknown ids', () => {
    expect(getSubject(loadContent(), 'french')).toBeUndefined();
  });
});

describe('loadContent with parent overrides', () => {
  const base = () => structuredClone(getChapter(loadContent(), 'phy-light')!) as Chapter;

  it('replaces a chapter by id', () => {
    const edited = { ...base(), title: 'Light (edited by Amma)' };
    const b = loadContent([ov({ target: 'chapter', data: edited })]);
    expect(b.warnings).toEqual([]);
    expect(getChapter(b, 'phy-light')?.title).toBe('Light (edited by Amma)');
    expect(b.chapters.filter((c) => c.id === 'phy-light')).toHaveLength(1);
  });

  it('applies overrides oldest-first so the latest edit wins', () => {
    const b = loadContent([
      ov({ target: 'chapter', data: { ...base(), title: 'Newest' }, updatedAt: 30 }),
      ov({ target: 'chapter', data: { ...base(), title: 'Oldest' }, updatedAt: 10 }),
    ]);
    expect(getChapter(b, 'phy-light')?.title).toBe('Newest');
  });

  it('ignores an invalid override and reports it in warnings', () => {
    const bad = { ...base(), lessons: 'oops' };
    const b = loadContent([ov({ id: 'bad-1', target: 'chapter', data: bad })]);
    expect(getChapter(b, 'phy-light')?.title).toBe('Light');
    expect(b.warnings).toHaveLength(1);
    expect(b.warnings[0]).toMatch(/Parent change "bad-1" \(chapter\) was ignored — lessons/);
  });

  it('never throws for garbage overrides', () => {
    const garbage = [
      null,
      42,
      { target: 'nope', data: {} },
      { target: 'plan', data: null },
    ] as unknown as ContentOverride[];
    expect(() => loadContent(garbage)).not.toThrow();
    expect(loadContent(garbage).warnings).toHaveLength(4);
  });

  it('replaces the whole timetable', () => {
    const tt = structuredClone(loadContent().timetable) as Timetable;
    tt.days.mon[3] = { ...tt.days.mon[3]!, label: 'Physics time' };
    const b = loadContent([ov({ target: 'timetable', data: tt })]);
    expect(b.warnings).toEqual([]);
    expect(b.timetable.days.mon[3]?.label).toBe('Physics time');
  });

  it('rejects an override that would break the kid view (unknown subject, overlap)', () => {
    const tt = structuredClone(loadContent().timetable) as Timetable;
    tt.days.tue[0] = { ...tt.days.tue[0]!, end: '16:30' }; // overlaps the 16:15 slot
    const b = loadContent([ov({ id: 'tt-1', target: 'timetable', data: tt })]);
    expect(b.timetable.days.tue[0]?.end).toBe('16:15');
    expect(b.warnings[0]).toMatch(/"tt-1" \(timetable\) was ignored — .*overlaps/);

    const subjects = loadContent().subjects.filter((s) => s.id !== 'physics');
    const b2 = loadContent([ov({ target: 'subjects', data: subjects })]);
    expect(b2.subjects).toHaveLength(7);
    expect(b2.warnings[0]).toMatch(/unknown subject "physics"/);
  });

  it('adds a new chapter; drafts are hidden from the kid', () => {
    const draft = { ...base(), id: 'phy-new', status: 'draft' as const, lessons: [], questionBank: [] };
    const fresh = {
      ...base(),
      id: 'phy-new',
      status: 'draft' as const,
      lessons: base().lessons.map((l) => ({
        ...l,
        id: 'phy-new-1',
        videos: l.videos.filter((v) => v.kind === 'explainer'),
        practice: [],
        check: l.check.map((q) => ({ ...q, id: `new-${q.id}` })),
      })),
      questionBank: [],
    };
    const bInvalid = loadContent([ov({ target: 'chapter', data: draft })]);
    expect(getChapter(bInvalid, 'phy-new')).toBeUndefined(); // no lessons → schema error

    const b = loadContent([ov({ target: 'chapter', data: fresh })]);
    expect(b.warnings).toEqual([]);
    expect(getChapter(b, 'phy-new')?.status).toBe('draft');
    const approved = approvedChapters(b).map((c) => c.id);
    expect(approved).toContain('phy-light');
    expect(approved).not.toContain('phy-new');
  });

  it('replaces a plan as a whole object', () => {
    const plan = { ...structuredClone(loadContent().plan), revisionDays: 3 };
    expect(loadContent([ov({ target: 'plan', data: plan })]).plan.revisionDays).toBe(3);
  });
});
