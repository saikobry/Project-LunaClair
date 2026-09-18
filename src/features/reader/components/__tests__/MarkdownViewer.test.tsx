import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownViewer from '../MarkdownViewer';

const assetUrls = (entries: Array<[string, string]>) => new Map(entries);

describe('MarkdownViewer — local asset reference resolution', () => {
    it('resolves an lc-asset reference through the supplied asset map', () => {
        const { container } = render(
            <MarkdownViewer
                text="![Cardiac cycle](lc-asset://asset-1)"
                assetUrls={assetUrls([['asset-1', 'blob:http://localhost/asset-1']])}
            />,
        );

        const img = container.querySelector('img');
        expect(img).not.toBeNull();
        expect(img?.getAttribute('src')).toBe('blob:http://localhost/asset-1');
        expect(img?.getAttribute('alt')).toBe('Cardiac cycle');
    });

    it('renders a labelled placeholder when the referenced asset is missing', () => {
        const { container } = render(
            <MarkdownViewer
                text="![Figure 4.1](lc-asset://missing)"
                assetUrls={assetUrls([['asset-1', 'blob:http://localhost/asset-1']])}
            />,
        );

        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('Figure 4.1')).toBeInTheDocument();
    });

    it('renders a generic placeholder when no asset map is supplied at all', () => {
        const { container } = render(<MarkdownViewer text="![](lc-asset://asset-1)" />);

        expect(container.querySelector('img')).toBeNull();
        expect(screen.getByText('Figure unavailable')).toBeInTheDocument();
    });

    it('leaves non-asset image sources untouched', () => {
        const { container } = render(
            <MarkdownViewer
                text="![Photo](/images/photo.png)"
                assetUrls={assetUrls([['asset-1', 'blob:http://localhost/asset-1']])}
            />,
        );

        expect(container.querySelector('img')?.getAttribute('src')).toBe('/images/photo.png');
    });

    it('renders ordinary markdown with no asset map exactly as before', () => {
        render(<MarkdownViewer text={'# Heading\n\nSome **bold** text.'} />);

        expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
        expect(screen.getByText('bold')).toBeInTheDocument();
    });
});
