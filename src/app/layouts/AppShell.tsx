import { useState, useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import type { StudyMaterial } from '../../domain/library';
import LibraryScreen from '../../features/library/LibraryScreen';
import { ReaderScreen } from '../../features/reader';
import { useTouchMaterial } from '../../features/library/hooks/mutations/useTouchMaterial';

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
});

type Screen = 'library' | 'reader';

export default function AppShell() {
  const [activeScreen, setActiveScreen] = useState<Screen>('library');
  const [activeMaterial, setActiveMaterial] = useState<StudyMaterial | null>(null);

  const touchMutation = useTouchMaterial();

  const handleOpenMaterial = useCallback(
    (material: StudyMaterial) => {
      touchMutation.mutate(material.id);
      setActiveMaterial(material);
      setActiveScreen('reader');
    },
    [touchMutation],
  );

  const handleBackToLibrary = useCallback(() => {
    setActiveMaterial(null);
    setActiveScreen('library');
  }, []);

  return (
    <div {...stylex.props(styles.shell)}>
      <main {...stylex.props(styles.main)}>
        {activeScreen === 'library' || !activeMaterial ? (
          <LibraryScreen onOpenMaterial={handleOpenMaterial} />
        ) : (
          <ReaderScreen material={activeMaterial} onBackToLibrary={handleBackToLibrary} />
        )}
      </main>
    </div>
  );
}
