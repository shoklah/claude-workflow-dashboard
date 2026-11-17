import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { ErrorPage, NotFoundPage } from './ErrorPages.tsx';

const meta = { component: NotFoundPage } satisfies Meta<typeof NotFoundPage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An address no page answers: the run page's not-found look, with a way home. */
export const NotFound: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Not found' })).toBeVisible();
    await expect(canvas.getByText(/No page at this address/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
  },
};

/** A page that crashed while drawing: fixed text and a reload. */
export const Crashed: Story = {
  render: () => <ErrorPage />,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Something went wrong' })).toBeVisible();
    await expect(canvas.getByText(/This page hit an error/)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Reload' })).toHaveAttribute('href', window.location.href);
  },
};
