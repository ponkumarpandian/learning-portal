import {
  TZ,
  WEEKDAYS,
  createAppClock,
  defaultAllowFakeClock,
  fixedClock,
  fromWallTime,
  parseInstant,
  systemClock,
  zonedParts,
} from './clock';

const allow = () => true;
const deny = () => false;

describe('TZ', () => {
  it('is fixed to Asia/Kolkata', () => {
    expect(TZ).toBe('Asia/Kolkata');
  });
});

describe('zonedParts', () => {
  it('maps 2026-11-01T18:30:00Z to Monday 00:00 IST', () => {
    expect(zonedParts(new Date('2026-11-01T18:30:00Z'))).toEqual({
      dateKey: '2026-11-02',
      hhmm: '00:00',
      weekday: 'mon',
      hour: 0,
      minute: 0,
      year: 2026,
      month: 11,
      day: 2,
    });
  });

  it('one minute earlier is still Sunday 23:59 IST', () => {
    const p = zonedParts(new Date('2026-11-01T18:29:00Z'));
    expect(p.dateKey).toBe('2026-11-01');
    expect(p.hhmm).toBe('23:59');
    expect(p.weekday).toBe('sun');
  });

  it('crosses month and year boundaries in IST, not UTC', () => {
    const p = zonedParts(new Date('2026-12-31T18:30:00Z'));
    expect(p).toMatchObject({ dateKey: '2027-01-01', year: 2027, month: 1, day: 1, weekday: 'fri' });
  });

  it('maps every weekday of a known week (Mon 2 Nov – Sun 8 Nov 2026)', () => {
    const got = [2, 3, 4, 5, 6, 7, 8].map(
      (d) => zonedParts(new Date(`2026-11-0${d}T12:00:00+05:30`)).weekday,
    );
    expect(got).toEqual([...WEEKDAYS]);
  });

  it('pads hours and minutes', () => {
    expect(zonedParts(new Date('2026-11-02T03:35:00Z')).hhmm).toBe('09:05');
  });
});

describe('parseInstant', () => {
  it('treats offset-less strings as IST wall time', () => {
    expect(parseInstant('2026-11-02T16:20')?.toISOString()).toBe('2026-11-02T10:50:00.000Z');
    expect(parseInstant('2026-11-02T16:20:30')?.toISOString()).toBe('2026-11-02T10:50:30.000Z');
    expect(parseInstant('2026-11-02T16:20:30.250')?.toISOString()).toBe('2026-11-02T10:50:30.250Z');
  });

  it('treats a date alone as IST midnight', () => {
    expect(parseInstant('2026-11-02')?.toISOString()).toBe('2026-11-01T18:30:00.000Z');
  });

  it('honours explicit offsets', () => {
    expect(parseInstant('2026-11-01T18:30:00Z')?.toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(parseInstant('2026-11-02T00:00+05:30')?.toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(parseInstant('2026-11-02T00:00:00-0100')?.toISOString()).toBe('2026-11-02T01:00:00.000Z');
  });

  it('trims whitespace', () => {
    expect(parseInstant('  2026-11-02T16:20 ')?.toISOString()).toBe('2026-11-02T10:50:00.000Z');
  });

  it.each([
    '',
    'tomorrow',
    '2026-11-2',
    '2026-11-02 16:20',
    '16:20',
    '2026-11-02T16',
    '2026-02-31',
    '2026-02-31T10:00',
    '2026-13-01T10:00',
    '2026-11-02T25:00',
    '2026-11-02T16:61',
    '2026-11-02T25:00Z',
  ])('rejects %j', (s) => {
    expect(parseInstant(s)).toBeNull();
  });
});

describe('fromWallTime', () => {
  it('builds the instant for an IST date and time', () => {
    expect(fromWallTime('2026-11-03', '17:20').toISOString()).toBe('2026-11-03T11:50:00.000Z');
  });

  it('defaults to midnight', () => {
    expect(fromWallTime('2026-11-03').toISOString()).toBe('2026-11-02T18:30:00.000Z');
  });

  it('throws on invalid input', () => {
    expect(() => fromWallTime('2026-11-03', '24:30')).toThrow(RangeError);
  });
});

describe('systemClock', () => {
  it('returns the real current time', () => {
    const before = Date.now();
    const t = systemClock.now().getTime();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(Date.now());
  });
});

describe('fixedClock', () => {
  it('reads wall time as IST', () => {
    const c = fixedClock('2026-11-03T17:20');
    expect(zonedParts(c.now())).toMatchObject({ weekday: 'tue', hhmm: '17:20' });
  });

  it('accepts ISO instants', () => {
    expect(fixedClock('2026-11-01T18:30:00Z').now().toISOString()).toBe('2026-11-01T18:30:00.000Z');
  });

  it('never ticks and returns a fresh Date each call', () => {
    const c = fixedClock('2026-11-03T17:20');
    const a = c.now();
    a.setFullYear(2000);
    expect(c.now().toISOString()).toBe('2026-11-03T11:50:00.000Z');
    expect(c.now()).not.toBe(c.now());
  });

  it('throws on invalid input', () => {
    expect(() => fixedClock('nope')).toThrow(RangeError);
  });
});

describe('createAppClock', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('honours a valid ?now= wall time when allowed', () => {
    const c = createAppClock('?now=2026-11-02T16:20', allow);
    expect(c).not.toBe(systemClock);
    expect(zonedParts(c.now())).toMatchObject({ dateKey: '2026-11-02', hhmm: '16:20' });
  });

  it('works without the leading "?" and alongside other params', () => {
    const c = createAppClock('x=1&now=2026-11-07T10:30', allow);
    expect(zonedParts(c.now())).toMatchObject({ weekday: 'sat', hhmm: '10:30' });
  });

  it('accepts an encoded offset and an unencoded "+" (decoded as space)', () => {
    expect(createAppClock('?now=2026-11-02T00:00%2B05:30', allow).now().toISOString()).toBe(
      '2026-11-01T18:30:00.000Z',
    );
    expect(createAppClock('?now=2026-11-02T00:00+05:30', allow).now().toISOString()).toBe(
      '2026-11-01T18:30:00.000Z',
    );
  });

  it('accepts a Z instant', () => {
    expect(createAppClock('?now=2026-11-01T18:30:00Z', allow).now().toISOString()).toBe(
      '2026-11-01T18:30:00.000Z',
    );
  });

  it('falls back to the system clock for an invalid value', () => {
    expect(createAppClock('?now=garbage', allow)).toBe(systemClock);
    expect(createAppClock('?now=2026-02-31T10:00', allow)).toBe(systemClock);
  });

  it('falls back to the system clock when there is no ?now=', () => {
    expect(createAppClock('', allow)).toBe(systemClock);
    expect(createAppClock('?now=', allow)).toBe(systemClock);
    expect(createAppClock('?other=1', allow)).toBe(systemClock);
  });

  it('ignores ?now= when fake time is not allowed', () => {
    expect(createAppClock('?now=2026-11-02T16:20', deny)).toBe(systemClock);
  });

  it('defaults to window.location.search', () => {
    window.history.replaceState(null, '', '/?now=2026-11-03T17:20');
    try {
      expect(zonedParts(createAppClock(undefined, allow).now()).hhmm).toBe('17:20');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('uses the env-based allow rule by default', () => {
    vi.stubEnv('DEV', true);
    expect(createAppClock('?now=2026-11-02T16:20')).not.toBe(systemClock);
  });
});

describe('defaultAllowFakeClock', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true in dev', () => {
    vi.stubEnv('DEV', true);
    expect(defaultAllowFakeClock()).toBe(true);
  });

  it('is false in production without the flag', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ALLOW_FAKE_CLOCK', '');
    expect(defaultAllowFakeClock()).toBe(false);
  });

  it('is true in production with VITE_ALLOW_FAKE_CLOCK=1', () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('VITE_ALLOW_FAKE_CLOCK', '1');
    expect(defaultAllowFakeClock()).toBe(true);
  });
});
