import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatComposer } from '../ChatComposer';

function typeMessage(box: HTMLElement, text: string) {
  box.textContent = text;
  fireEvent.input(box);
}

/** Echoing controlled parent, mirroring real consumers. */
function Harness({
  onSubmit,
  label = 'Message input',
  ...rest
}: Omit<React.ComponentProps<typeof ChatComposer>, 'value' | 'onChange' | 'label'> & {
  onSubmit: (value: string) => void;
  label?: string;
}) {
  const [value, setValue] = useState('');
  return (
    <ChatComposer label={label} value={value} onChange={setValue} onSubmit={onSubmit} {...rest} />
  );
}

describe('ChatComposer', () => {
  it('submits the trimmed message on Enter and clears the field', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);

    const box = screen.getByRole('textbox', { name: 'Message input' });
    typeMessage(box, '  hello  ');
    fireEvent.keyDown(box, { key: 'Enter', shiftKey: false });

    expect(onSubmit).toHaveBeenCalledWith('hello');
  });

  it('emits value changes', () => {
    const onChange = vi.fn();
    render(
      <ChatComposer
        label="Message input"
        value=""
        onChange={onChange}
        onSubmit={vi.fn()}
      />,
    );

    typeMessage(screen.getByRole('textbox', { name: 'Message input' }), 'hi');
    expect(onChange).toHaveBeenCalledWith('hi');
  });

  it('shows the stop button and invokes onStop while stopping', () => {
    const onStop = vi.fn();
    render(<Harness onSubmit={vi.fn()} onStop={onStop} isStopShown />);

    const stop = screen.getByRole('button', { name: 'Stop' });
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('disables send while empty or disabled', () => {
    const { rerender } = render(<Harness onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    rerender(
      <ChatComposer
        label="Message input"
        value="text"
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        isDisabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
  });

  it('renders drawer content above the input', () => {
    render(<Harness onSubmit={vi.fn()} drawer={<div>Context chip</div>} />);
    expect(screen.getByText('Context chip')).toBeInTheDocument();
  });
});
