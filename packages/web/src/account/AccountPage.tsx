import { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { parseTime, type AccountResponse } from '@cwd/shared';
import { deleteAccount, signOut, useLiveQuery, useStatus } from '../api.ts';
import { Pairs, PageTitle, Section, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.tsx';
import { formatDay } from '../lib/format.ts';
import { CollectorPanel } from './CollectorPanel.tsx';
import { LabellerPanel } from './LabellerPanel.tsx';
import { ShownProjectsPanel } from './ShownProjectsPanel.tsx';
import { ViewersPanel } from './ViewersPanel.tsx';

/**
 * Hosted mode's Account page: the Collector, Labeller, Viewers and Shown projects panels, then who is signed in and
 * since when, with Sign out and Delete account (behind a confirming dialog). While viewing another account the panels
 * are left out, as every control that POSTs is, and only Sign out stays.
 */
export function AccountPage() {
  const account = useLiveQuery<AccountResponse>('/api/account');
  const viewing = useStatus().data?.account?.viewing;
  const data = account.data;
  const [failed, setFailed] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Ends the session (signing out, or deleting the account), then loads the sign-in page afresh, so no cached data of
  // the account stays in the page; a failure shows as `failure`, never the error's text.
  async function leave(post: () => Promise<void>, failure: string) {
    setFailed(null);
    setConfirming(false);
    setLeaving(true);
    try {
      await post();
    } catch {
      setFailed(failure);
      setLeaving(false);
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
          {!viewing && (
            <div className="grid gap-4 lg:grid-cols-2">
              <CollectorPanel account={data} />
              <LabellerPanel account={data} />
              <ViewersPanel account={data} />
              <ShownProjectsPanel />
            </div>
          )}
          <Section title="Your account">
            <Pairs
              inline="beside"
              backdrop
              pairs={[
                ['Signed in as', data.login],
                ['Account since', formatDay(parseTime(data.createdAt))],
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => leave(signOut, "Couldn't sign out. Try again.")} disabled={leaving}>
                <LogOut aria-hidden />
                Sign out
              </Button>
              {!viewing && (
                <Button variant="destructive" onClick={() => setConfirming(true)} disabled={leaving}>
                  <Trash2 aria-hidden />
                  Delete account
                </Button>
              )}
            </div>
            {failed && <State error>{failed}</State>}
            <Dialog open={confirming} onOpenChange={setConfirming}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    Your dashboard's data, collector tokens, viewers and Anthropic key are deleted. It can't be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={() => leave(deleteAccount, "Couldn't delete your account. Try again.")}
                  >
                    Delete account
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>
        </>
      )}
    </div>
  );
}
