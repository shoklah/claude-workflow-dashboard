import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';
import { Menu, MenuButton } from './Menu.tsx';

const meta = { component: Menu, args: { onNavigate: fn() } } satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The menu holds no data, so it has one state: the built pages' entries in their sections, each with one icon. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const links = await canvas.findAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(['Home', 'Weeks', 'Runs', 'Sessions', 'Findings', 'Context', 'Spend', 'Compliance', 'Steps and rules', 'Skills', 'Models and advisor']);
    await expect(canvas.getByRole('link', { name: 'Skills' })).toHaveAttribute('href', '/skills');
    await expect(canvas.getByRole('link', { name: 'Models and advisor' })).toHaveAttribute('href', '/models');
    await expect(canvas.getByRole('link', { name: 'Findings' })).toHaveAttribute('href', '/findings');
    await expect(canvas.getByRole('link', { name: 'Sessions' })).toHaveAttribute('href', '/sessions');
    await expect(canvas.getByRole('link', { name: 'Context' })).toHaveAttribute('href', '/context');
    await expect(canvas.getByRole('link', { name: 'Compliance' })).toHaveAttribute('href', '/compliance');
    await expect(canvas.getByRole('link', { name: 'Steps and rules' })).toHaveAttribute('href', '/steps');
    await expect(canvas.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
    await expect(canvas.getByRole('link', { name: 'Spend' })).toHaveAttribute('href', '/spend');
    await expect(canvas.getByRole('link', { name: 'Weeks' })).toHaveAttribute('href', '/weeks');
    await expect(canvas.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getAllByRole('group')).toHaveLength(3);
    await expect(within(canvas.getByRole('group', { name: 'Activity' })).getAllByRole('link').map((link) => link.textContent)).toEqual(['Runs', 'Sessions', 'Findings']);
    await expect(within(canvas.getByRole('group', { name: 'Usage and cost' })).getAllByRole('link')).toHaveLength(2);
    await expect(within(canvas.getByRole('group', { name: 'Workflow' })).getAllByRole('link')).toHaveLength(4);
    for (const link of links) {
      const icons = link.querySelectorAll('svg');
      await expect(icons).toHaveLength(1);
      await expect(icons[0]).toHaveAttribute('aria-hidden', 'true');
    }
  },
};

/** On a run's page, Runs stays the current entry and Home isn't. */
export const OnARun: Story = {
  parameters: { path: '/runs/2026-11-10T09:00:00Z' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Runs' })).toHaveAttribute('aria-current', 'page');
    await expect(canvas.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  },
};

/** Following a link tells the caller, so the dialog that holds the menu under 768 px closes. */
export const Navigates: Story = {
  play: async ({ canvas, args, userEvent }) => {
    await userEvent.click(await canvas.findByRole('link', { name: 'Runs' }));
    await expect(args.onNavigate).toHaveBeenCalledTimes(1);
  },
};

/**
 * The Menu button, shown only under 768 px, so this story sets Storybook's page to a phone's width; the stories' test
 * browser is 1200 px wide, where the button is hidden, so it asserts only its pill radius: e2e/shell.spec.ts checks it
 * at 375 px.
 */
export const Button: Story = {
  render: () => <MenuButton />,
  play: async ({ canvasElement }) => {
    // The dialog's trigger renames the button's data-slot, and it is still a pill.
    const button = canvasElement.querySelector('button')!;
    await expect(getComputedStyle(button).borderTopLeftRadius).toBe('9999px');
  },
  parameters: { viewport: { options: { phone: { name: 'Phone', styles: { width: '375px', height: '812px' } } } } },
  globals: { viewport: { value: 'phone' } },
};
