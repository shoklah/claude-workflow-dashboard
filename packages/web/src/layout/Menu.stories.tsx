import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { Menu } from './Menu.tsx';

const meta = { component: Menu } satisfies Meta<typeof Menu>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The menu holds no data, so it has one state: the built pages' entries only, later ones hidden. */
export const Default: Story = {
  play: async ({ canvas }) => {
    const links = await canvas.findAllByRole('link');
    await expect(links.map((link) => link.textContent)).toEqual(['Home', 'Runs', 'Findings', 'Weeks']);
    await expect(canvas.getByRole('link', { name: 'Findings' })).toHaveAttribute('href', '/findings');
    await expect(canvas.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
    await expect(canvas.getByRole('link', { name: 'Weeks' })).toHaveAttribute('href', '/weeks');
    await expect(canvas.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
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
