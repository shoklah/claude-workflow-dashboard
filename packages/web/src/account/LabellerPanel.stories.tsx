import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';
import { accountEmpty, accountFull } from '../test/account.ts';
import { mockApi } from '../test/mock-api.ts';
import { LabellerPanel } from './LabellerPanel.tsx';

const meta = { component: LabellerPanel, args: { account: accountFull } } satisfies Meta<typeof LabellerPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

const NO_KEY = 'No key: findings stay unlabelled.';
const KEY = 'sk-ant-invented-key';

/** The labeller's POST, with this body. */
const posted = (body: object) =>
  expect(globalThis.fetch).toHaveBeenCalledWith(
    '/api/account/labeller',
    expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
  );

/** Full: a key is set, shown only as "Set" with Replace and Remove; the model and the daily max. */
export const Full: Story = {
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await expect(panel.getByText('Set')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Replace' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Remove' })).toBeVisible();
    await expect(panel.queryByLabelText('Anthropic key')).toBeNull();
    const model = panel.getByRole('combobox', { name: 'Model' });
    await expect(model).toHaveValue('claude-haiku-5-5');
    await expect(within(model).getAllByRole('option').map((o) => o.textContent)).toEqual(['Haiku 5.5', 'Sonnet 5.5']);
    await expect(panel.getByRole('spinbutton', { name: 'Daily max (findings)' })).toHaveValue(500);
    await expect(panel.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(panel.queryByText(NO_KEY)).toBeNull();
  },
};

/** Empty: no key, so a password field and the line that findings stay unlabelled. */
export const Empty: Story = {
  args: { account: accountEmpty },
  play: async ({ canvas }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await expect(panel.getByLabelText('Anthropic key')).toHaveAttribute('type', 'password');
    await expect(panel.queryByRole('button', { name: 'Replace' })).toBeNull();
    await expect(panel.getByText(NO_KEY)).toHaveClass('text-muted-foreground');
  },
};

/** Saving posts the key, model and daily max; the key then leaves the page, the field's value included. */
export const SaveKey: Story = {
  args: { account: accountEmpty },
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await userEvent.type(panel.getByLabelText('Anthropic key'), KEY);
    await userEvent.selectOptions(panel.getByRole('combobox', { name: 'Model' }), 'Sonnet 5.5');
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await posted({ key: KEY, model: 'claude-sonnet-5-5', dailyMax: 500 });
    await expect(panel.getByLabelText('Anthropic key')).toHaveValue('');
    await expect(document.body.innerHTML).not.toContain(KEY);
  },
};

/** Saving with a key set and none typed keeps it: the body has no key. */
export const SaveKeepsKey: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    const max = panel.getByRole('spinbutton', { name: 'Daily max (findings)' });
    await userEvent.clear(max);
    await userEvent.type(max, '200');
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await posted({ model: 'claude-haiku-5-5', dailyMax: 200 });
  },
};

/** Replace opens the password field, whose key Save posts. */
export const Replace: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await userEvent.click(panel.getByRole('button', { name: 'Replace' }));
    await userEvent.type(panel.getByLabelText('Anthropic key'), KEY);
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await posted({ key: KEY, model: 'claude-haiku-5-5', dailyMax: 500 });
    await expect(document.body.innerHTML).not.toContain(KEY);
  },
};

/** Remove posts a null key at once. */
export const Remove: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 204 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await userEvent.click(panel.getByRole('button', { name: 'Remove' }));
    await posted({ key: null, model: 'claude-haiku-5-5', dailyMax: 500 });
  },
};

/** While the save runs, the panel's actions are disabled. */
export const Pending: Story = {
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 'pending' });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await expect(panel.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Replace' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Remove' })).toBeDisabled();
  },
};

/** A failed save says so in the panel, in fixed words, and the key the field held is gone. */
export const SaveFails: Story = {
  args: { account: accountEmpty },
  beforeEach: () => {
    mockApi({ '/api/account/labeller': 500 });
  },
  play: async ({ canvas, userEvent }) => {
    const panel = within(await canvas.findByRole('region', { name: 'Labeller' }));
    await userEvent.type(panel.getByLabelText('Anthropic key'), KEY);
    await userEvent.click(panel.getByRole('button', { name: 'Save' }));
    await expect(await panel.findByText("Couldn't save the labeller. Try again.")).toBeVisible();
    await expect(document.body.innerHTML).not.toContain(KEY);
    await expect(panel.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};
