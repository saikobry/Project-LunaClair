import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  INDENT_CONTENT_COMMAND,
  OUTDENT_CONTENT_COMMAND,
} from 'lexical';
import { Indent, Outdent } from 'lucide-react';
import * as stylex from '@stylexjs/stylex';
import { toolbarStyles } from './toolbarStyles';

export function WriterToolbarIndents() {
  const [editor] = useLexicalComposerContext();

  return (
    <div {...stylex.props(toolbarStyles.group)}>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button)}
        onClick={() => editor.dispatchCommand(OUTDENT_CONTENT_COMMAND, undefined)}
        title="Outdent (Shift+Tab)"
        aria-label="Outdent"
      >
        <Outdent size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button)}
        onClick={() => editor.dispatchCommand(INDENT_CONTENT_COMMAND, undefined)}
        title="Indent (Tab)"
        aria-label="Indent"
      >
        <Indent size={16} />
      </button>
    </div>
  );
}
