import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './layout/Shell.tsx';
import { RunPage } from './runs/RunPage.tsx';
import { RunsPage } from './runs/RunsPage.tsx';

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

const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  component: RunsPage,
});

const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs/$key',
  component: function Run() {
    return <RunPage runKey={runRoute.useParams().key} />;
  },
});

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute, runsRoute, runRoute]) });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
