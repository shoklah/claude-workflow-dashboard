import { Link } from '@tanstack/react-router';
import { LINK, PageTitle, State } from '../components/Panel.tsx';

/** The router's page for an address no route answers, inside the shell: the run page's not-found look, with a way home. */
export function NotFoundPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Not found</PageTitle>
      <State error>
        {'No page at this address. '}
        <Link to="/" className={LINK}>
          Home
        </Link>
      </State>
    </div>
  );
}

/**
 * The router's page for a page that crashed while drawing, inside the shell (alone when the shell itself crashed). It
 * takes no props, so the error's message, which can quote the data, never reaches it: only the console, where React
 * logs it.
 */
export function ErrorPage() {
  return (
    <div className="flex flex-col gap-4">
      <PageTitle>Something went wrong</PageTitle>
      <State error>
        {'This page hit an error. '}
        <a href={window.location.href} className={LINK}>
          Reload
        </a>
      </State>
    </div>
  );
}
