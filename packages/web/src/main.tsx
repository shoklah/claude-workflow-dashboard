import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { TooltipProvider } from './components/ui/tooltip.tsx';
import { router } from './router.tsx';
import './index.css';

// Direction variants (throwaway): ?direction=<name> picks a look for the whole page.
const direction = new URLSearchParams(window.location.search).get('direction');
if (direction) document.documentElement.dataset.direction = direction;

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
