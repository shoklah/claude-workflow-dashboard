import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Option, Options } from './Option.tsx';

const meta = { component: Option, args: { pressed: false, onClick: fn(), children: 'Raised' } } satisfies Meta<typeof Option>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The switch's value: a filled pill, pressed. */
export const Pressed: Story = {
  args: { pressed: true },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Raised' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(getComputedStyle(button).borderTopLeftRadius).toBe('9999px');
  },
};

/** Another value: an outlined pill that calls `onClick`. */
export const NotPressed: Story = {
  play: async ({ canvas, args, userEvent }) => {
    const button = canvas.getByRole('button', { name: 'Raised' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(getComputedStyle(button).borderTopLeftRadius).toBe('9999px');
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
    await expect(getComputedStyle(button).borderTopLeftRadius).toBe('9999px');
    await userEvent.tab();
    await expect(await within(document.body).findByRole('tooltip')).toHaveTextContent('Needs the workflow to label findings');
  },
};

/** A switch: its options in a group named by its label, the label written first when shown, and none written when
 * not. */
export const Switch: Story = {
  render: () => (
    <>
      <Options label="Measure" shown>
        <Option pressed onClick={() => {}}>
          Raised
        </Option>
      </Options>
      <Options label="View">
        <Option pressed={false} onClick={() => {}}>
          Timeline
        </Option>
      </Options>
    </>
  ),
  play: async ({ canvas }) => {
    const measure = canvas.getByRole('group', { name: 'Measure' });
    await expect(measure.firstElementChild).toHaveTextContent('Measure');
    await expect(within(measure).getByRole('button', { name: 'Raised' })).toBeVisible();
    await expect(measure).toHaveClass('flex-wrap');
    const view = canvas.getByRole('group', { name: 'View' });
    await expect(view.firstElementChild).toBe(within(view).getByRole('button', { name: 'Timeline' }));
  },
};
