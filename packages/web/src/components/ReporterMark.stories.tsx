import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { informationMark } from '../lib/format.ts';
import { ReporterMark } from './ReporterMark.tsx';

const meta = { component: ReporterMark } satisfies Meta<typeof ReporterMark>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default mark: the dashed badge, titled by its tooltip. */
export const Mark: Story = {
  play: async ({ canvas }) => {
    const mark = canvas.getByText('reporter, all time');
    await expect(mark).toHaveAttribute('title', expect.stringContaining('over everything the reporter reads'));
    await expect(mark).toHaveClass('border-dashed');
  },
};

/** The information lines' mark: the latest export's lines, not an all-time figure. */
export const Information: Story = {
  args: { mark: informationMark },
  play: async ({ canvas }) => {
    const mark = canvas.getByText('reporter');
    await expect(mark).toHaveAttribute('title', expect.stringContaining('not filtered by period'));
    await expect(mark).toHaveClass('border-dashed');
  },
};
