import AppShell from './app/layouts/AppShell';
import { ReaderScreen } from './features/reader';

export default function App() {
  return (
    <AppShell>
      <ReaderScreen />
    </AppShell>
  );
}
