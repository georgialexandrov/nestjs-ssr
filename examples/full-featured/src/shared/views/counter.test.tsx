import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import Counter from './counter';

describe('Counter Component', () => {
  it('should render with initial count of 0', () => {
    render(<Counter />);

    // Check that the count is displayed
    expect(screen.getByText('0')).toBeInTheDocument();

    // Check that all buttons are present
    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
    expect(screen.getByText('+')).toBeInTheDocument();
  });

  it('should render with custom initial count', () => {
    render(<Counter initialCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should increment count when + button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const incrementButton = screen.getByText('+');
    await user.click(incrementButton);

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('should decrement count when - button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter initialCount={5} />);

    const decrementButton = screen.getByText('-');
    await user.click(decrementButton);

    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('should reset count to initial value when Reset button is clicked', async () => {
    const user = userEvent.setup();
    render(<Counter initialCount={10} />);

    // Increment the counter
    const incrementButton = screen.getByText('+');
    await user.click(incrementButton);
    await user.click(incrementButton);
    expect(screen.getByText('12')).toBeInTheDocument();

    // Reset the counter
    const resetButton = screen.getByText('Reset');
    await user.click(resetButton);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('should handle multiple increments correctly', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const incrementButton = screen.getByText('+');

    await user.click(incrementButton);
    await user.click(incrementButton);
    await user.click(incrementButton);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should handle negative numbers', async () => {
    const user = userEvent.setup();
    render(<Counter />);

    const decrementButton = screen.getByText('-');

    await user.click(decrementButton);
    await user.click(decrementButton);

    expect(screen.getByText('-2')).toBeInTheDocument();
  });

  it('should display the hydration message', () => {
    render(<Counter />);

    expect(
      screen.getByText(/This counter proves client-side hydration is working!/i),
    ).toBeInTheDocument();
  });
});
