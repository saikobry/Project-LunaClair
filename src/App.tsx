import { useEffect, useState } from 'react';
import AppShell from './app/layouts/AppShell';
import { AppProviders } from './app/providers/AppProviders';
import { bootstrapApplication } from './app/bootstrap';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapApplication().then(() => setReady(true));
  }, []);

  if (!ready) {
    return null;
  }

  return (
    <AppProviders>
      <AppShell />
    </AppProviders>
  );
}
