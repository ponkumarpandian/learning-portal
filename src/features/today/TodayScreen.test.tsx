import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { STUDY_KINDS, loadContent } from '@/content';
import { fixedClock } from '@/engine/clock';
import { ClockContext } from '@/state/clock';
import { TodayScreen } from './TodayScreen';
import { buildToday, greeting } from './todayModel';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(wallTime: string) {
  return render(
    <ClockContext.Provider value={fixedClock(wallTime)}>
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ClockContext.Provider>,
  );
}

const partsAt = (weekday: 'mon' | 'sat', dateKey: string, hhmm: string) => {
  const [hour = 0, minute = 0] = hhmm.split(':').map(Number);
  const [year = 0, month = 0, day = 0] = dateKey.split('-').map(Number);
  return { dateKey, hhmm, weekday, hour, minute, year, month, day };
};

describe('Today screen', () => {
  const bundle = loadContent();

  it('renders one stone per non-break study slot of the day, from the timetable', () => {
    renderAt('2026-11-02T17:40'); // Monday, IST
    const trail = screen.getByRole('list', { name: 'Today’s trail' });
    const stones = trail.querySelectorAll('.stone');
    const expected = bundle.timetable.days.mon.filter(
      (s) => STUDY_KINDS.includes(s.kind) || s.kind === 'test' || s.kind === 'review',
    );
    expect(stones).toHaveLength(expected.length);
    expect(expected.map((s) => s.subject)).toEqual(['maths', 'physics', 'english', 'geography']);
    // activities are rest stops; breaks are not on the trail; the trail ends at bedtime
    expect(within(trail).getByRole('button', { name: /Bharatanatyam.*6:30–7:30/ })).toBeInTheDocument();
    expect(within(trail).queryByRole('button', { name: /Short break/ })).not.toBeInTheDocument();
    expect(within(trail).getByRole('button', { name: /Sleep time.*9:45/ })).toBeInTheDocument();
  });

  it('greets by IST time and highlights the slot that matches the clock', () => {
    renderAt('2026-11-02T17:40');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Good evening, Avantika!/);
    expect(
      screen.getByRole('button', { name: 'Physics, 5:30–6:15, up now, start here' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /English, 8:15–9:00, later/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start Physics/ })).toBeInTheDocument();
  });

  it('builds the weekend trail from the same file (tests and fix-its are stones)', () => {
    const view = buildToday(bundle, {
      dateKey: '2026-11-07',
      hhmm: '08:00',
      weekday: 'sat',
      hour: 8,
      minute: 0,
      year: 2026,
      month: 11,
      day: 7,
    });
    expect(view.entries.filter((e) => e.type === 'stone').map((e) => e.name)).toEqual([
      'Maths',
      'Chemistry',
      'Biology',
      'Saturday Test',
      'English',
      'Geography',
      'History / Civics',
    ]);
    expect(view.upNow?.isNow).toBe(false);
    expect(view.bedtime).toBe('22:15');
  });

  it('keeps a lesson whose time has passed startable as a catch-up (§5.2)', async () => {
    const user = userEvent.setup();
    renderAt('2026-11-02T17:40'); // Monday: Maths was 4:15–5:15
    const maths = screen.getByRole('button', { name: 'Maths, 4:15–5:15, waiting for you, catch up' });
    expect(maths).toHaveAttribute('data-state', 'catchup');

    await user.click(maths);
    expect(screen.getByText('This one’s waiting for you 🙂')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Start Maths now/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson/2026-11-02/1');
  });

  it('"Not now" closes the catch-up sheet and stays on the trail', async () => {
    const user = userEvent.setup();
    renderAt('2026-11-02T17:40');
    await user.click(screen.getByRole('button', { name: /Maths, 4:15–5:15, waiting for you/ }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
    // the sheet slides away (exit animation), then it is gone
    await waitFor(() => expect(screen.queryByText('This one’s waiting for you 🙂')).not.toBeInTheDocument());
  });

  it('offers the waiting lesson on the Up now card when nothing matches the clock', async () => {
    const user = userEvent.setup();
    renderAt('2026-11-02T19:50'); // Monday dinner: Maths and Physics have passed, English is at 8:15
    const card = screen.getByRole('heading', { level: 2, name: 'Maths' }).closest('.upnow') as HTMLElement;
    expect(within(card).getByText(/Catch up · 4:15–5:15/)).toBeInTheDocument();
    expect(within(card).getByText(/Next:.*English at 8:15/)).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: /Start Maths/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson/2026-11-02/1');
  });

  it('marks only past study slots as catch-ups, and none after bedtime', () => {
    const at = (hhmm: string) => buildToday(bundle, partsAt('mon', '2026-11-02', hhmm));
    expect(at('16:00').catchUps).toEqual([]);
    expect(at('17:15').catchUps.map((e) => e.name)).toEqual(['Maths']); // ends exactly at 17:15
    expect(at('21:40').catchUps.map((e) => e.name)).toEqual(['Maths', 'Physics', 'English', 'Geography']);
    expect(at('21:45').catchUps).toEqual([]); // school-night bedtime
    // a missed test is not a catch-up lesson (it has its own window, §8.3)
    const sat = buildToday(bundle, partsAt('sat', '2026-11-07', '16:20'));
    expect(sat.catchUps.map((e) => e.name)).toEqual(['Maths', 'Chemistry', 'Biology']);
  });

  it('picks the greeting by hour', () => {
    expect(greeting(9, 'A')).toMatch(/^Good morning/);
    expect(greeting(14, 'A')).toMatch(/^Good afternoon/);
    expect(greeting(20, 'A')).toMatch(/^Good evening/);
  });
});
