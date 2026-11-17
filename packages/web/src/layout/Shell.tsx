import type { ReactNode } from 'react';
import { useStatus } from '../api.ts';
import { Brand } from './Brand.tsx';
import { Menu, MenuButton } from './Menu.tsx';
import { RefreshButton } from './RefreshButton.tsx';
import { ShowingControl } from './ShowingControl.tsx';
import { Banner, StatusBanner, Time } from './StatusBanner.tsx';

/**
 * The frame of every page. From 768 px: a rail as tall as the window that stays put while the page scrolls, with the
 * brand, the menu (which alone scrolls in a short window) and at its foot showing mode, Refresh and the last good
 * import's time; no header row. Under 768 px the rail is hidden and a top row holds the Menu button, showing mode and
 * Refresh. Both sets of controls are rendered, one hidden by breakpoint. The import's banner sits above the page at
 * every width, only when it has something to say.
 */
export function Shell({ children }: { children: ReactNode }) {
  const status = useStatus();
  const importing = status.data?.importing ?? false;
  const lastGood = status.data?.lastGoodImportAt;
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="glass sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] w-56 flex-none flex-col gap-4 self-start p-3 md:flex">
        <Brand />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Menu />
        </div>
        <div className="flex flex-col gap-2 border-t pt-3">
          <div className="px-3"><ShowingControl stacked /></div>
          <RefreshButton importing={importing} />
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
          <div className="ml-auto"><ShowingControl /></div>
          <RefreshButton importing={importing} />
        </header>
        {status.isError && <Banner>Can't reach the dashboard server.</Banner>}
        {status.data && <StatusBanner status={status.data} />}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
