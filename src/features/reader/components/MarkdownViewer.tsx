import { createContext, memo, useContext } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';
import type { Components, UrlTransform } from 'react-markdown';
import { parseAssetReference } from '../../../domain/reader/utils/assetReference';

interface MarkdownViewerProps {
  text: string;
  /**
   * Object URLs for this document's stored assets, keyed by asset id (`useMaterialAssets`).
   * Omit it and `lc-asset://` references render as a labelled placeholder rather than a broken
   * image — an unresolved figure is visible, never silent.
   */
  assetUrls?: Map<string, string>;
}

/**
 * Asset map for the rendered subtree, supplied by `MarkdownViewer`'s `assetUrls` prop.
 *
 * Context rather than rebuilding the `components` map per render: the element map stays
 * module-level and stable, so only the resolved URLs travel.
 */
const AssetUrlsContext = createContext<Map<string, string> | undefined>(undefined);

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames || []), 'u', 'figure', 'figcaption', 'mark'],
  attributes: {
    ...defaultSchema.attributes,
    u: [...(defaultSchema.attributes?.['*'] || [])],
    figure: [...(defaultSchema.attributes?.['*'] || [])],
    figcaption: [...(defaultSchema.attributes?.['*'] || [])],
  },
  // `defaultSchema` permits only http/https for `src`, so it would strip a local
  // `lc-asset://{assetId}` reference before the `img` renderer could read it. `lc-asset` is inert
  // outside this viewer — nothing but a stored-asset lookup resolves it.
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'lc-asset'],
  },
};

/**
 * URL protocols this viewer consumes for local figures. Document markdown carries
 * `lc-asset://{assetId}` references for stored assets, and nothing else: resolved object URLs are
 * minted at render time and never written back into markdown, so they are deliberately not
 * allowed through here.
 */
const ASSET_URL_PROTOCOLS = ['lc-asset:'];

/**
 * URL transform that keeps local asset references alive.
 *
 * react-markdown blanks any URL whose protocol is outside its built-in allow list
 * (http/https/irc/mailto/xmpp) via `defaultUrlTransform`, which would erase the reference before
 * the `img` renderer runs — the sanitize schema alone is not enough. Every other URL keeps the
 * default policy.
 */
const urlTransform: UrlTransform = (url) =>
  ASSET_URL_PROTOCOLS.some((protocol) => url.startsWith(protocol))
    ? url
    : defaultUrlTransform(url);

/** Minimal structural type for the hast nodes the figure plugin walks. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

/**
 * Rehype transform that merges an image paragraph and its caption into a
 * semantic `<figure>` / `<figcaption>` pair.
 *
 * `![](img)` followed by a caption like `*Figure 4.1 …*` parses as two
 * sibling `<p>` nodes: `<p><img /></p>` + `<p><em>…</em></p>`. React-markdown
 * renders them independently, so a caption can never be placed inside its
 * figure via `components` alone — the tree must be restructured first.
 * StyleX cannot express the adjacent-sibling selectors this replaces.
 *
 * A `<p>` is treated as a caption only when its next sibling is a
 * `<p><img /></p>` and it contains an `<em>` (the conventional markdown
 * figure-caption format).
 */
function rehypeFigure() {
  return (tree: HastNode): void => {
    const transformChildren = (parent: HastNode): void => {
      const children = parent.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.type !== 'element' || !node.children) continue;

        const onlyChild = node.children[0];
        const isImageParagraph =
          node.tagName === 'p' &&
          node.children.length === 1 &&
          onlyChild.type === 'element' &&
          onlyChild.tagName === 'img';

        if (isImageParagraph) {
          const next = children[i + 1];
          let figcaption: HastNode | null = null;

          // A caption paragraph starts with an `<em>` (the conventional
          // `*Figure …*` format); requiring it as the first child avoids
          // swallowing a regular paragraph that merely contains italics.
          const firstChild = next?.children?.[0];
          if (
            next?.type === 'element' &&
            next.tagName === 'p' &&
            firstChild?.type === 'element' &&
            firstChild.tagName === 'em'
          ) {
            figcaption = {
              type: 'element',
              tagName: 'figcaption',
              properties: {},
              children: next.children,
            };
            // Consume the caption paragraph so it is not rendered twice.
            children.splice(i + 1, 1);
          }

          children[i] = {
            type: 'element',
            tagName: 'figure',
            properties: {},
            children: figcaption ? [onlyChild, figcaption] : [onlyChild],
          };
        }

        transformChildren(node);
      }
    };
    transformChildren(tree);
  };
}

const mobileQuery = '@media (max-width: 768px)';

const styles = stylex.create({
  root: {
    flex: 1,
    maxWidth: 800,
    width: '100%',
    minWidth: 0,
    boxSizing: 'border-box',
    padding: '40px 32px 50vh 32px',
    [mobileQuery]: {
      padding: '20px 12px 35vh 12px',
    },
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    lineHeight: 1.6,
    color: '#333',
  },
  heading: {
    marginTop: 24,
    marginBottom: 16,
    fontWeight: 600,
    lineHeight: 1.25,
  },
  h1: {
    fontSize: '2em',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#eee',
    paddingBottom: '0.3em',
  },
  h2: {
    fontSize: '1.5em',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: '#eee',
    paddingBottom: '0.3em',
  },
  h3: {
    fontSize: '1.25em',
  },
  paragraph: {
    marginBottom: 16,
  },
  // Inline code (e.g. `var`) inside paragraph text.
  inlineCode: {
    backgroundColor: 'var(--color-background-code-inline)',
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: '0.9em',
  },
  pre: {
    backgroundColor: 'var(--color-background-code)',
    color: 'var(--color-text-code)',
    padding: 16,
    borderRadius: 8,
    overflowX: 'auto',
    marginBottom: 16,
  },
  list: {
    paddingLeft: '2em',
    marginBottom: 16,
  },
  listItem: {
    marginBottom: 4,
  },
  link: {
    color: 'var(--color-text-code-link)',
    textDecoration: 'none',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftStyle: 'solid',
    borderLeftColor: '#ddd',
    margin: '0 0 16px 0',
    padding: '0 16px',
    color: '#666',
  },
  table: {
    borderCollapse: 'collapse',
    marginBottom: 16,
    width: '100%',
  },
  cell: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ddd',
    padding: '8px 12px',
    textAlign: 'left',
  },
  headerCell: {
    backgroundColor: '#f5f5f5',
    fontWeight: 600,
  },
  hr: {
    borderWidth: 0,
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: '#eee',
    margin: '24px 0',
  },
  img: {
    display: 'block',
    margin: '8px auto',
    maxWidth: '100%',
  },
  // Stands in for an `lc-asset://` reference that could not be resolved (asset missing, or no
  // resolution map supplied).
  assetPlaceholder: {
    display: 'block',
    margin: '8px auto',
    maxWidth: '100%',
    padding: '24px 16px',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'var(--color-border)',
    borderRadius: 8,
    backgroundColor: 'var(--color-background-muted)',
    color: 'var(--color-text-disabled)',
    fontSize: '0.9em',
    textAlign: 'center',
  },
  figure: {
    margin: '8px 0 16px 0',
    textAlign: 'center',
  },
  figcaption: {
    fontSize: '0.85em',
    color: '#666',
    marginTop: 6,
    textAlign: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
    textUnderlineOffset: 3,
  },
  strong: {
    fontWeight: 700,
    color: 'var(--color-text-primary)',
  },
  em: {
    fontStyle: 'italic',
  },
});

interface AssetImageProps extends Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'> {
  src?: string;
  alt?: string;
}

/**
 * `<img>` renderer that resolves local document asset references.
 *
 * A non-asset `src` (absolute URL, relative path) passes through untouched. An `lc-asset://`
 * reference resolves through the surrounding document's asset map; when it cannot — the asset is
 * missing, or no map was supplied — it renders as a labelled placeholder instead of a broken
 * image.
 */
function AssetImage({ src, alt, ...props }: AssetImageProps) {
  const assetUrls = useContext(AssetUrlsContext);
  const assetId = parseAssetReference(src);
  const resolvedSrc = assetId ? assetUrls?.get(assetId) : src;

  if (assetId && !resolvedSrc) {
    return (
      <span {...stylex.props(styles.assetPlaceholder)}>
        {alt || 'Figure unavailable'}
      </span>
    );
  }

  return <img {...props} src={resolvedSrc} alt={alt ?? ''} {...stylex.props(styles.img)} />;
}

/**
 * Maps markdown elements to StyleX-styled DOM nodes.
 *
 * The root element keeps the `markdown-viewer` class as a stable selector
 * hook for the `pre code` block-code reset in `global.css` — StyleX cannot
 * express descendant selectors.
 */
const components: Components = {
  h1: ({ node: _node, ...props }) => (
    <h1 {...props} {...stylex.props(styles.heading, styles.h1)} />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 {...props} {...stylex.props(styles.heading, styles.h2)} />
  ),
  h3: ({ node: _node, ...props }) => (
    <h3 {...props} {...stylex.props(styles.heading, styles.h3)} />
  ),
  p: ({ node: _node, ...props }) => (
    <p {...props} {...stylex.props(styles.paragraph)} />
  ),
  a: ({ node: _node, ...props }) => (
    <a {...props} {...stylex.props(styles.link)} target="_blank" rel="noopener noreferrer" />
  ),
  strong: ({ node: _node, ...props }) => (
    <strong {...props} {...stylex.props(styles.strong)} />
  ),
  b: ({ node: _node, ...props }) => (
    <b {...props} {...stylex.props(styles.strong)} />
  ),
  em: ({ node: _node, ...props }) => (
    <em {...props} {...stylex.props(styles.em)} />
  ),
  i: ({ node: _node, ...props }) => (
    <i {...props} {...stylex.props(styles.em)} />
  ),
  u: ({ node: _node, ...props }) => (
    <u {...props} {...stylex.props(styles.underline)} />
  ),
  ul: ({ node: _node, ...props }) => (
    <ul {...props} {...stylex.props(styles.list)} />
  ),
  ol: ({ node: _node, ...props }) => (
    <ol {...props} {...stylex.props(styles.list)} />
  ),
  li: ({ node: _node, ...props }) => (
    <li {...props} {...stylex.props(styles.listItem)} />
  ),
  blockquote: ({ node: _node, ...props }) => (
    <blockquote {...props} {...stylex.props(styles.blockquote)} />
  ),
  table: ({ node: _node, ...props }) => (
    <table {...props} {...stylex.props(styles.table)} />
  ),
  th: ({ node: _node, ...props }) => (
    <th {...props} {...stylex.props(styles.cell, styles.headerCell)} />
  ),
  td: ({ node: _node, ...props }) => (
    <td {...props} {...stylex.props(styles.cell)} />
  ),
  hr: ({ node: _node, ...props }) => (
    <hr {...props} {...stylex.props(styles.hr)} />
  ),
  img: ({ node: _node, src, alt, ...props }) => (
    <AssetImage src={src} alt={alt} {...props} />
  ),
  figure: ({ node: _node, ...props }) => (
    <figure {...props} {...stylex.props(styles.figure)} />
  ),
  figcaption: ({ node: _node, ...props }) => (
    <figcaption {...props} {...stylex.props(styles.figcaption)} />
  ),
  // Block code (`<pre><code>`) is reset by the `.markdown-viewer pre code`
  // rule in global.css (descendant selector — not expressible in StyleX),
  // so this component only styles inline code.
  code: ({ node: _node, className, ...props }) => {
    const sx = stylex.props(styles.inlineCode);
    return (
      <code
        {...props}
        {...sx}
        className={[className, sx.className].filter(Boolean).join(' ')}
      />
    );
  },
  pre: ({ node: _node, ...props }) => (
    <pre {...props} {...stylex.props(styles.pre)} />
  ),
};

const MarkdownViewer = memo(function MarkdownViewer({ text, assetUrls }: MarkdownViewerProps) {
  const rootProps = stylex.props(styles.root);

  return (
    <div {...rootProps} className={`markdown-viewer ${rootProps.className ?? ''}`}>
      <AssetUrlsContext.Provider value={assetUrls}>
        <ReactMarkdown
          rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeSlug, rehypeFigure]}
          remarkPlugins={[remarkGfm]}
          urlTransform={urlTransform}
          components={components}
        >
          {text}
        </ReactMarkdown>
      </AssetUrlsContext.Provider>
    </div>
  );
});

export default MarkdownViewer;
