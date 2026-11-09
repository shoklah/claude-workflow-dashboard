import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { WarningText } from './WarningText.tsx';

const meta = { component: WarningText } satisfies Meta<typeof WarningText>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: a warning that names no session is its text as is. */
export const NoSession: Story = {
  args: { text: 'fix/retry-backoff (2026-10-21): no session transcript found', sessionId: null },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement).toHaveTextContent('fix/retry-backoff (2026-10-21): no session transcript found');
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/** Full: `{session}` becomes the session's chip, in place. */
export const WithSession: Story = {
  args: {
    text: 'session {session}: startup guidelines missing',
    sessionId: '7d1e4b2a-9c3f-4a8e-b5d6-1f2e3a4b5c6d',
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement).toHaveTextContent(/^session 7d1e4b2a\s*: startup guidelines missing$/);
    await expect(canvas.getByRole('button', { name: 'Copy session ID' })).toBeVisible();
    await expect(canvasElement).not.toHaveTextContent('{session}');
  },
};
