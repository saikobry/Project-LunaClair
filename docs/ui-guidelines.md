# UI Guidelines — Project LunaClair

## Layering Architecture

```
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

5. **Browser storage APIs only in `src/services/storage/`** ❌
   - `localStorage`, `sessionStorage`, IndexedDB calls belong in service abstractions, never in features.

6. **Domain layer is pure** ❌
   - No DOM, `window`, `document`, `navigator`, `localStorage`, or browser APIs in `src/domain/`.

7. **No cross-feature imports** ❌
   - Features never import from other features. Shared code lives in `src/shared/`.

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
- **`shared/styles/tokens.stylex.ts`** contains minimal LunaClair supplement tokens not covered by Astryx (reserved for future use — currently 9 tokens unused by active components).
- Feature styles should use Astryx CSS variables and StyleX. Avoid hardcoded values.

## Third-Party Package Boundaries

| Package | Allowed Locations |
|---|---|
| `@astryxdesign/core` | `src/shared/ui/`, `src/shared/theme/`, `src/app/providers/` |
| `@astryxdesign/theme-neutral` | `src/shared/theme/lunaclairTheme.ts` only |
| `@stylexjs/stylex` | Anywhere (build-time, no runtime cost) |
| `lucide-react` | Any feature or shared component |
