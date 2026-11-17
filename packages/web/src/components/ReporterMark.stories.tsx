import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { informationMark } from '../lib/format.ts';
import { TERM } from './Panel.tsx';
import { ReporterMark } from './ReporterMark.tsx';

const meta = { component: ReporterMark } satisfies Meta<typeof ReporterMark>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default mark: muted text with a dotted underline, never a badge, titled by its tooltip. */
export const Mark: Story = {
  play: async ({ canvas, userEvent }) => {
    const mark = canvas.getByText('reporter, all time');
    await expect(mark).toHaveClass(...TERM.split(' '));
    await userEvent.tab();
    await expect(mark).toHaveFocus();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('over everything the reporter reads');
  },
};

/** The information lines' mark: the latest export's lines, not an all-time figure. */
export const Information: Story = {
  args: { mark: informationMark },
  play: async ({ canvas, userEvent }) => {
    const mark = canvas.getByText('reporter');
    await expect(mark).toHaveClass(...TERM.split(' '));
    await userEvent.tab();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('not filtered by period');
  },
};
