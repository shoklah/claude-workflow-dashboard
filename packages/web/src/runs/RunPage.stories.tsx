import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import type { StatusResponse } from '@cwd/shared';
import { mockApi } from '../test/mock-api.ts';
import { fullRun, oldRun, runBeforeSteps, runFull } from '../test/run-fixtures.ts';
import { RunPage } from './RunPage.tsx';

const meta = { component: RunPage, args: { runKey: fullRun.key } } satisfies Meta<typeof RunPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const AT = '2026-11-12T10:00:00.000Z';
const status: StatusResponse = { lastImportAt: AT, lastGoodImportAt: AT, error: null, importing: false };

/** The key goes into the API's path URL-encoded. */
export const Loading: Story = {
  args: { runKey: 'odd key/1' },
  beforeEach: () => {
    mockApi({ '/api/status': status, '/api/runs/odd%20key%2F1': 'pending' });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Loading the run…')).toBeVisible();
    await expect(fetch).toHaveBeenCalledWith('/api/runs/odd%20key%2F1');
  },
};

export const Failed: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: 404 });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText("Couldn't load this run.")).toBeVisible();
  },
};

/** Empty: a record from before steps, with no skills, models, advisor notes or warnings. */
export const Empty: Story = {
  args: { runKey: oldRun.key },
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${oldRun.key}`]: runBeforeSteps });
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'quarry · feat/import' })).toBeVisible();
    await expect(canvas.getByText(/recorded before steps were logged/i)).toBeVisible();
    for (const name of ['Skills', 'Models', 'Advisor', 'Warnings']) {
      await expect(within(canvas.getByRole('region', { name })).getByText('None')).toBeVisible();
    }
  },
};

/** Full: the header, the timeline, and the run's skills, models, advisor notes and warnings. */
export const Full: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(await canvas.findByRole('heading', { name: 'atlas · feat/search' })).toBeVisible();
    const header = canvasElement.querySelector('dl')!;
    await expect(header).toHaveTextContent('full · 1');
    await expect(header).toHaveTextContent('2 h 10');
    await expect(header).toHaveTextContent('$7.10');
    await expect(header).toHaveTextContent('6 · 5 closed');

    const skills = within(canvas.getByRole('region', { name: 'Skills' }));
    await expect(skills.getByText('subagent-driven-development')).toBeVisible();
    await expect(skills.getByText('applied 1, skipped 0')).toBeVisible();
    const models = within(canvas.getByRole('region', { name: 'Models' }));
    await expect(models.getByText('claude-opus-5-5')).toBeVisible();
    await expect(models.getByText('$5.20')).toBeVisible();
    await expect(canvas.getByRole('region', { name: 'Advisor' })).toHaveTextContent('3 calls · 3 notes');
    const warnings = within(canvas.getByRole('region', { name: 'Warnings' }));
    await expect(warnings.getByText('0f1e2d3c')).toBeVisible();
    await expect(warnings.getByRole('button', { name: 'Copy session ID' })).toBeVisible();
  },
};

/** The toggle switches between the timeline and every finding in one table. */
export const Toggle: Story = {
  beforeEach: () => {
    mockApi({ '/api/status': status, [`/api/runs/${fullRun.key}`]: runFull });
  },
  play: async ({ canvas, userEvent }) => {
    await expect(await canvas.findByText('Started')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();

    await userEvent.click(canvas.getByRole('tab', { name: 'Findings' }));
    await expect(canvas.getByRole('table')).toBeVisible();
    await expect(canvas.queryByText('Started')).toBeNull();

    await userEvent.click(canvas.getByRole('tab', { name: 'Timeline' }));
    await expect(canvas.getByText('Started')).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
