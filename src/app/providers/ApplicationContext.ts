import { createContext } from 'react';
import type { Application } from '../bootstrap/createApplication';

/**
 * Application-wide dependency injection context.
 *
 * Supplies structured infrastructure (repositories, services, transports, providers)
 * and application use cases to feature hooks, so feature code never imports
 * concrete Dexie implementations directly.
 */
export type ApplicationContextValue = Application;

export const ApplicationContext = createContext<ApplicationContextValue | null>(null);
