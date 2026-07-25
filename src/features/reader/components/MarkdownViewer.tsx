import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownViewerProps {
  text: string;
}

const components: Components = {
  // Style all images to fit within the viewer width
  img: (props) => (
    <img {...props} style={{ maxWidth: '100%', display: 'block', margin: '8px auto' }} alt={props.alt ?? ''} />
  ),
};

const MarkdownViewer = memo(function MarkdownViewer({ text }: MarkdownViewerProps) {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown
        rehypePlugins={[rehypeSlug]}
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownViewer;
