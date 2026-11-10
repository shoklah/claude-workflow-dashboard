import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { FindingsPage } from './findings/FindingsPage.tsx';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './layout/Shell.tsx';
import { RunPage } from './runs/RunPage.tsx';
import { RunsPage } from './runs/RunsPage.tsx';
import { WeeksPage } from './weeks/WeeksPage.tsx';

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

const findingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/findings',
  component: FindingsPage,
});

const weeksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/weeks',
  component: WeeksPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, runsRoute, runRoute, findingsRoute, weeksRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
