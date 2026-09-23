import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportDropZone } from '../ImportDropZone';

describe('ImportDropZone', () => {
  it('renders drop zone instructions, hint, and upload element', () => {
    const onFilesAdded = vi.fn();
    render(<ImportDropZone onFilesAdded={onFilesAdded} />);

    expect(screen.getByRole('button', { name: /upload files/i })).toBeInTheDocument();
    expect(
      screen.getByText('Drag & drop your study materials here, or click to browse'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Supports PDF, PNG, JPG, JPEG, JFIF, WEBP, and \.lcpack \/ JSON study packages/),
    ).toBeInTheDocument();
  });

  it('triggers file input click when the drop zone is clicked', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(<ImportDropZone onFilesAdded={onFilesAdded} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, 'click');

    const dropZone = screen.getByRole('button', { name: /upload files/i });
    fireEvent.click(dropZone);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('handles file input selection via change event', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(<ImportDropZone onFilesAdded={onFilesAdded} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['content'], 'lecture.pdf', { type: 'application/pdf' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesAdded).toHaveBeenCalledTimes(1);
    expect(onFilesAdded).toHaveBeenCalledWith([file]);
  });

  it('handles valid drag and drop files', () => {
    const onFilesAdded = vi.fn();
    render(<ImportDropZone onFilesAdded={onFilesAdded} />);

    const dropZone = screen.getByRole('button', { name: /upload files/i });

    const pdfFile = new File(['pdf data'], 'handout.pdf', { type: 'application/pdf' });
    const imgFile = new File(['img data'], 'notes.png', { type: 'image/png' });
    const packFile = new File(['{"format":"lcpack"}'], 'deck.lcpack', { type: 'application/octet-stream' });
    const ignoredFile = new File(['exe data'], 'app.exe', { type: 'application/x-msdownload' });

    // Drag over should prevent default
    const dragOverEvent = new Event('dragover', { bubbles: true, cancelable: true });
    dropZone.dispatchEvent(dragOverEvent);

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [pdfFile, imgFile, packFile, ignoredFile],
      },
    });

    expect(onFilesAdded).toHaveBeenCalledTimes(1);
    const calledFiles = onFilesAdded.mock.calls[0][0] as File[];
    expect(calledFiles).toHaveLength(3);
    expect(calledFiles.map((f) => f.name)).toEqual(['handout.pdf', 'notes.png', 'deck.lcpack']);
  });

  it('does not invoke onFilesAdded when no valid files are dropped', () => {
    const onFilesAdded = vi.fn();
    render(<ImportDropZone onFilesAdded={onFilesAdded} />);

    const dropZone = screen.getByRole('button', { name: /upload files/i });
    const unsupportedFile = new File(['exe data'], 'binary.bin', { type: 'application/octet-stream' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [unsupportedFile],
      },
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it('renders OCR engine selector and invokes onOcrEngineChange', () => {
    const onOcrEngineChange = vi.fn();
    render(
      <ImportDropZone
        onFilesAdded={vi.fn()}
        ocrEngine="tesseract"
        onOcrEngineChange={onOcrEngineChange}
      />,
    );

    const tesseractRadio = screen.getByRole('radio', { name: /local ocr/i });
    const visionRadio = screen.getByRole('radio', { name: /ai vision/i });

    expect(tesseractRadio).toBeChecked();
    expect(visionRadio).not.toBeChecked();

    fireEvent.click(visionRadio);
    expect(onOcrEngineChange).toHaveBeenCalledWith('ai-vision');
  });

  it('disables AI Vision option when navigator is offline', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    try {
      const onOcrEngineChange = vi.fn();
      render(
        <ImportDropZone
          onFilesAdded={vi.fn()}
          ocrEngine="tesseract"
          onOcrEngineChange={onOcrEngineChange}
        />,
      );

      // Segmented segments are `<button role="radio">`, so the disabled state
      // is expressed as `aria-disabled` rather than the native attribute.
      const visionRadio = screen.getByRole('radio', { name: /ai vision.*offline/i });
      expect(visionRadio).toHaveAttribute('aria-disabled', 'true');
      fireEvent.click(visionRadio);
      expect(onOcrEngineChange).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(navigator, 'onLine', { value: originalOnLine, configurable: true });
    }
  });
});
