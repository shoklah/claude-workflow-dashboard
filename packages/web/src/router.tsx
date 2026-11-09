import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './layout/Shell.tsx';

const rootRoute = createRootRoute({
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Placeholder: Task 10 replaces it with the Runs list.

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: () => <h1 className="text-xl font-semibold">Runs</h1>,
});

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, runsRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
