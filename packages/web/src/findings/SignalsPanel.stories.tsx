import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { findingsEmpty, findingsFull } from '../test/findings.ts';
import { SignalsPanel } from './SignalsPanel.tsx';

const meta = { component: SignalsPanel } satisfies Meta<typeof SignalsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

// The signals' terms, in the approved capture's words.
const SIGNALS = [
  'Fix commits within 14 days after a run',
  'Final review findings on runs whose task reviews came back clean',
  'Fix-check verdicts of "fixed, not proportionate"',
  'Findings declined or ruled',
  'Findings the session judged invalid',
];

/** Each term of the panel's labelled pairs, with its value. */
function pairs(canvasElement: HTMLElement): [string, string][] {
  return [...canvasElement.querySelectorAll('dt')].map((dt) => [dt.textContent!, dt.nextElementSibling!.textContent!]);
}

/** Empty: every signal 0, and no API key, so the labeller is off. */
export const Empty: Story = {
  args: { signals: findingsEmpty.signals, labeller: findingsEmpty.labeller },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'Relevance signals' })).toHaveClass('glass');
    await expect(pairs(canvasElement)).toEqual(SIGNALS.map((signal) => [signal, '0']));
    await expect(canvas.getByText("The labeller is off: the data folder's .env holds no API key.")).toBeVisible();
  },
};

/** Full: the five signals' sums, then the labeller's counts and this week's tokens, each a labelled pair. */
export const Full: Story = {
  args: { signals: findingsFull.signals, labeller: findingsFull.labeller },
  play: async ({ canvas, canvasElement }) => {
    await expect(pairs(canvasElement)).toEqual([
      [SIGNALS[0], '3'],
      [SIGNALS[1], '5'],
      [SIGNALS[2], '4'],
      [SIGNALS[3], '18'],
      [SIGNALS[4], '6'],
      ['Labelled by the app', '8'],
      ['Waiting', '1'],
      ['Labeller tokens this week', '43,350'],
    ]);
    await expect(canvas.queryByText(/The labeller is off/)).toBeNull();
  },
};
