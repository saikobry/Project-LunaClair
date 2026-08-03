import { useRef, type ReactNode } from 'react';
import { ApplicationContext, type ApplicationContextValue } from './ApplicationContext';
import { createApplication } from '../bootstrap/createApplication';

interface ApplicationProviderProps {
  children: ReactNode;
}

/**
 * Provides all domain repositories and application services to feature
 * hooks via React context. Instances are stable singletons that never
 * recreate across re-renders.
 */
export function ApplicationProvider({ children }: ApplicationProviderProps) {
  const ref = useRef<ApplicationContextValue | null>(null);
  if (!ref.current) {
    const application = createApplication();
    ref.current = { ...application, ...application.repositories };
  }

  return (
    <ApplicationContext.Provider value={ref.current}>
      {children}
    </ApplicationContext.Provider>
  );
}
