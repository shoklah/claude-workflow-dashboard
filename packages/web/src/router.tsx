import { Outlet, createRootRoute, createRoute, createRouter, redirect, useLocation } from '@tanstack/react-router';
import { toStepKind, type StepKind } from '@cwd/shared';
import { AccountPage } from './account/AccountPage.tsx';
import { CompliancePage } from './compliance/CompliancePage.tsx';
import { ContextPage } from './context/ContextPage.tsx';
import { FindingsPage } from './findings/FindingsPage.tsx';
import { HomePage } from './home/HomePage.tsx';
import { SignInPage } from './hosted/SignInPage.tsx';
import { ErrorPage, NotFoundPage } from './layout/ErrorPages.tsx';
import { Shell } from './layout/Shell.tsx';
import { ModelsPage } from './models/ModelsPage.tsx';
import { RunPage } from './runs/RunPage.tsx';
import { SkillsPage } from './skills/SkillsPage.tsx';
import { SpendPage } from './spend/SpendPage.tsx';
import { StepsPage } from './steps/StepsPage.tsx';
import { WeeksPage } from './weeks/WeeksPage.tsx';
import { ChangePage } from './work/ChangePage.tsx';
import { GoalPage } from './work/GoalPage.tsx';
import { WorkPage, type WorkView } from './work/WorkPage.tsx';

// Every path inside the shell, the not-found and error pages too, except hosted mode's sign-in page, drawn bare.
const rootRoute = createRootRoute({
  component: function Root() {
    const signIn = useLocation({ select: (location) => location.pathname === '/signin' });
    return signIn ? (
      <Outlet />
    ) : (
      <Shell>
        <Outlet />
      </Shell>
    );
  },
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signin',
  validateSearch: (search: Record<string, unknown>): { error?: 'refused' | 'failed' } => ({
    error: search.error === 'refused' || search.error === 'failed' ? search.error : undefined,
  }),
  component: function SignIn() {
    const { error } = signInRoute.useSearch();
    return <SignInPage error={error} />;
  },
});

const accountRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/account',
  component: AccountPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

// Runs and Sessions are views of the Work page: their old paths land there.
const runsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/runs',
  beforeLoad: () => {
    throw redirect({ to: '/work', search: { view: 'runs' } });
  },
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
  beforeLoad: () => {
    throw redirect({ to: '/work', search: { view: 'sessions' } });
  },
});

const contextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/context',
  component: ContextPage,
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

const spendRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/spend',
  component: SpendPage,
});

const weeksRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/weeks',
  component: WeeksPage,
});

const workRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work',
  validateSearch: (search: Record<string, unknown>): { view?: WorkView; session?: string } => ({
    view: search.view === 'runs' || search.view === 'sessions' ? search.view : undefined,
    session: typeof search.session === 'string' && search.session !== '' ? search.session : undefined,
  }),
  component: function Work() {
    const { view, session } = workRoute.useSearch();
    return <WorkPage view={view} session={session} />;
  },
});

const goalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work/goals/$key',
  component: function Goal() {
    return <GoalPage goalKey={goalRoute.useParams().key} />;
  },
});

const changeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/work/changes/$key',
  component: function Change() {
    return <ChangePage changeKey={changeRoute.useParams().key} />;
  },
});

export const router = createRouter({
  // Inside the shell: an address no route answers, and a page that crashed while drawing.
  defaultNotFoundComponent: NotFoundPage,
  defaultErrorComponent: ErrorPage,
  routeTree: rootRoute.addChildren([
    homeRoute,
    runsRoute,
    runRoute,
    findingsRoute,
    sessionsRoute,
    contextRoute,
    complianceRoute,
    stepsRoute,
    skillsRoute,
    modelsRoute,
    spendRoute,
    weeksRoute,
    workRoute,
    goalRoute,
    changeRoute,
    signInRoute,
    accountRoute,
  ]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
