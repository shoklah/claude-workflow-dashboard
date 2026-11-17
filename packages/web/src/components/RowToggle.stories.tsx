import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';
import { RowToggle } from './RowToggle.tsx';

const meta = { component: RowToggle, args: { open: false, onToggle: fn(), children: 'Review' } } satisfies Meta<typeof RowToggle>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Closed: a button named by its row, not expanded, that calls `onToggle`; its name underlined as a link. */
export const Closed: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Review' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.getByText('Review')).toHaveClass('underline');
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledOnce();
  },
};

/** Open, with a mark before its name. */
export const Open: Story = {
  args: { open: true, before: <i data-testid="mark" /> },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Review' });
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(button).toContainElement(canvas.getByTestId('mark'));
  },
};

/** With a link beside it (a goal's section): the chevron alone is the button, named by the link, which stays outside
 * the button. */
export const WithLink: Story = {
  args: { children: undefined, link: <a href="/work/goals/g1">Offline sync</a> },
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Offline sync' });
    const link = canvas.getByRole('link', { name: 'Offline sync' });
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).not.toContainElement(link);
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledOnce();
  },
};
