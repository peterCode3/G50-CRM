# G50.Golf Branding

Source logo: `docs/brand/logo-source.png` (transparent PNG, gold mark on a soft teal glow that
fades to transparent — confirmed by sampling the alpha channel, not a solid background).

## Logo variants (generated from the source, `docs/brand/`)

| File | Size | Use |
|---|---|---|
| `logo-source.png` | 1536×1024 | Original — don't edit, regenerate variants from this if needed |
| `logo-horizontal.png` | 818×616 | Tight crop around the full mark (glow + wordmark), transparent bg — used as `apps/web/public/logo.png` and `apps/admin/public/logo.png` for the header |
| `logo-horizontal-240.png` | 319×240 | Smaller pre-sized version of the above, for contexts that don't need the full-res file |
| `logo-mark-square.png` | 1024×1024 | Centered square crop, transparent bg |
| `logo-mark-512.png` | 512×512 | Square icon — used as `apps/web/src/app/icon.png` and `apps/admin/src/app/icon.png` (Next.js favicon/app-icon convention) |
| `logo-mark-32.png` | 32×32 | Small favicon size if a `.ico`-style asset is needed later |

## Color palette (sampled directly from the logo, not guessed)

Defined as CSS variables + Tailwind v4 `@theme` tokens in both apps' `globals.css`
(`apps/web/src/app/globals.css`, `apps/admin/src/app/globals.css`), so they're usable as
Tailwind utilities: `bg-gold-500`, `text-teal-700`, `border-teal-50`, etc.

| Token | Hex | Sampled from | Suggested use |
|---|---|---|---|
| `gold-50` | `#FBF3DE` | derived tint | subtle warm backgrounds |
| `gold-100` | `#F7E395` | bright highlight in wordmark | glow/hover accents, badges |
| `gold-300` | `#D8BE78` | mid-light gold in wordmark | secondary gold accents |
| `gold-500` | `#C8AB68` | primary wordmark gold | **primary brand accent** — buttons, links, active states |
| `gold-700` | `#B28B4A` | bronze edge/shadow in mark | hover/pressed state for gold elements |
| `gold-900` | `#7A5C2E` | derived shade | gold text on light backgrounds (contrast) |
| `teal-50` | `#EAF2F1` | derived tint | page backgrounds, subtle borders |
| `teal-300` | `#A8CBCB` | derived tint | disabled states, light dividers |
| `teal-500` | `#70A1A8` | background glow color | **secondary brand color** — secondary buttons, links |
| `teal-700` | `#4C7378` | derived shade | dark text on light backgrounds, icons |
| `teal-900` | `#2C4548` | derived shade | dark-mode surfaces, admin header background |

`apps/admin`'s header currently uses `bg-teal-900` (dark) with `text-gold-100`, giving the admin
dashboard a distinct, slightly more premium/internal-tool feel vs. the plain white header on
`apps/web`'s public site. Adjust as real UI gets built out — this is a starting point, not a
locked-in design system.

## Regenerating variants

If a new source logo is provided, the crop/resize was done via .NET `System.Drawing` (no image
library needed) — scan the alpha channel for the visible bounding box, crop with padding, resize
with high-quality bicubic interpolation. Ask Claude to redo this against the new source file.
