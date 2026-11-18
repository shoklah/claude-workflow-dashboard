import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { parseTime, type AccountResponse } from '@cwd/shared';
import { signOut, useLiveQuery } from '../api.ts';
import { Pairs, PageTitle, Section, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { formatDay } from '../lib/format.ts';
import { CollectorPanel } from './CollectorPanel.tsx';

/** Hosted mode's Account page: the collector's panel, then who is signed in and since when, with Sign out. */
export function AccountPage() {
  const account = useLiveQuery<AccountResponse>('/api/account');
  const data = account.data;
  const [signOutFailed, setSignOutFailed] = useState(false);

  // Ends the session, then loads the sign-in page afresh, so no cached data of the account stays in the page; a failure
  // shows in fixed words.
  async function leave() {
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
      return;
    }
    window.location.assign('/signin');
  }
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Account</PageTitle>
      {account.isPending && <State>Loading your account…</State>}
      {account.isError && <State error>Couldn't load your account. Reload the page to try again.</State>}
      {data && (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <CollectorPanel account={data} />
          </div>
          <Section title="Your account">
            <Pairs
              inline="beside"
              backdrop
              pairs={[
                ['Signed in as', data.login],
                ['Account since', formatDay(parseTime(data.createdAt))],
              ]}
            />
            <div>
              <Button variant="outline" onClick={leave}>
                <LogOut aria-hidden />
                Sign out
              </Button>
            </div>
            {signOutFailed && <State error>Couldn't sign out. Try again.</State>}
          </Section>
        </>
      )}
    </div>
  );
}
