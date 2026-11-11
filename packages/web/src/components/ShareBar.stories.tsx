import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ShareBar } from './ShareBar.tsx';

const meta = { component: ShareBar } satisfies Meta<typeof ShareBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: a share that isn't known reads as a dash. */
export const Empty: Story = {
  args: { share: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('–')).toBeVisible();
  },
};

/** Full: an unrounded share reads as a whole percent beside its bar. */
export const Full: Story = {
  args: { share: 52.4 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('52%')).toBeVisible();
  },
};
