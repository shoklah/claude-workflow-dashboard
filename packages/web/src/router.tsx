import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { FindingsPage } from './findings/FindingsPage.tsx';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './layout/Shell.tsx';
import { RunPage } from './runs/RunPage.tsx';
import { RunsPage } from './runs/RunsPage.tsx';
import { StepsPage } from './steps/StepsPage.tsx';
import { WeeksPage } from './weeks/WeeksPage.tsx';
import { SkillsPage } from './skills/SkillsPage.tsx';

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

const stepsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/steps',
  component: StepsPage,
});

const weeksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/weeks',
  component: WeeksPage,
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills',
  component: SkillsPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([homeRoute, runsRoute, runRoute, findingsRoute, stepsRoute, skillsRoute, weeksRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
