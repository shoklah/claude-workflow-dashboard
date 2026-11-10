import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { findingsEmpty, findingsFull } from '../test/findings.ts';
import { SignalsPanel } from './SignalsPanel.tsx';

const meta = { component: SignalsPanel } satisfies Meta<typeof SignalsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const SIGNALS = [
  'fix commits within 14 days after a run',
  'final-review findings on runs whose task reviews came back clean',
  'fix-check verdicts of "fixed, not proportionate"',
  'findings declined or ruled',
];

/** Empty: no signal in the period, and no API key, so the labeller is off. */
export const Empty: Story = {
  args: { signals: findingsEmpty.signals, labeller: findingsEmpty.labeller },
  play: async ({ canvas }) => {
    for (const signal of SIGNALS) await expect(canvas.getByRole('group', { name: signal })).toHaveTextContent(`0${signal}`);
    await expect(canvas.getByText('Labeller off: no API key')).toBeVisible();
  },
};

/** Full: the four signals' sums, the session's invalid calls, and the labeller's counts and this week's tokens. */
export const Full: Story = {
  args: { signals: findingsFull.signals, labeller: findingsFull.labeller },
  play: async ({ canvas }) => {
    const values = SIGNALS.map((signal) => canvas.getByRole('group', { name: signal }).textContent);
    await expect(values.slice(0, 3)).toEqual(SIGNALS.slice(0, 3).map((signal, i) => `${[3, 5, 4][i]}${signal}`));
    // Beside "declined or ruled", the findings the session judged invalid.
    await expect(values[3]).toBe('18findings declined or ruled · 6 judged invalid by the session');
    await expect(canvas.getByText('8 labelled · 1 waiting · 43,350 tokens this week')).toBeVisible();
  },
};
