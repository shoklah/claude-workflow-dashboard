import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ReporterMark } from './ReporterMark.tsx';

const meta = { component: ReporterMark } satisfies Meta<typeof ReporterMark>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Its one state: the dashed mark, titled by its tooltip. */
export const Mark: Story = {
  play: async ({ canvas }) => {
    const mark = canvas.getByText('reporter, all time');
    await expect(mark).toHaveAttribute('title', expect.stringContaining('over everything the reporter reads'));
    await expect(mark).toHaveClass('border-dashed');
  },
};
