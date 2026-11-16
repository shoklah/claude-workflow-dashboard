import { createCn } from 'cn/config';

/** `cn` taught the theme's own scales in `index.css` (`rounded-control`, `text-page-title`), so a theme class passed to
 * a shadcn component replaces its default instead of losing to it, and a theme text size isn't taken for a colour.
 * Vite resolves every `import { cn } from 'cn'` here (`vite.config.ts`), the generated components' included. */
export const cn = createCn({
  extend: { theme: { radius: ['panel', 'control', 'swatch'], text: ['page-title', 'section-title'] } },
});
