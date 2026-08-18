import {
  DecoratorNode,
  type DOMConversionMap,
  type DOMConversionOutput,
  type DOMExportOutput,
  type LexicalNode,
  type NodeKey,
  type SerializedLexicalNode,
  type Spread,
} from 'lexical';
import { type JSX } from 'react';

export type SerializedImageNode = Spread<
  {
    src: string;
    altText: string;
  },
  SerializedLexicalNode
>;

function $convertImageElement(domNode: Node): DOMConversionOutput | null {
  if (domNode instanceof HTMLImageElement) {
    const { src, alt } = domNode;
    const node = $createImageNode(src, alt);
    return { node };
  }
  return null;
}

export class ImageNode extends DecoratorNode<JSX.Element> {
  __src: string;
  __altText: string;

  static override getType(): string {
    return 'image';
  }

  static override clone(node: ImageNode): ImageNode {
    return new ImageNode(node.__src, node.__altText, node.__key);
  }

  constructor(src: string, altText: string, key?: NodeKey) {
    super(key);
    this.__src = src;
    this.__altText = altText;
  }

  getSrc(): string {
    return this.__src;
  }

  getAltText(): string {
    return this.__altText;
  }

  setSrc(src: string): void {
    const writable = this.getWritable();
    writable.__src = src;
  }

  setAltText(altText: string): void {
    const writable = this.getWritable();
    writable.__altText = altText;
  }

  override createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'writer-image-wrapper';
    return span;
  }

  override updateDOM(): false {
    return false;
  }

  static override importDOM(): DOMConversionMap | null {
    return {
      img: () => ({
        conversion: $convertImageElement,
        priority: 0,
      }),
    };
  }

  override exportDOM(): DOMExportOutput {
    const element = document.createElement('img');
    element.setAttribute('src', this.__src);
    element.setAttribute('alt', this.__altText);
    element.className = 'writer-image';
    return { element };
  }

  static override importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { src, altText } = serializedNode;
    return $createImageNode(src, altText);
  }

  override exportJSON(): SerializedImageNode {
    return {
      type: 'image',
      src: this.__src,
      altText: this.__altText,
      version: 1,
    };
  }

  override decorate(): JSX.Element {
    return (
      <span className="writer-image-container" style={{ display: 'block', margin: '16px 0', textAlign: 'center' }}>
        <img
          src={this.__src}
          alt={this.__altText}
          style={{
            maxWidth: '100%',
            height: 'auto',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
            border: '1px solid var(--color-border, #e5e7eb)',
          }}
          loading="lazy"
          onError={(e) => {
            // Fallback gracefully for local/relative paths in testbench
            const target = e.currentTarget;
            target.style.display = 'none';
            const fallback = target.parentElement?.querySelector('.writer-image-fallback');
            if (fallback) {
              (fallback as HTMLElement).style.display = 'inline-flex';
            }
          }}
        />
        <span
          className="writer-image-fallback"
          style={{
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 24px',
            backgroundColor: 'var(--color-background-muted, #f3f4f6)',
            borderRadius: '8px',
            border: '1px dashed var(--color-border, #d1d5db)',
            color: 'var(--color-text-secondary, #6b7280)',
            fontSize: '13px',
          }}
        >
          📷 Image: {this.__altText || this.__src}
        </span>
        {this.__altText && (
          <span
            style={{
              display: 'block',
              fontSize: '13px',
              color: 'var(--color-text-secondary, #6b7280)',
              marginTop: '6px',
              fontStyle: 'italic',
            }}
          >
            {this.__altText}
          </span>
        )}
      </span>
    );
  }
}

export function $createImageNode(src: string, altText = ''): ImageNode {
  return new ImageNode(src, altText);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
