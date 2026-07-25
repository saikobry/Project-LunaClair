import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../domain/library';
import type { Document } from '../../domain/reader';
import LibraryScreen from '../../features/library/LibraryScreen';
import { ReaderScreen } from '../../features/reader';
import { useTouchMaterial } from '../../features/library/hooks/mutations/useTouchMaterial';
import { contentService } from '../../services/content/contentService';

const styles = stylex.create({
  shell: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100svh',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  loading: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6b6375',
    fontSize: 14,
  },
});

type Screen = 'library' | 'reader';

export default function AppShell() {
  const [activeScreen, setActiveScreen] = useState<Screen>('library');
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const touchMutation = useTouchMaterial();

  const handleOpenMaterial = useCallback(
    async (material: StudyMaterial) => {
      setIsLoading(true);
      try {
        // Record that the material was opened
        touchMutation.mutate(material.id);

        // Resolve the document content
        const document = await contentService.resolveDocument(material);
        setActiveDocument(document);
        setActiveScreen('reader');
      } catch (err) {
        console.error('Failed to open material:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [touchMutation],
  );

  const handleBackToLibrary = useCallback(() => {
    setActiveDocument(null);
    setActiveScreen('library');
  }, []);

  return (
    <div {...stylex.props(styles.shell)}>
      <main {...stylex.props(styles.main)}>
        {isLoading ? (
          <div {...stylex.props(styles.loading)}>Loading document...</div>
        ) : activeScreen === 'library' ? (
          <LibraryScreen onOpenMaterial={handleOpenMaterial} />
        ) : (
          <ReaderScreen document={activeDocument} onBackToLibrary={handleBackToLibrary} />
        )}
      </main>
    </div>
  );
}
