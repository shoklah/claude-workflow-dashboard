import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button.tsx';
import { refresh } from '../api.ts';

/** Asks for an import now, then rereads the status; while an import runs it says so and waits. */
export function RefreshButton({ importing }: { importing: boolean }) {
  const queryClient = useQueryClient();
  async function onClick() {
    await refresh();
    await queryClient.invalidateQueries({ queryKey: ['status'] });
  }
  return (
    <Button variant="outline" size="sm" disabled={importing} onClick={onClick}>
      <RefreshCw className={importing ? 'animate-spin' : undefined} aria-hidden />
      {importing ? 'Importing…' : 'Refresh'}
    </Button>
  );
}
