import { createContext } from 'react';
import type { Application } from '../bootstrap/createApplication';
import type { Repositories } from '../bootstrap/createRepositories';

/**
 * Application-wide dependency injection context.
 *
 * Supplies both domain repositories and domain application services
 * (e.g. `termService`) to feature hooks, so feature code never imports
 * concrete Dexie implementations directly.
 */
export type ApplicationContextValue = Application & Repositories;

export const ApplicationContext = createContext<ApplicationContextValue | null>(null);
