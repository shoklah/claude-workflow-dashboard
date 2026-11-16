import type { ReactNode } from 'react';
import { useStatus } from '../api.ts';
import { Menu } from './Menu.tsx';
import { RefreshButton } from './RefreshButton.tsx';
import { ShowingControl } from './ShowingControl.tsx';
import { Banner, StatusBanner } from './StatusBanner.tsx';

/** The frame of every page: the menu on the left; the import's banner, showing mode and refresh above the page. */
export function Shell({ children }: { children: ReactNode }) {
  const status = useStatus();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="glass m-2 flex-none p-3 md:m-3 md:w-44 md:self-start">
        <Menu />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1 basis-full sm:basis-0">
            {status.isError && <Banner>Can't reach the dashboard server.</Banner>}
            {status.data && <StatusBanner status={status.data} />}
          </div>
          <ShowingControl />
          <RefreshButton importing={status.data?.importing ?? false} />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
