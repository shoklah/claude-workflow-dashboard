import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Input } from './input.tsx';

const meta = { component: Input, args: { 'aria-label': 'GitHub login', placeholder: 'GitHub login' } } satisfies Meta<
  typeof Input
>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Empty: its placeholder, in a pill (index.css's unlayered rule). */
export const Empty: Story = {
  play: async ({ canvas }) => {
    const field = canvas.getByRole('textbox', { name: 'GitHub login' });
    await expect(field).toHaveValue('');
    await expect(field).toHaveAttribute('placeholder', 'GitHub login');
    await expect(getComputedStyle(field).borderTopLeftRadius).toBe('9999px');
  },
};

/** Filled: what was typed. */
export const Filled: Story = {
  play: async ({ canvas, userEvent }) => {
    const field = canvas.getByRole('textbox', { name: 'GitHub login' });
    await userEvent.type(field, 'jules-b');
    await expect(field).toHaveValue('jules-b');
  },
};

/** A password field: what is typed is hidden. */
export const Password: Story = {
  args: { 'aria-label': 'Anthropic key', placeholder: 'sk-ant-…', type: 'password' },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Anthropic key')).toHaveAttribute('type', 'password');
  },
};

/** A number field, right-aligned in tabular figures as a number is. */
export const NumberField: Story = {
  args: { 'aria-label': 'Daily max (findings)', type: 'number', defaultValue: 500, className: 'w-28 text-right tabular-nums' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('spinbutton', { name: 'Daily max (findings)' })).toHaveValue(500);
  },
};

/** Disabled: dimmed, and takes no input. */
export const Disabled: Story = {
  args: { disabled: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('textbox', { name: 'GitHub login' })).toBeDisabled();
  },
};
