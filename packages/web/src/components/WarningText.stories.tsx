import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { WarningText } from './WarningText.tsx';

const meta = { component: WarningText } satisfies Meta<typeof WarningText>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: a warning that names no session is its sentence alone, with no chip. */
export const NoSession: Story = {
  args: { text: 'fix/retry-backoff (2026-10-21): no session transcript found', sessionId: null, branch: null },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement).toHaveTextContent('fix/retry-backoff (2026-10-21): no session transcript found');
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};

/** The run's own branch given: its "branch (date):" lead is gone, as the run's page already names it. */
export const OwnBranch: Story = {
  args: { text: 'fix/retry-backoff (2026-10-21): no session transcript found', sessionId: null, branch: 'fix/retry-backoff' },
  play: async ({ canvasElement }) => {
    await expect(canvasElement).toHaveTextContent(/^No session transcript found$/);
  },
};

/** Full: no "WARN:" prefix, and the session trails on its own line after the sentence, never inside it. */
export const WithSession: Story = {
  args: {
    text: 'WARN: session {session}: startup guidelines missing',
    sessionId: '7d1e4b2a-9c3f-4a8e-b5d6-1f2e3a4b5c6d',
    branch: null,
  },
  play: async ({ canvasElement, canvas }) => {
    await expect(canvasElement).not.toHaveTextContent('WARN:');
    await expect(canvasElement).not.toHaveTextContent('{session}');
    const sentence = canvas.getByText('Startup guidelines missing');
    const chip = canvas.getByText('7d1e4b2a');
    await expect(sentence).not.toContainElement(chip);
    const line = sentence.nextElementSibling;
    await expect(line).toContainElement(chip);
    await expect(line).toHaveTextContent(/^Session 7d1e4b2a/);
    await expect(canvas.getByRole('button', { name: 'Copy session ID' })).toBeVisible();
  },
};
