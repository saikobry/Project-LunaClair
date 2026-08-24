/**
 * Options for extracting grounded AI study context from a document.
 */
export interface ContextExtractionOptions {
  maxCharacters?: number;
}

export interface ExtractedContextResult {
  contextText: string;
  sectionHeading?: string;
}

/**
 * Extracts a section-aware grounded context hierarchy from document markdown.
 *
 * Hierarchy:
 * 1. If selected text exists:
 *    Find the containing section header, extract the surrounding paragraph/section,
 *    and combine with the selection.
 * 2. If no selection exists:
 *    Extract the document structure / sections up to maxCharacters budget.
 */
export function extractSectionContext(
  documentMarkdown?: string,
  selectedText?: string,
  options: ContextExtractionOptions = {},
): ExtractedContextResult {
  const { maxCharacters = 3000 } = options;

  if (!documentMarkdown || !documentMarkdown.trim()) {
    return {
      contextText: selectedText ? `Selected text: "${selectedText}"` : '',
    };
  }

  const cleanDoc = documentMarkdown.trim();

  // Case 1: Selection exists — find containing section
  if (selectedText && selectedText.trim()) {
    const trimmedSelection = selectedText.trim();
    const selectionIndex = cleanDoc.indexOf(trimmedSelection);

    let sectionHeading: string | undefined;
    let sectionContent = cleanDoc;

    if (selectionIndex !== -1) {
      // Find the nearest preceding heading (#, ##, ###)
      const docBeforeSelection = cleanDoc.slice(0, selectionIndex);
      const headingMatches = [...docBeforeSelection.matchAll(/^(#{1,4})\s+(.+)$/gm)];
      if (headingMatches.length > 0) {
        const lastHeadingMatch = headingMatches[headingMatches.length - 1];
        sectionHeading = lastHeadingMatch[2].trim();

        // Extract from that heading onward
        const headingIndex = lastHeadingMatch.index ?? 0;
        const fromHeading = cleanDoc.slice(headingIndex);

        // Find next heading after the current heading line
        const newlineIndex = fromHeading.indexOf('\n');
        if (newlineIndex !== -1) {
          const contentAfterHeading = fromHeading.slice(newlineIndex + 1);
          const nextHeadingMatch = contentAfterHeading.search(/^#{1,3}\s+/m);
          if (nextHeadingMatch !== -1) {
            sectionContent = fromHeading.slice(0, newlineIndex + 1 + nextHeadingMatch).trim();
          } else {
            sectionContent = fromHeading.trim();
          }
        } else {
          sectionContent = fromHeading.trim();
        }
      }
    }

    let context = `Section: ${sectionHeading || 'General'}\n\n${sectionContent}`;
    if (context.length > maxCharacters) {
      // Prioritize surrounding excerpt around the selection
      const start = Math.max(0, selectionIndex - 500);
      const end = Math.min(cleanDoc.length, selectionIndex + trimmedSelection.length + 1500);
      context = `Section: ${sectionHeading || 'General'}\n\n...${cleanDoc.slice(start, end)}...`;
    }

    return {
      contextText: context.slice(0, maxCharacters),
      sectionHeading,
    };
  }

  // Case 2: No selection — extract top bounded document context
  if (cleanDoc.length <= maxCharacters) {
    return {
      contextText: cleanDoc,
    };
  }

  return {
    contextText: cleanDoc.slice(0, maxCharacters) + '\n\n[...content truncated to token budget...]',
  };
}
