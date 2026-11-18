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

/** A name that wraps keeps its chevron on its first line, as the chevron-only form sits. */
export const Wraps: Story = {
  args: { children: 'A long name that wraps onto a second line' },
  decorators: [(Story) => <div style={{ width: 120 }}><Story /></div>],
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button');
    const name = button.lastElementChild!.getBoundingClientRect();
    const chevron = button.querySelector('svg')!.getBoundingClientRect();
    const line = parseFloat(getComputedStyle(button).lineHeight);
    await expect(name.height).toBeGreaterThan(line * 1.5);
    await expect(chevron.bottom).toBeLessThanOrEqual(name.top + line + 1);
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
    // On the backdrop (a goal's section), the chevron is in primary ink.
    await expect(button.querySelector('svg')).not.toHaveClass('text-muted-foreground');
    await userEvent.click(button);
    await expect(args.onToggle).toHaveBeenCalledOnce();
  },
};
