import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, spyOn, within } from 'storybook/test';
import { SessionChip } from './SessionChip.tsx';

const ID = '7d1e4b2a-9c3f-4a8e-b5d6-1f2e3a4b5c6d';

const meta = {
  component: SessionChip,
  args: { id: ID },
  beforeEach: () => {
    spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
  },
} satisfies Meta<typeof SessionChip>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A chip always has an ID, so it has one data state; hovering and copying are its interactions. */
export const Default: Story = {
  play: async ({ canvas, userEvent }) => {
    const name = canvas.getByText('7d1e4b2a');
    await expect(canvas.queryByText(ID)).toBeNull();

    await userEvent.hover(name);
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(ID);

    await userEvent.click(canvas.getByRole('button', { name: 'Copy session ID' }));
    await expect(navigator.clipboard.writeText).toHaveBeenCalledOnce();
    await expect(navigator.clipboard.writeText).toHaveBeenCalledWith(ID);
    await expect(await canvas.findByText('Copied')).toBeVisible();
  },
};

export const Focused: Story = {
  play: async ({ userEvent }) => {
    await userEvent.tab();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent(ID);
  },
};
