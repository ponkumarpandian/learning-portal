import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChunkyButton } from './ChunkyButton';

describe('ChunkyButton', () => {
  it('fires onClick when enabled', async () => {
    const onClick = vi.fn();
    render(<ChunkyButton onClick={onClick}>Start Physics</ChunkyButton>);
    await userEvent.click(screen.getByRole('button', { name: 'Start Physics' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and ignores clicks when disabled', async () => {
    const onClick = vi.fn();
    render(
      <ChunkyButton disabled onClick={onClick}>
        Check my answer
      </ChunkyButton>,
    );
    const btn = screen.getByRole('button', { name: 'Check my answer' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('uses the soft style for secondary actions and keeps the arrow decorative', () => {
    render(
      <ChunkyButton variant="soft" arrow>
        Next
      </ChunkyButton>,
    );
    const btn = screen.getByRole('button', { name: 'Next' });
    expect(btn).toHaveClass('chunky', 'soft');
    expect(btn.querySelector('.arrow')).toHaveAttribute('aria-hidden', 'true');
  });
});
