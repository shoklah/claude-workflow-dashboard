import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { mockApi } from '../test/mock-api.ts';
import { RefreshButton } from './RefreshButton.tsx';

const meta = {
  component: RefreshButton,
  beforeEach: () => {
    mockApi({ '/api/refresh': 202 });
  },
} satisfies Meta<typeof RefreshButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {
  args: { importing: false },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Refresh' }));
    await expect(fetch).toHaveBeenCalledOnce();
    await expect(fetch).toHaveBeenCalledWith('/api/refresh', {
      method: 'POST',
      headers: { 'X-Dashboard-Refresh': '1' },
    });
  },
};

export const Importing: Story = {
  args: { importing: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /importing/i })).toBeDisabled();
  },
};
