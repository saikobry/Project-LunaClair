import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActionMenu } from '../ActionMenu';
import { ActionMenuItem } from '../ActionMenuItem';

describe('ActionMenu', () => {
  it('renders toggle button with default label and keeps popup hidden initially', () => {
    render(
      <ActionMenu>
        <ActionMenuItem label="Edit" onClick={vi.fn()} />
      </ActionMenu>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    expect(triggerBtn).toBeInTheDocument();

    const menu = screen.getByRole('menu', { hidden: true });
    expect(menu).toBeInTheDocument();
    // Initially hidden
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('renders custom label on trigger button', () => {
    render(
      <ActionMenu label="More subject options">
        <ActionMenuItem label="Delete" onClick={vi.fn()} />
      </ActionMenu>
    );

    expect(screen.getByRole('button', { name: 'More subject options' })).toBeInTheDocument();
  });

  it('opens popup when toggle button is clicked and toggles closed on second click', () => {
    render(
      <ActionMenu>
        <ActionMenuItem label="Download" onClick={vi.fn()} />
      </ActionMenu>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);

    expect(triggerBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Download')).toBeInTheDocument();

    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls item onClick and closes menu when menu item is clicked', () => {
    const handleEdit = vi.fn();
    render(
      <ActionMenu>
        <ActionMenuItem label="Edit Note" onClick={handleEdit} />
      </ActionMenu>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);

    const editItem = screen.getByRole('menuitem', { name: 'Edit Note' });
    fireEvent.click(editItem);

    expect(handleEdit).toHaveBeenCalledTimes(1);
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes menu when Escape key is pressed', () => {
    render(
      <ActionMenu>
        <ActionMenuItem label="Delete" onClick={vi.fn()} />
      </ActionMenu>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes menu when clicking outside', () => {
    render(
      <div>
        <div data-testid="outside-area">Outside</div>
        <ActionMenu>
          <ActionMenuItem label="Option" onClick={vi.fn()} />
        </ActionMenu>
      </div>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'true');

    fireEvent.mouseDown(screen.getByTestId('outside-area'));
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('closes menu when focus moves outside the menu container', () => {
    render(
      <div>
        <ActionMenu>
          <ActionMenuItem label="Item" onClick={vi.fn()} />
        </ActionMenu>
        <button type="button" data-testid="external-btn">Other</button>
      </div>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'true');

    const wrapper = triggerBtn.closest('div[tabindex], div')!;
    const externalBtn = screen.getByTestId('external-btn');

    fireEvent.blur(wrapper, { relatedTarget: externalBtn });
    expect(triggerBtn).toHaveAttribute('aria-pressed', 'false');
  });

  it('stops click propagation to parent containers', () => {
    const parentClick = vi.fn();
    render(
      <div onClick={parentClick}>
        <ActionMenu>
          <ActionMenuItem label="Item" onClick={vi.fn()} />
        </ActionMenu>
      </div>
    );

    const triggerBtn = screen.getByRole('button', { name: 'Card actions' });
    fireEvent.click(triggerBtn);

    expect(parentClick).not.toHaveBeenCalled();
  });
});
