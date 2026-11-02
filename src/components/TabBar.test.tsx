import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { TabBar } from './TabBar';

describe('TabBar', () => {
  it('marks only the current tab with aria-current="page"', () => {
    render(
      <MemoryRouter initialEntries={['/week']}>
        <TabBar />
      </MemoryRouter>,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['🗺️Today', '📅Week', '🏆Rewards', '😊Me']);
    expect(screen.getByRole('link', { name: 'Week' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Today' })).not.toHaveAttribute('aria-current');
  });

  it('treats "/" as Today only on the home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <TabBar />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Me' })).not.toHaveAttribute('aria-current');
  });
});
