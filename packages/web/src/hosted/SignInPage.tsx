import { useSearch } from '@tanstack/react-router';
import { KeyRound } from 'lucide-react';
import { Line, PageTitle, Panel, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { Brand } from '../layout/Brand.tsx';

/** Why the last sign-in didn't go through, from `/auth/*`'s redirect. */
const ERRORS = {
  refused: "This GitHub account isn't invited. Ask the owner of this edward for an invite, then sign in again.",
  failed: "Sign-in didn't finish. Try again.",
};

/** Hosted mode's way in, outside the shell: one glass panel centred on the backdrop, the same at every width, saying
 * where the data goes before the button, and why the last sign-in failed (`?error=refused|failed`) above it. */
export function SignInPage() {
  const { error } = useSearch({ strict: false });
  return (
    <main id="main" tabIndex={-1} className="flex min-h-screen items-center justify-center p-4 outline-none">
      <Panel className="w-full max-w-sm gap-5 p-6">
        <Brand />
        <PageTitle>Sign in</PageTitle>
        {error && <State error>{ERRORS[error]}</State>}
        <Line>
          This edward is run by its owner for a few invited friends. What your collector sends is stored on the owner's
          server, where they can read the files.
        </Line>
        <Button asChild className="self-start">
          <a href="/auth/github">
            <KeyRound aria-hidden />
            Sign in with GitHub
          </a>
        </Button>
      </Panel>
    </main>
  );
}
