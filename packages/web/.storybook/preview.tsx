import { useState } from 'react';
import type { Preview } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router';
import { TooltipProvider } from '../src/components/ui/tooltip.tsx';
import '../src/index.css';

// Every story gets the app's providers: a fresh query cache that never retries, the tooltips, and a router whose only
// route is the story, so links render, on `/` or on the story's `parameters.path`.
const preview: Preview = {
  decorators: [
    (Story, { parameters }) => {
      const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
      const [router] = useState(() =>
        createRouter({
          routeTree: createRootRoute({ component: Story }),
          history: createMemoryHistory({ initialEntries: [parameters.path ?? '/'] }),
        }),
      );
      return (
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </QueryClientProvider>
      );
    },
  ],
};

export default preview;
