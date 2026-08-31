import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
} from 'lexical';
import { INSERT_TABLE_COMMAND } from '@lexical/table';
import { INSERT_HORIZONTAL_RULE_COMMAND } from '@lexical/react/LexicalHorizontalRuleNode';
import { Table as TableIcon, Image as ImageIcon, Minus } from 'lucide-react';
import * as stylex from '@stylexjs/stylex';
import { $createImageNode } from '../../nodes/ImageNode';
import { toolbarStyles } from './toolbar.stylex';

export function WriterToolbarInserts() {
  const [editor] = useLexicalComposerContext();

  const handleInsertTable = () => {
    editor.dispatchCommand(INSERT_TABLE_COMMAND, {
      columns: '3',
      rows: '3',
      includeHeaders: true,
    });
  };

  const handleInsertImage = () => {
    const url = window.prompt('Enter image URL or asset path:', 'images/figure41a.png');
    if (!url) return;
    const alt = window.prompt('Enter image caption or alt text:', 'Figure Illustration') || '';

    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const imageNode = $createImageNode(url, alt);
        selection.insertNodes([imageNode]);
      }
    });
  };

  const handleInsertHR = () => {
    editor.dispatchCommand(INSERT_HORIZONTAL_RULE_COMMAND, undefined);
  };

  return (
    <div {...stylex.props(toolbarStyles.group)}>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleInsertTable}
        title="Insert GFM Table (3×3)"
        aria-label="Insert Table"
      >
        <TableIcon size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleInsertImage}
        title="Insert Image"
        aria-label="Insert Image"
      >
        <ImageIcon size={16} />
      </button>
      <button
        type="button"
        {...stylex.props(toolbarStyles.button)}
        onMouseDown={(e) => e.preventDefault()}
        onClick={handleInsertHR}
        title="Insert Horizontal Rule (---)"
        aria-label="Insert Divider"
      >
        <Minus size={16} />
      </button>
    </div>
  );
}
