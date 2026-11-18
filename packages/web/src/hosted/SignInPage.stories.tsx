import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';
import { SignInPage } from './SignInPage.tsx';

const meta = { component: SignInPage } satisfies Meta<typeof SignInPage>;
export default meta;
type Story = StoryObj<typeof meta>;

const NOTICE = "This edward is run by its owner for a few invited friends. What your collector sends is stored on the owner's server, where they can read the files.";
const REFUSED = "This GitHub account isn't invited. Ask the owner of this edward for an invite, then sign in again.";
const FAILED = "Sign-in didn't finish. Try again.";

/** The page holds no data, so it has one state per `?error=`: none, refused and failed. */
export const Default: Story = {
  parameters: { path: '/signin' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible();
    const notice = canvas.getByText(NOTICE);
    const link = canvas.getByRole('link', { name: 'Sign in with GitHub' });
    await expect(link).toHaveAttribute('href', '/auth/github');
    // The notice is read before the button.
    await expect(notice.compareDocumentPosition(link) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect(canvas.queryByText(REFUSED)).toBeNull();
    await expect(canvas.queryByText(FAILED)).toBeNull();
  },
};

/** Signed in with a GitHub account that isn't invited. */
export const Refused: Story = {
  parameters: { path: '/signin?error=refused' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(REFUSED)).toBeVisible();
    await expect(canvas.queryByText(FAILED)).toBeNull();
    await expect(canvas.getByRole('link', { name: 'Sign in with GitHub' })).toBeVisible();
  },
};

/** A bad `state` or a GitHub error. */
export const Failed: Story = {
  parameters: { path: '/signin?error=failed' },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(FAILED)).toBeVisible();
    await expect(canvas.queryByText(REFUSED)).toBeNull();
  },
};
