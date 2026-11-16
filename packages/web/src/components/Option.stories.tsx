import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Option } from './Option.tsx';

const meta = { component: Option, args: { pressed: false, onClick: fn(), children: 'Raised' } } satisfies Meta<typeof Option>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The switch's value: a filled pill, pressed. */
export const Pressed: Story = {
  args: { pressed: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Raised' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveClass('rounded-control');
  },
};

/** Another value: an outlined pill that calls `onClick`. */
export const NotPressed: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Raised' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveClass('rounded-control');
    await userEvent.click(button);
    await expect(args.onClick).toHaveBeenCalledOnce();
  },
};

/** Not available yet: disabled, its reason in a tooltip that opens on focus of its span. */
export const Disabled: Story = {
  args: { disabledReason: 'Needs the workflow to label findings' },
  play: async ({ canvas, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Raised' });
    await expect(button).toBeDisabled();
    await expect(button).toHaveClass('rounded-control');
    await userEvent.tab();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('Needs the workflow to label findings');
  },
};
