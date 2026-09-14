/**
 * Membership lens applied to the library materials list.
 *
 * - `all`         — every material (the default)
 * - `collected`   — belongs to at least one collection
 * - `uncollected` — belongs to no collection
 *
 * Owned by the materials feature (it filters the materials list); the routing
 * layer consumes it so the URL contract and the view stay in sync.
 */
export type MaterialMembershipFilter = 'all' | 'collected' | 'uncollected';

export const MATERIAL_MEMBERSHIP_FILTERS: readonly MaterialMembershipFilter[] = [
  'all',
  'collected',
  'uncollected',
];

/** Narrows an untrusted query-string value to a valid filter. */
export function isMaterialMembershipFilter(value: unknown): value is MaterialMembershipFilter {
  return value === 'all' || value === 'collected' || value === 'uncollected';
}
