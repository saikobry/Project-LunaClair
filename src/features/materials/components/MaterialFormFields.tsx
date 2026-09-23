import * as stylex from '@stylexjs/stylex';
import { Input } from '../../../shared/ui/Input/Input';
import { TextArea } from '../../../shared/ui/TextArea/TextArea';
import { TagInput } from '../../../shared/ui/TagInput/TagInput';
import { splitTagInput, normalizeTags, mergeTags, tagKey } from '../../../domain/quiz/utils/tags';

export interface MaterialFormFieldsProps {
  title: string;
  onTitleChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  titleError?: string;
  disabled?: boolean;
  autoFocus?: boolean;
}

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
});

export function MaterialFormFields({
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  tags,
  onTagsChange,
  titleError,
  disabled = false,
  autoFocus = true,
}: MaterialFormFieldsProps) {
  return (
    <div {...stylex.props(styles.container)}>
      <Input
        label="Title"
        value={title}
        onChange={onTitleChange}
        placeholder="Enter material title"
        disabled={disabled}
        autoFocus={autoFocus}
        statusMessage={titleError}
      />

      <TextArea
        label="Description"
        value={description}
        onChange={onDescriptionChange}
        placeholder="Brief description (optional)"
        disabled={disabled}
        rows={3}
      />

      <TagInput
        tags={tags}
        onChange={onTagsChange}
        splitInput={splitTagInput}
        mergeTags={mergeTags}
        tagKey={tagKey}
        normalizeTags={(list) => normalizeTags(list) ?? []}
      />
    </div>
  );
}

export default MaterialFormFields;
