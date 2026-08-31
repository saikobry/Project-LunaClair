import { useState, type ReactNode } from 'react';
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
  const [value] = useState<ApplicationContextValue>(() => {
    const application = createApplication();
    return { ...application, ...application.repositories };
  });

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}
