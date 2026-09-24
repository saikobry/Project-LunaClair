import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchInput } from '../SearchInput';

describe('SearchInput', () => {
  it('names the field by its label and exposes the placeholder affordance', () => {
    render(
      <SearchInput
        label="Search collections"
        value=""
        onChange={vi.fn()}
        placeholder="Search collections..."
      />,
    );

    // The label supplies the accessible name (it stays in the DOM, visually
    // hidden by Astryx — so it is queryable even though it is never seen).
    expect(screen.getByLabelText('Search collections')).toBeInTheDocument();
    // The field is not an unlabelled input: it announces itself by name.
    expect(screen.getByLabelText('Search collections')).toHaveAccessibleName(
      'Search collections',
    );
    // The placeholder is the visible affordance the caller supplies.
    expect(screen.getByPlaceholderText('Search collections...')).toBeInTheDocument();
  });

  it('forwards value and fires onChange on every keystroke', () => {
    const onChange = vi.fn();
    render(
      <SearchInput
        label="Search"
        value="algebra"
        onChange={onChange}
        placeholder="Search your materials..."
      />,
    );

    const input = screen.getByPlaceholderText('Search your materials...');
    expect(input).toHaveValue('algebra');

    fireEvent.change(input, { target: { value: 'algebra 2' } });
    expect(onChange).toHaveBeenCalledWith('algebra 2', expect.anything());
  });

  it('renders the search icon at 15px by default and honours iconSize', () => {
    const { container, unmount } = render(
      <SearchInput label="Search" value="" onChange={vi.fn()} />,
    );
    const defaultIcon = container.querySelector('svg');
    expect(defaultIcon).toHaveAttribute('width', '15');
    expect(defaultIcon).toHaveAttribute('height', '15');
    unmount();

    const { container: sized } = render(
      <SearchInput label="Search" value="" onChange={vi.fn()} iconSize={16} />,
    );
    expect(sized.querySelector('svg')).toHaveAttribute('width', '16');
  });

  it('defaults to clearable and allows opting out', () => {
    const { container, unmount } = render(
      <SearchInput label="Search" value="algebra" onChange={vi.fn()} />,
    );
    const defaultButtons = container.querySelectorAll('button').length;
    unmount();

    const { container: notClearable } = render(
      <SearchInput label="Search" value="algebra" onChange={vi.fn()} clearable={false} />,
    );
    expect(container).toBeDefined();
    expect(notClearable.querySelectorAll('button').length).toBeLessThan(defaultButtons);
  });
});
