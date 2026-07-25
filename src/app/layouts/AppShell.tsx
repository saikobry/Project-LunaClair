import type { ReactNode } from 'react';
import './AppShell.css';

interface AppShellProps {
  children: ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="app-shell">
      <main className="app-main">{children}</main>
    </div>
  );
}
