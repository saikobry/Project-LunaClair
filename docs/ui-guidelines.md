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
   - Expose LunaClair-owned props (`<Button variant="primary">`), never third-party names (`astryxVariant="primary"`).
   - Prop naming follows LunaClair conventions, not the underlying library.

2. **Features must never import Astryx directly** ❌
   - All third-party UI imports go through `src/shared/ui/`.

3. **Features must never import third-party UI tokens directly** ❌
   - Astryx token references belong in `shared/ui/` adapters only.

4. **Features consume LunaClair primitives from `@/shared/ui`** ✅
   - Import via `import { Button } from '../../shared/ui'` or direct path.

## Thin Adapter Rules

- **Thin adapters**: Wrappers must remain thin — they should not reimplement Astryx functionality.
- **Reuse Astryx capabilities**: Accessibility, keyboard navigation, focus management, disabled states, and ARIA attributes come through from Astryx transparently.
- **LunaClair wrapper code** should only supply:
  - Prop mapping (LunaClair → Astryx)
  - Defaults and constants
  - LunaClair naming conventions
- **No business logic** inside `shared/ui/` components.

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
| `Button` | `shared/ui/Button/` | Button with variant, icon, loading, disabled |
| `Card` | `shared/ui/Card/` | Surface container with border/background |
| `Dialog` | `shared/ui/Dialog/` | Modal overlay with focus trap and ESC close |
| `Input` | `shared/ui/Input/` | Text input with label and validation |
| `Page` | `shared/ui/Page/` | Standardized page layout container |

## Design Tokens

- **Astryx theme tokens** provide color, spacing, radius, shadow, and typography via CSS custom properties (`--color-*`, `--spacing-*`, etc.).
- **`shared/styles/tokens.stylex.ts`** contains minimal LunaClair supplement tokens for spacing, radius, shadows, and transitions not covered by Astryx.
- Feature styles should use Astryx CSS variables and StyleX. Avoid hardcoded values.
