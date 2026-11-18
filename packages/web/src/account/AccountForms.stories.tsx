import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, screen, waitFor } from 'storybook/test';
import { ConfirmDelete, LoginForm } from './AccountForms.tsx';

const meta = {
  component: LoginForm,
  args: { action: 'Add viewer', pending: false, onAdd: fn(async () => true) },
} satisfies Meta<typeof LoginForm>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: the field and its button. */
export const Empty: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'GitHub login' })).toHaveValue('');
    await expect(canvas.getByRole('button', { name: 'Add viewer' })).toBeEnabled();
  },
};

/** Submitting sends the login trimmed and empties the field once the call went through. */
export const Added: Story = {
  play: async ({ args, canvas, userEvent }) => {
    const field = canvas.getByRole('textbox', { name: 'GitHub login' });
    await userEvent.type(field, '  jules-b ');
    await userEvent.click(canvas.getByRole('button', { name: 'Add viewer' }));
    await expect(args.onAdd).toHaveBeenCalledWith('jules-b');
    await waitFor(() => expect(field).toHaveValue(''));
  },
};

/** A failed call keeps the login typed, so it can be fixed and sent again. */
export const Failed: Story = {
  args: { onAdd: fn(async () => false) },
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByRole('textbox', { name: 'GitHub login' });
    await userEvent.type(field, 'jules-b');
    await userEvent.click(canvas.getByRole('button', { name: 'Add viewer' }));
    await expect(field).toHaveValue('jules-b');
  },
};

/** While a call runs, the button is disabled. */
export const Pending: Story = {
  args: { pending: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Add viewer' })).toBeDisabled();
  },
};

const confirm = fn();

/** The delete dialog names whose data goes, and confirming calls `onConfirm`. */
export const DeleteDialog: Story = {
  render: () => (
    <ConfirmDelete open onOpenChange={() => {}} title="Delete mika-ito's account?" whose="Its" onConfirm={confirm} />
  ),
  play: async ({ userEvent }) => {
    const dialog = await screen.findByRole('dialog', { name: "Delete mika-ito's account?" });
    await expect(dialog).toHaveTextContent(
      "Its dashboard's data, collector tokens, viewers and Anthropic key are deleted. It can't be undone.",
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete account' }));
    await expect(confirm).toHaveBeenCalledOnce();
  },
};
