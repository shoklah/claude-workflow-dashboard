import { useState } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';

/** The account's data, read again after a POST changes it. */
const reloadAccount = (client: QueryClient) => client.invalidateQueries({ queryKey: ['/api/account'] });

/**
 * An Account panel's POSTs: `send` runs one, then `reload` reads the changed data again (the account's by default).
 * While it runs `pending` is true, so the panel disables its actions; a failure sets `failed` to the fixed words the
 * call gave, never the error's text.
 */
export function useSend(reload: (client: QueryClient) => Promise<unknown> = reloadAccount) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function send(post: () => Promise<unknown>, failure: string): Promise<boolean> {
    setPending(true);
    setFailed(null);
    try {
      await post();
      await reload(queryClient);
      return true;
    } catch {
      setFailed(failure);
      return false;
    } finally {
      setPending(false);
    }
  }
  return { pending, failed, send };
}
