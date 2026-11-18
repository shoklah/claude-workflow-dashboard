import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useStatus } from '../api.ts';
import { Button } from '../components/ui/button.tsx';
import { AccountLinks } from './AccountLinks.tsx';
import { AccountSwitcher } from './AccountSwitcher.tsx';
import { Brand } from './Brand.tsx';
import { Menu, MenuButton } from './Menu.tsx';
import { RefreshButton } from './RefreshButton.tsx';
import { ShowingControl } from './ShowingControl.tsx';
import { Banner, StatusBanner, Time } from './StatusBanner.tsx';

/**
 * The frame of every page. From 768 px: a rail as tall as the window that stays put while the page scrolls, with the
 * brand, the menu (which alone scrolls in a short window) and at its foot the account switcher, showing mode, Refresh
 * and the last good import's time; no header row. Under 768 px the rail is hidden and a top row holds the Menu button,
 * the account switcher, showing mode and Refresh. While viewing another account, showing mode is its read-only bar.
 * Both sets of controls are rendered, one hidden by breakpoint. Refresh shows only once the status says the mode is
 * local; in hosted mode (the status names an account) the account's links take its place at the rail's foot, and under
 * 768 px at the Menu dialog's. The import's banner sits above the page at every width, only when it has something to
 * say.
 *
 * For the keyboard: "Skip to content", hidden until focused, is the first stop and moves the focus to `main`. After a
 * move to another page (a new path, not the first load nor a new query), the focus goes to the new page's title, or to
 * `main` while it has none, without scrolling, so Back still returns to where the page was scrolled.
 */
export function Shell({ children }: { children: ReactNode }) {
  const status = useStatus();
  const importing = status.data?.importing ?? false;
  const lastGood = status.data?.lastGoodImportAt;
  const local = status.data !== undefined && !status.data.account;
  const viewing = status.data?.account?.viewing;
  const main = useRef<HTMLElement>(null);
  const router = useRouter();
  useEffect(() => router.subscribe('onRendered', (event) => {
    if (event.fromLocation && event.pathChanged) (main.current?.querySelector('h1') ?? main.current)?.focus({ preventScroll: true });
  }), [router]);
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Button asChild size="sm" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:h-8 focus:px-3">
        <a
          href="#main"
          onClick={(event) => {
            event.preventDefault();
            main.current?.focus();
          }}
        >
          Skip to content
        </a>
      </Button>
      <aside className="glass sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] w-56 flex-none flex-col gap-4 self-start p-3 md:flex">
        <Brand home />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Menu />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <AccountSwitcher muted className="px-3" />
          <div className="px-3"><ShowingControl stacked viewing={viewing} /></div>
          {local && <RefreshButton importing={importing} />}
          <AccountLinks />
          {lastGood && (
            <p className="px-3 text-xs text-muted-foreground">
              Imported <Time iso={lastGood} />
            </p>
          )}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="flex flex-wrap items-start gap-3 md:hidden">
          <MenuButton />
          <AccountSwitcher />
          <div className="ml-auto"><ShowingControl viewing={viewing} /></div>
          {local && <RefreshButton importing={importing} />}
        </header>
        {status.isError && <Banner>Can't reach the dashboard server.</Banner>}
        {status.data && <StatusBanner status={status.data} />}
        <main ref={main} id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">{children}</main>
      </div>
    </div>
  );
}
