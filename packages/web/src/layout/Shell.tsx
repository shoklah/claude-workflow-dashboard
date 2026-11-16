import type { ReactNode } from 'react';
import { useStatus } from '../api.ts';
import { Menu, MenuButton } from './Menu.tsx';
import { RefreshButton } from './RefreshButton.tsx';
import { ShowingControl } from './ShowingControl.tsx';
import { Banner, StatusBanner } from './StatusBanner.tsx';

/**
 * The frame of every page: the menu on the left; the import's banner, showing mode and refresh above the page. Under
 * 768 px the menu is behind the Menu button, which leads the header row, and the banner wraps under the controls.
 */
export function Shell({ children }: { children: ReactNode }) {
  const status = useStatus();
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="glass m-3 hidden w-44 flex-none self-start p-3 md:block">
        <Menu />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
        <header className="flex flex-wrap items-start gap-3">
          <MenuButton />
          <div className="order-last min-w-0 flex-1 basis-full md:order-none md:basis-0">
            {status.isError && <Banner>Can't reach the dashboard server.</Banner>}
            {status.data && <StatusBanner status={status.data} />}
          </div>
          <span className="ml-auto md:ml-0"><ShowingControl /></span>
          <RefreshButton importing={status.data?.importing ?? false} />
        </header>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
