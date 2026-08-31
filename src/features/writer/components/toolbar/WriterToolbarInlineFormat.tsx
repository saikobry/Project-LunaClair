import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { FORMAT_TEXT_COMMAND } from 'lexical';
import { TOGGLE_LINK_COMMAND } from '@lexical/link';
import { Bold, Italic, Underline, Strikethrough, Code, Link } from 'lucide-react';
import * as stylex from '@stylexjs/stylex';
import { toolbarStyles } from './toolbar.stylex';

export interface InlineFormatState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrikethrough: boolean;
  isCode: boolean;
  isLink: boolean;
}

interface WriterToolbarInlineFormatProps {
  formats: InlineFormatState;
}

export function WriterToolbarInlineFormat({ formats }: WriterToolbarInlineFormatProps) {
  const { isBold, isItalic, isUnderline, isStrikethrough, isCode, isLink } = formats;
  const [editor] = useLexicalComposerContext();

  const handleInsertLink = () => {
    if (!isLink) {
      const url = window.prompt('Enter URL:', 'https://');
      if (url) {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    } else {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    }
  };

  return (
    <div {...stylex.props(toolbarStyles.group)}>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isBold && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        title="Bold (Ctrl+B)"
        aria-label="Bold"
        aria-pressed={isBold}
      >
        <Bold size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isItalic && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        title="Italic (Ctrl+I)"
        aria-label="Italic"
        aria-pressed={isItalic}
      >
        <Italic size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isUnderline && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')}
        title="Underline (Ctrl+U)"
        aria-label="Underline"
        aria-pressed={isUnderline}
      >
        <Underline size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isStrikethrough && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')}
        title="Strikethrough"
        aria-label="Strikethrough"
        aria-pressed={isStrikethrough}
      >
        <Strikethrough size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isCode && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')}
        title="Inline Code"
        aria-label="Inline Code"
        aria-pressed={isCode}
      >
        <Code size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button, isLink && toolbarStyles.buttonActive)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleInsertLink}
        title="Insert Link (Ctrl+K)"
        aria-label="Link"
        aria-pressed={isLink}
      >
        <Link size={16} />
      </button>
    </div>
  );
}
