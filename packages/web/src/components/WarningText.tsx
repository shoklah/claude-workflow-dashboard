import { warningBody } from '../lib/format.ts';
import { SessionChip } from './SessionChip.tsx';

/** A warning in the reader's words: its text through `warningBody` (no log prefix, no lead naming the run's own
 * `branch`) and, when it names a session, that session's chip trailing on its own line, never mid-sentence. */
export function WarningText({ text, sessionId, branch = null }: { text: string; sessionId: string | null; branch?: string | null }) {
  return (
    <>
      <span>{warningBody(text, branch)}</span>
      {sessionId !== null && text.includes('{session}') && (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          Session <SessionChip id={sessionId} />
        </span>
      )}
    </>
  );
}
