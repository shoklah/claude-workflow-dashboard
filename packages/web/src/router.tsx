import { Outlet, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { toStepKind, type StepKind } from '@cwd/shared';
import { CompliancePage } from './compliance/CompliancePage.tsx';
import { FindingsPage } from './findings/FindingsPage.tsx';
import { HomePage } from './home/HomePage.tsx';
import { Shell } from './layout/Shell.tsx';
import { ModelsPage } from './models/ModelsPage.tsx';
import { RunPage } from './runs/RunPage.tsx';
import { RunsPage } from './runs/RunsPage.tsx';
import { SessionsPage } from './sessions/SessionsPage.tsx';
import { SkillsPage } from './skills/SkillsPage.tsx';
import { StepsPage } from './steps/StepsPage.tsx';
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

const sessionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sessions',
  component: SessionsPage,
});

const complianceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compliance',
  validateSearch: (search: Record<string, unknown>): { step?: StepKind } => ({ step: toStepKind(search.step) }),
  component: function Compliance() {
    const { step } = complianceRoute.useSearch();
    // Keyed by step, so a step changed by Back or Forward starts the page afresh, with no stale selection.
    return <CompliancePage key={step ?? ''} step={step} />;
  },
});

const stepsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/steps',
  component: StepsPage,
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/skills',
  component: SkillsPage,
});

const modelsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/models',
  component: ModelsPage,
});

const weeksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/weeks',
  component: WeeksPage,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([
    homeRoute,
    runsRoute,
    runRoute,
    findingsRoute,
    sessionsRoute,
    complianceRoute,
    stepsRoute,
    skillsRoute,
    modelsRoute,
    weeksRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
