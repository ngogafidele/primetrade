# UI Tokens

PrimeTrade uses Tailwind CSS v4 with shadcn/radix-nova CSS variables. Tokens are defined in `app/globals.css` with `@theme inline` mapping Tailwind utilities to CSS custom properties.

Do not introduce a `tailwind.config.ts` for colors. New theme values belong in `app/globals.css`.

---

## Current Theme Mapping

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-geist-mono);
  --font-heading: var(--font-sans);

  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);

  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
}
```

---

## Light Theme Values

```css
:root {
  --background: oklch(0.985 0.012 255);
  --foreground: oklch(0.2 0.035 258);
  --card: oklch(0.996 0.006 255);
  --card-foreground: oklch(0.18 0.035 258);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.18 0.035 258);
  --primary: oklch(0.46 0.18 260);
  --primary-foreground: oklch(0.99 0.004 255);
  --secondary: oklch(0.94 0.035 255);
  --secondary-foreground: oklch(0.27 0.09 258);
  --muted: oklch(0.955 0.018 255);
  --muted-foreground: oklch(0.47 0.04 258);
  --accent: oklch(0.84 0.16 82);
  --accent-foreground: oklch(0.25 0.07 258);
  --destructive: oklch(0.58 0.22 27);
  --border: oklch(0.89 0.027 255);
  --input: oklch(0.91 0.024 255);
  --ring: oklch(0.56 0.18 260);
  --chart-1: oklch(0.5 0.18 260);
  --chart-2: oklch(0.6 0.22 28);
  --chart-3: oklch(0.82 0.16 82);
  --chart-4: oklch(0.64 0.12 230);
  --chart-5: oklch(0.42 0.14 275);
  --radius: 0.8rem;
}
```

---

## Color Usage

| Element | Token/classes |
| --- | --- |
| Page background | `bg-background text-foreground` |
| Card shell | `bg-card text-card-foreground border-border` |
| Primary action | `bg-primary text-primary-foreground` |
| Secondary action | `bg-secondary text-secondary-foreground` |
| Muted labels | `text-muted-foreground` |
| Destructive actions/errors | `text-destructive`, `bg-destructive/10` |
| Sidebar shell | `bg-sidebar border-sidebar-border` |
| Sidebar active | `bg-primary text-primary-foreground` |
| Sidebar hover | `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground` |
| Input border/focus | `border-input`, `focus-visible:border-ring`, `focus-visible:ring-ring/50` |
| Chart color set | `chart-1` through `chart-5` |

---

## Typography

Fonts:

- Sans: Geist via `next/font/google`, exposed as `--font-geist-sans` and mapped to `--font-sans`.
- Mono: Geist Mono, exposed as `--font-geist-mono`.

Common type patterns:

| Usage | Classes |
| --- | --- |
| Header eyebrow | `text-xs uppercase tracking-[0.2em] text-muted-foreground` |
| Page title | `text-2xl font-semibold` |
| Section heading | `text-lg font-semibold` |
| Body/table text | `text-sm` |
| Secondary helper text | `text-xs text-muted-foreground` |
| Card metric value | `text-2xl font-semibold` |

---

## Spacing And Radius

| Usage | Classes |
| --- | --- |
| App shell max width | `max-w-[96rem]` |
| Page gutters | `px-3 sm:px-4 lg:px-5` |
| Main content shell | `rounded-2xl border border-border/80 bg-card/95 p-3 sm:p-4` |
| Sidebar shell | `rounded-2xl p-3` |
| Cards | `rounded-2xl border border-border/80 bg-card p-4 shadow-sm` |
| Buttons/inputs | `rounded-lg` |
| Header user chip | `rounded-xl border border-border bg-background px-3 py-2` |

---

## Shadows And Backgrounds

Use restrained operational surfaces:

- `shadow-sm` for cards, sidebar, and controls.
- `backdrop-blur-sm` for translucent layout shells.
- Body background uses two radial gradients from primary/accent tokens.

Avoid decorative one-off gradients inside business cards unless they are already established in `app/globals.css`.

---

## Current Exceptions

These files currently use raw hex dashboard/report metric card backgrounds:

- `components/dashboard/dashboard-stats.tsx`
- `app/(dashboard)/reports/page.tsx`

Shared raw classes:

- `bg-[#BFDBFE]`
- `bg-[#FEF3C7]`

Prefer token-driven replacements in future work instead of adding more raw hex classes.

---

## Invariants

- Prefer token classes over raw Tailwind colors.
- Use existing `Button`, `Input`, `Dialog`, `Table`, and `Select` primitives before custom controls.
- Do not introduce a separate color system.
- Keep operational screens dense, readable, and scannable.
- Cost/profit warning colors must remain visually distinct and readable.
