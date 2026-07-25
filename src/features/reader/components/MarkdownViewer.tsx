import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  text: string;
}

const MarkdownViewer = memo(function MarkdownViewer({ text }: MarkdownViewerProps) {
  return (
    <div className="markdown-viewer">
      <ReactMarkdown
        rehypePlugins={[rehypeRaw, rehypeSlug]}
        remarkPlugins={[remarkGfm]}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownViewer;
