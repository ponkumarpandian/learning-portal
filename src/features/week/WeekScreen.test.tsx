import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { db } from '@/db/db';
import { setSlotStatus } from '@/db/repos';
import { fixedClock } from '@/engine/clock';
import { ClockContext } from '@/state/clock';
import { WeekScreen } from './WeekScreen';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(wallTime: string) {
  return render(
    <ClockContext.Provider value={fixedClock(wallTime)}>
      <MemoryRouter initialEntries={['/week']}>
        <Routes>
          <Route path="/week" element={<WeekScreen />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </ClockContext.Provider>,
  );
}

const day = (name: RegExp) => screen.getByRole('button', { name });

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('Week screen', () => {
  it('opens on today and lists today’s lessons as on Today’s trail', async () => {
    renderAt('2026-11-04T16:20'); // Wednesday
    expect(day(/^Today.*Wednesday/)).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: /Today · Wednesday 4 November/ }),
    ).toBeInTheDocument();
    expect(await screen.findByText('These are on today’s trail.')).toBeInTheDocument();
  });

  it('a missed earlier day shows amber catch-ups that open that day’s lesson', async () => {
    await setSlotStatus('2026-11-02', 1, 'done', 1); // Monday's Maths was done
    const u = userEvent.setup();
    renderAt('2026-11-04T16:20');
    // Monday's bubble counts the 3 still waiting
    expect(await screen.findByRole('button', { name: /Mon.*Monday, 3 to catch up/ })).toBeInTheDocument();
    expect(screen.getByText(/lessons waiting to catch up 🙂/)).toBeInTheDocument();

    await u.click(day(/Monday, 3 to catch up/));
    expect(screen.getByRole('heading', { level: 2, name: 'Monday 2 November' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Maths, 4:15–5:15, done, open it again/ })).toBeInTheDocument();
    await u.click(screen.getByRole('link', { name: /^Physics, 5:30–6:15, catch up now/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/lesson/2026-11-02/3');
  });

  it('future days are locked, and a tap says so kindly', async () => {
    const u = userEvent.setup();
    renderAt('2026-11-04T16:20');
    await u.click(day(/Thursday, locked/));
    expect(screen.getByText(/This day opens on Thursday/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Physics/ })).not.toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /^Physics, 4:15–5:00, locked/ }));
    const sheet = screen.getByRole('dialog', { name: /Physics opens on Thursday/ });
    expect(within(sheet).getByText(/It starts at 4:15/)).toBeInTheDocument();
  });

  it('steps back week by week to the plan start, so an older missed day is not lost', async () => {
    const u = userEvent.setup();
    renderAt('2026-11-16T16:20'); // Monday, two weeks after the plan started (Mon 2 Nov)
    const earlier = screen.getByRole('button', { name: /Earlier/ });
    expect(screen.getByRole('button', { name: /Later/ })).toBeDisabled();
    await u.click(earlier);
    expect(screen.getByText('Last week')).toBeInTheDocument();
    // an earlier week opens on its Sunday
    expect(screen.getByRole('heading', { level: 2, name: 'Sunday 15 November' })).toBeInTheDocument();
    await u.click(earlier);
    expect(screen.getByText('2 weeks ago')).toBeInTheDocument();
    expect(earlier).toBeDisabled(); // the week the plan started in
    await u.click(day(/Saturday/));
    expect(screen.getByRole('link', { name: /^Chemistry, 10:15–11:00, catch up now/ })).toHaveAttribute(
      'href',
      '/lesson/2026-11-07/2',
    );
  });

  it('in the week the plan started, there is no earlier week to go to', () => {
    renderAt('2026-11-04T16:20'); // the plan started on Monday 2 Nov
    expect(screen.getByRole('button', { name: /Earlier/ })).toBeDisabled();
    expect(screen.getByText('This week')).toBeInTheDocument();
  });
});
