import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Switch } from '../Switch';

describe('Switch', () => {
  it('renders with label and description', () => {
    render(
      <Switch
        label="Test Feature"
        description="Enable test feature"
        value={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('switch', { name: /test feature/i })).toBeInTheDocument();
    expect(screen.getByText('Enable test feature')).toBeInTheDocument();
  });

  it('reflects checked state when on or off', () => {
    const { rerender } = render(
      <Switch
        label="Test Toggle"
        value={false}
        onChange={() => {}}
      />
    );

    const switchEl = screen.getByRole('switch');
    expect(switchEl).not.toBeChecked();

    rerender(
      <Switch
        label="Test Toggle"
        value={true}
        onChange={() => {}}
      />
    );

    expect(switchEl).toBeChecked();
  });

  it('triggers onChange callback on user interaction', () => {
    const handleChange = vi.fn();
    render(
      <Switch
        label="Interactive Switch"
        value={false}
        onChange={handleChange}
      />
    );

    const switchEl = screen.getByRole('switch');
    fireEvent.click(switchEl);

    expect(handleChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('respects isChecked prop alias', () => {
    render(
      <Switch
        label="Alias Switch"
        isChecked={true}
        onChange={() => {}}
      />
    );

    expect(screen.getByRole('switch')).toBeChecked();
  });
});
