import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { StatusBanner } from './StatusBanner.tsx';

const meta = { component: StatusBanner } satisfies Meta<typeof StatusBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

const LAST_GOOD = '2026-11-12T10:00:00.000Z';
const FAILED_AT = '2026-11-12T11:30:00.000Z';
const ERROR = 'workflow-report.py exited 1: ValueError: bad record';

/** Empty: the last import succeeded, so there is nothing to say. */
export const Ok: Story = {
  args: { status: { lastImportAt: LAST_GOOD, lastGoodImportAt: LAST_GOOD, error: null, importing: false } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toBeEmptyDOMElement();
  },
};

/** Full: the last attempt failed; the data shown is from the last good import. */
export const Failed: Story = {
  args: { status: { lastImportAt: FAILED_AT, lastGoodImportAt: LAST_GOOD, error: ERROR, importing: false } },
  play: async ({ canvas }) => {
    const banner = canvas.getByRole('status');
    await expect(banner).toHaveTextContent(/last import failed at/i);
    await expect(banner).toHaveTextContent(ERROR);
    await expect(banner).toHaveTextContent(/data is from the last good import/i);
    await expect(banner.querySelector(`time[datetime="${FAILED_AT}"]`)).not.toBeNull();
    await expect(banner.querySelector(`time[datetime="${LAST_GOOD}"]`)).not.toBeNull();
  },
};

export const NeverImported: Story = {
  args: { status: { lastImportAt: null, lastGoodImportAt: null, error: null, importing: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(/nothing has been imported yet/i);
  },
};

export const FailedBeforeAnyImport: Story = {
  args: { status: { lastImportAt: FAILED_AT, lastGoodImportAt: null, error: ERROR, importing: false } },
  play: async ({ canvas }) => {
    const banner = canvas.getByRole('status');
    await expect(banner).toHaveTextContent(/last import failed at/i);
    await expect(banner).toHaveTextContent(ERROR);
    await expect(banner).toHaveTextContent(/nothing has been imported yet/i);
  },
};
