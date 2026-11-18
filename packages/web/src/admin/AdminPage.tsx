import { useState } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { parseTime, type AdminResponse } from '@cwd/shared';
import { ConfirmDelete, LoginForm } from '../account/AccountForms.tsx';
import { useSend } from '../account/send.ts';
import { ApiError, deleteAccountAsAdmin, invite, removeInvite, useLiveQuery, useStatus } from '../api.ts';
import { EmptyRow } from '../components/Num.tsx';
import { ColumnHead, PageTitle, Panel, ScrollTable, State } from '../components/Panel.tsx';
import { Button } from '../components/ui/button.tsx';
import { NotFoundPage } from '../layout/ErrorPages.tsx';
import { Time } from '../layout/StatusBanner.tsx';
import { formatDay } from '../lib/format.ts';

const COLUMN_COUNT = 4;

/** The admin's data, read again after a POST changes it. */
const reloadAdmin = (client: QueryClient) => client.invalidateQueries({ queryKey: ['/api/admin'] });

/**
 * Hosted mode's Admin page, the admin's only: the Invites and Accounts panels. Anyone else gets the API's 404, so the
 * router's not-found page. While viewing another account no control that POSTs is drawn.
 */
export function AdminPage() {
  const admin = useLiveQuery<AdminResponse>('/api/admin');
  const account = useStatus().data?.account;
  const viewing = Boolean(account?.viewing);
  if (admin.error instanceof ApiError && admin.error.status === 404) return <NotFoundPage />;
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Admin</PageTitle>
      {admin.isPending && <State>Loading the admin settings…</State>}
      {admin.isError && <State error>Couldn't load the admin settings. Reload the page to try again.</State>}
      {admin.data && (
        <div className="grid gap-4 lg:grid-cols-2">
          <InvitesPanel invites={admin.data.invites} viewing={viewing} />
          <AccountsPanel accounts={admin.data.accounts} self={account?.login} viewing={viewing} />
        </div>
      )}
    </div>
  );
}

/** The invited logins, when each was added and whether it has signed in, with a Remove each, and a login field with
 * "Invite". While a call runs every action is disabled, and a failed one says so in fixed words. */
function InvitesPanel({ invites, viewing }: { invites: AdminResponse['invites']; viewing: boolean }) {
  const { pending, failed, send } = useSend(reloadAdmin);

  return (
    <Panel title="Invites">
      <ScrollTable label="Invites">
        <thead>
          <tr>
            <ColumnHead>GitHub login</ColumnHead>
            <ColumnHead>Added</ColumnHead>
            <ColumnHead>Signed in</ColumnHead>
            {!viewing && (
              <ColumnHead>
                <span className="sr-only">Remove</span>
              </ColumnHead>
            )}
          </tr>
        </thead>
        <tbody>
          {invites.length === 0 ? (
            <EmptyRow columns={viewing ? COLUMN_COUNT - 1 : COLUMN_COUNT}>No invites: only you can sign in.</EmptyRow>
          ) : (
            invites.map((invited) => (
              <tr key={invited.login} className="border-t hover:bg-muted/50">
                <td className="px-2 py-1.5">{invited.login}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDay(parseTime(invited.addedAt))}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {invited.signedIn ? 'Yes' : <span className="text-muted-foreground">Not yet</span>}
                </td>
                {!viewing && (
                  <td className="px-2 py-1.5 text-right">
                    <Button
                      variant="outline"
                      size="xs"
                      disabled={pending}
                      onClick={() => send(() => removeInvite(invited.login), "Couldn't remove the invite. Try again.")}
                    >
                      Remove
                    </Button>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </ScrollTable>
      {!viewing && (
        <LoginForm
          action="Invite"
          pending={pending}
          onAdd={(login) => send(() => invite(login), "Couldn't invite the login. Check it and try again.")}
        />
      )}
      {failed && <State error>{failed}</State>}
    </Panel>
  );
}

/** Every account, the admin's marked "(you)", when it was created and when it last collected, with a Delete each behind
 * a dialog naming its login, none on the admin's own. */
function AccountsPanel({
  accounts,
  self,
  viewing,
}: {
  accounts: AdminResponse['accounts'];
  self: string | undefined;
  viewing: boolean;
}) {
  // The account the dialog names stays set while the dialog closes, so its title keeps the login as it fades out.
  const [target, setTarget] = useState<AdminResponse['accounts'][number] | null>(null);
  const [confirming, setConfirming] = useState(false);
  const { pending, failed, send } = useSend(reloadAdmin);

  function remove(id: number) {
    setConfirming(false);
    send(() => deleteAccountAsAdmin(id), "Couldn't delete the account. Try again.");
  }

  return (
    <Panel title="Accounts">
      <ScrollTable label="Accounts">
        <thead>
          <tr>
            <ColumnHead>GitHub login</ColumnHead>
            <ColumnHead>Created</ColumnHead>
            <ColumnHead>Last collect</ColumnHead>
            {!viewing && (
              <ColumnHead>
                <span className="sr-only">Delete</span>
              </ColumnHead>
            )}
          </tr>
        </thead>
        <tbody>
          {accounts.map((row) => {
            const own = row.login === self;
            return (
              <tr key={row.id} className="border-t hover:bg-muted/50">
                <td className="px-2 py-1.5">
                  {row.login}
                  {own && <span className="text-muted-foreground"> (you)</span>}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">{formatDay(parseTime(row.createdAt))}</td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  {row.lastCollectAt ? <Time iso={row.lastCollectAt} /> : <span className="text-muted-foreground">Never</span>}
                </td>
                {!viewing && (
                  <td className="px-2 py-1.5 text-right">
                    {!own && (
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={pending}
                        onClick={() => {
                          setTarget(row);
                          setConfirming(true);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </ScrollTable>
      {failed && <State error>{failed}</State>}
      <ConfirmDelete
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete ${target?.login}'s account?`}
        whose="Its"
        onConfirm={() => target && remove(target.id)}
      />
    </Panel>
  );
}
