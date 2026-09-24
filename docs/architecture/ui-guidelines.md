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

- **Sentiment roles are exactly `--color-{success,error,warning}`** plus their `-muted` and `-on-*` siblings — the complete set Astryx defines. LunaClair adds the three `-border` outline roles as custom tokens (`CustomRoleTokens` in `lunaclairTheme.ts`), because a bordered muted chip needs an edge that is not its own fill (`@astryxdesign/core` `colorDefaults`; `@astryxdesign/theme-neutral` `theme.css`).
- **`--color-danger` does not exist and must never be added as an alias.** Astryx's Button variant is `destructive` (action severity, the only place that concept appears); every state-carrying component uses `error` — Banner `variant:info|neutral|success|warning|error`, Badge `variant:success|warning|error|accent`, `status:error` — and resolves through `--color-error`. "danger" is Bootstrap-era vocabulary that leaked in, and a second name for one role is precisely how the roles drift apart.
- **Never rely on a fallback for a role token.** `var(--color-role, #hex)` is safe only when the token is guaranteed defined. An undefined token is *invalid at computed-value time*: the declaration does not degrade to the nearest sibling role, it drops to the inherited/initial value. A bare `var(--color-danger)` silently rendered uncoloured text until Sep 2026. There is no legitimate case here either — a client-rendered SPA has no pre-hydration paint where a token could be missing — and a fallback with the *wrong* value is worse than none: `var(--color-background-surface, #17181d)` would paint a dark surface where a light one is expected, the opposite of graceful degradation (removed Sep 2026). **No role-token fallback remains anywhere in the app** — a new `var(--color-x, …)` is a regression, not defensive code. The same sweep exposed the sibling failure: `--color-text-tertiary` never existed in Astryx or the theme, and its fallback silently supplied `#9ca3af` (which turned out to be exactly the app's `--color-text-disabled`) — the invented name was replaced with the real role. A role name that resolves to nothing is equally invisible when it carries no fallback: a bare `var(--color-background)` in `LibraryView` and `ConflictDraftsModal` had never been declared, so it dropped to transparent instead of painting the surface it named (resolved to `--color-background-surface` — the same value those elements were already rendering, since the page body and the Astryx `Dialog` both resolve to it).
- **A border role may legitimately paint a graphic.** Separators (`divider: { height: 1 }`), the vertical rules between toolbar slots, a progress rail, and status dots all express themselves as `backgroundColor: var(--color-border)` / `--color-border-emphasized` — a 1px separator has no better spelling, and `--color-border` *is* the hairline colour. The same applies to a knockout ring that must match the surface it sits on (`border: 2px solid var(--color-background-surface)` around an accent dot) and to a border role drawn through `box-shadow`. Treat these as correct: an audit that flags them is reading the token's name instead of its job.
- **Ink roles are not graphics.** `--color-text-*` describes text and icons; a 2px bar or dot painted from an ink role borrows a role the vocabulary does not provide. The reader's mini-TOC bar was the known instance and now takes `--color-border-emphasized` (resting at 0.6 opacity, solidifying to 1 on hover) — the darkest step of the hairline scale is the hover emphasis, since the wrapper already backgrounds itself. Removing the ink fill also fixed a specificity bug it was hiding: the bar's ink `:hover` rule, being a pseudo-class, outranked the plain `miniBarActive` class and repainted the active accent bar near-black on hover. A border role, or an opacity change, is the fix — never a new ink role. **One exception is deliberate, and it is narrow:** an *interactive control boundary* whose ring is the control's **sole visual affordance** (no fill, no background — just the outline) must clear WCAG 1.4.11's 3:1 non-text contrast, and the border scale cannot (measured on white: `--color-border` 1.27:1, `--color-border-emphasized` 1.47:1, `--color-text-disabled` 2.54:1), so `CorrectAnswerIndicator`'s unselected ring uses `--color-text-secondary` (5.73:1). Contrast is a property of the value, not of the token's name — a border role carrying a hairline value is the wrong answer for a control outline. Do **not** mint a `--color-border-control` alias for it: two names for one value is the synonym problem the `--color-danger` rule forbids. Re-evaluate the exception if the control gains a filled state, since the ring then becomes secondary and the border scale may be enough.
- **Completing an actively-consumed scale is legitimate without a consumer; speculative tokens are not.** A missing sibling in a family the app uses everywhere gets added before its first caller, because the alternative is that caller reaching for the wrong role (`--color-error-border` completes success/warning/error). A role for a surface the app does not have is still refused — `--color-background-code-block` was rejected because no block surface existed to paint with it.
- **A `-muted` fill is not a border.** The trio now carries its own outline roles — `--color-{success,warning,error}-border` — so a tinted chip's edge never borrows the `-muted` fill it sits on (the offline pill is the case that forced it: a white pill with a warning edge). The success pair is the sourcing model: a 100-shade fill (`#dcfce7`) with a 200-shade outline (`#bbf7d0`). Error's fill is a 50-shade (`#fef2f2`), so its outline takes the first *visible* step (red-200, `#fecaca`) rather than a 100-shade that would vanish at 1px. `--color-error-border` has no consumer yet — it completes the scale so the next error chip does not reach for the fill.
- **Alpha tints of a role** use `color-mix(in srgb, var(--color-accent) N%, transparent)` — or a matching `--color-overlay-*` token where the value coincides (`--color-overlay-hover` is exactly `rgba(99,102,241,0.08)`) — never a hardcoded `rgba()` from an earlier palette generation.
- **Multi-hue differentiation uses the theme's hue families, not literals.** The theme declares `--color-{text,background,border}-{blue,cyan,gray,green,orange,pink,purple,red,teal,yellow}` (values live in `@astryxdesign/theme-neutral/dist/theme.css`). Distinct-category chips — e.g. `CollectionQuizExplorer`'s Foundations/Apply difficulty chips — differentiate through a family triplet (`teal` / `orange`) instead of inventing per-chip hex values.
- **Code, chat, and badge each own a distinct family.** `--color-background-code` / `--color-text-code` / `--color-text-code-link` / `--color-background-code-inline` dress code rendering in the reader and the writer (`#282c34` is the canonical dark surface — the writer's `#0f172a` converged onto it, so the two surfaces cannot drift). Assistant chat bubbles are a different semantic context and therefore use their own `--color-background-chat-assistant` / `--color-text-chat-assistant` instead of borrowing the code family. Badges resolve through per-hue pairs — `--color-badge-{blue,violet,teal,amber,pink}-{bg,fg}` — because a colour is a visual category a future surface may reuse, so the name is the hue and never the question type. Syntax-highlight palettes stay deliberately untokenized: a highlighter theme is a self-contained bundle, and per-role syntax tokens would be a vocabulary nobody maintains.
- **`collection.color` values are persisted user data**, so Collection/annotation colour derivation (swatches, `tint()`, `heroBackground()`) legitimately stays dynamic and literal-adjacent; it is not a token violation.

### Removal vs Delete Vocabulary

**The verb must match what actually survives the action**, because in LunaClair that is not the same thing for every object.

- **Material removal is `Remove from Library`, never `Delete`.** The cascade is irreversible locally (document, questions and quizzes, stored files, collection membership), but a cloned material's published share is untouched — the Explore hub keeps offering it, so "Delete" would promise something the app cannot deliver. Code matches the copy: `RemoveMaterialUseCase`, `LibraryImportService.removeMaterial`, `useRemoveMaterial`, `RemoveMaterialModal`.
- **Collections are still `Delete`d.** A collection exists only on this device; there is nothing to re-add.
- **Removal from a container is `Remove from {container}`** — `Remove from Collection` drops the membership and says the material stays in the Library.
- **AI conversations are `Delete`d.** A session exists only on this device and nothing outside it can re-create it, so the copy says `Delete this conversation` / `Delete every conversation?` — the same class as collections, not materials. Starting a new chat never deletes one: `New chat` leaves every earlier conversation in the history panel.

**A destructive confirmation must name what is deleted and what can be recovered.** `RemoveMaterialModal` is the reference implementation: it enumerates the cascade's scope and then branches on provenance (`originShareId`) — re-cloning from Explore for a cloned material, with the caveat that local edits are not part of the share, and an explicit "cannot be restored" for a material created here. A bare "This action cannot be undone" is not acceptable copy: it was false for the cloned case (Sep 2026) and silent about scope in every case.

## Third-Party Package Boundaries

| Package | Allowed Locations |
|---|---|
| `@astryxdesign/core` | `src/shared/ui/`, `src/shared/theme/`, `src/app/providers/` |
| `@astryxdesign/theme-neutral` | `src/shared/theme/lunaclairTheme.ts` only |
| `@stylexjs/stylex` | Anywhere (build-time, no runtime cost) |
| `lucide-react` | Any feature or shared component |
