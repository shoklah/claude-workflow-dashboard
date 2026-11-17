import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { applySystemTheme } from './lib/theme.ts';
import { router } from './router.tsx';
import './index.css';

applySystemTheme();

// The charts measure their text on a canvas in the theme's font, and ECharts keeps every width it measures for the
// page's life: the app renders once that font has loaded, so no chart lays out its labels in a fallback's widths.
await document.fonts.load("12px 'Outfit Variable'").catch(() => undefined);

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
);
