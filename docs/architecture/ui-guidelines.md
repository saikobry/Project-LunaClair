# UI Guidelines — Project LunaClair

## Layering Architecture

```text
Features
   ↓
shared/components (optional composite)
   ↓
shared/ui (LunaClair Primitives API)
   ↓
Astryx (@astryxdesign/core)
   ↓
StyleX (@stylexjs/stylex)
```

### Layer Rules

1. **Wrap capabilities, not libraries**
   - Expose LunaClair-owned props (`<Button variant="primary">`), never third-party names.
   - Prop naming follows LunaClair conventions, not the underlying library.

2. **Features must never import Astryx directly** ❌
   - All third-party UI imports go through `src/shared/ui/`.

3. **Features must never import third-party UI tokens directly** ❌
   - Astryx token references belong in `shared/ui/` adapters or `src/styles/` only.

4. **Features consume LunaClair primitives from `src/shared/ui/`** ✅
   - Import via `import { Button } from '../../shared/ui'` or direct subpath.

### Persistence & Service Boundaries

5. **Browser storage APIs only in `src/infrastructure/`** ❌
   - `localStorage`, `sessionStorage`, IndexedDB calls belong in infrastructure adapters (`src/infrastructure/browser/storage/`, `src/infrastructure/database/repositories/`), never in features.

6. **Domain layer is pure** ❌
   - No DOM, `window`, `document`, `navigator`, `localStorage`, or browser APIs in `src/domain/`.

7. **Direct-path feature contracts** ✅
   - Features may consume another feature only through the approved direct module paths defined by ADR-010; deep imports into feature internals are prohibited.
   - Domain-specific composites and hooks live in their owning feature, not `src/shared/`.

## Astryx Theme as Single Color Authority

- **Astryx theme variables** (`var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-border)`, etc.) are the single source of truth for colors.
- Global CSS (`src/styles/global.css`) references Astryx theme variables directly — no legacy CSS variable aliases.
- Custom `lunaclairTheme` in `src/shared/theme/` defines the project palette and extends `neutralTheme` for spacing/sizing defaults.

## Thin Adapter Rules

- **Thin adapters**: Wrappers must remain thin — they should not reimplement Astryx functionality.
- **Reuse Astryx capabilities**: Accessibility, keyboard navigation, focus management, disabled states, and ARIA attributes come through transparently.
- **LunaClair wrapper code** should only supply:
  - Prop mapping (LunaClair → Astryx)
  - Defaults and constants
  - LunaClair naming conventions
- **No business logic** inside `shared/ui/` components.
- Maintain composability-friendly props: `className`, `style`, `children`, `aria-*`, `disabled`, `ref`.

## Page Layout Primitive

`Page` is strictly a layout container:
- `title`: Page heading (h1)
- `description`: Optional subtitle
- `actions`: Header action elements (buttons)
- `children`: Page content

Features own their specific page content (search, filtering, breadcrumbs) — do not add those to `Page`.

## Active Primitives

| Primitive | File | Purpose |
|---|---|---|
| `Button` | `shared/ui/Button/` | Button with variant, icon, loading, disabled, aria-* |
| `Card` | `shared/ui/Card/` | Surface container with border/background |
| `Dialog` | `shared/ui/Dialog/` | Modal overlay with focus trap and ESC close |
| `Input` | `shared/ui/Input/` | Text input with label and validation |
| `Page` | `shared/ui/Page/` | Standardized page layout container |

## Design Tokens

- **Astryx theme tokens** provide color, spacing, radius, shadow, and typography via CSS custom properties.
- LunaClair has no separate supplement-token file — use Astryx CSS variables for color, spacing, radius, shadow, and typography, and StyleX for layout. Avoid hardcoded values.

### Semantic Role Vocabulary

**Application code references colour by role via `var(--color-*)`. Literal colour values live only in `src/shared/theme/lunaclairTheme.ts`.** That split is Astryx's own model — the theme is its designated literal layer (`neutralTheme` resolves every component token to a literal too), so a literal in `lunaclairTheme` is idiomatic while the same literal in a component is a leak.

- **Sentiment roles are exactly `--color-{success,error,warning}`** plus their `-muted` and `-on-*` siblings. That is the complete set Astryx defines (`@astryxdesign/core` `colorDefaults`; `@astryxdesign/theme-neutral` `theme.css`).
- **`--color-danger` does not exist and must never be added as an alias.** Astryx's Button variant is `destructive` (action severity, the only place that concept appears); every state-carrying component uses `error` — Banner `variant:info|neutral|success|warning|error`, Badge `variant:success|warning|error|accent`, `status:error` — and resolves through `--color-error`. "danger" is Bootstrap-era vocabulary that leaked in, and a second name for one role is precisely how the roles drift apart.
- **Never rely on a fallback for a role token.** `var(--color-role, #hex)` is safe only when the token is guaranteed defined. An undefined token is *invalid at computed-value time*: the declaration does not degrade to the nearest sibling role, it drops to the inherited/initial value. A bare `var(--color-danger)` silently rendered uncoloured text until Sep 2026.
- **Alpha tints of a role** use `color-mix(in srgb, var(--color-accent) N%, transparent)` — or a matching `--color-overlay-*` token where the value coincides (`--color-overlay-hover` is exactly `rgba(99,102,241,0.08)`) — never a hardcoded `rgba()` from an earlier palette generation.
- **Multi-hue differentiation uses the theme's hue families, not literals.** The theme declares `--color-{text,background,border}-{blue,cyan,gray,green,orange,pink,purple,red,teal,yellow}` (values live in `@astryxdesign/theme-neutral/dist/theme.css`). Distinct-category chips — e.g. `CollectionQuizExplorer`'s Foundations/Apply difficulty chips — differentiate through a family triplet (`teal` / `orange`) instead of inventing per-chip hex values.
- **`collection.color` values are persisted user data**, so Collection/annotation colour derivation (swatches, `tint()`, `heroBackground()`) legitimately stays dynamic and literal-adjacent; it is not a token violation.

### Removal vs Delete Vocabulary

**The verb must match what actually survives the action**, because in LunaClair that is not the same thing for every object.

- **Material removal is `Remove from Library`, never `Delete`.** The cascade is irreversible locally (document, questions and quizzes, stored files, collection membership), but a cloned material's published share is untouched — the Explore hub keeps offering it, so "Delete" would promise something the app cannot deliver. Code matches the copy: `RemoveMaterialUseCase`, `LibraryImportService.removeMaterial`, `useRemoveMaterial`, `RemoveMaterialModal`.
- **Collections are still `Delete`d.** A collection exists only on this device; there is nothing to re-add.
- **Removal from a container is `Remove from {container}`** — `Remove from Collection` drops the membership and says the material stays in the Library.

**A destructive confirmation must name what is deleted and what can be recovered.** `RemoveMaterialModal` is the reference implementation: it enumerates the cascade's scope and then branches on provenance (`originShareId`) — re-cloning from Explore for a cloned material, with the caveat that local edits are not part of the share, and an explicit "cannot be restored" for a material created here. A bare "This action cannot be undone" is not acceptable copy: it was false for the cloned case (Sep 2026) and silent about scope in every case.

## Third-Party Package Boundaries

| Package | Allowed Locations |
|---|---|
| `@astryxdesign/core` | `src/shared/ui/`, `src/shared/theme/`, `src/app/providers/` |
| `@astryxdesign/theme-neutral` | `src/shared/theme/lunaclairTheme.ts` only |
| `@stylexjs/stylex` | Anywhere (build-time, no runtime cost) |
| `lucide-react` | Any feature or shared component |
