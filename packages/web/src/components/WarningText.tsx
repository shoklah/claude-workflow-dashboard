import { SessionChip } from './SessionChip.tsx';

/** A warning's text, its `{session}` placeholder shown as that session's chip. */
export function WarningText({ text, sessionId }: { text: string; sessionId: string | null }) {
  const at = text.indexOf('{session}');
  if (sessionId === null || at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <SessionChip id={sessionId} />
      {text.slice(at + '{session}'.length)}
    </>
  );
}
