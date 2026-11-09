import { spyOn } from 'storybook/test';

/** What a stubbed path answers: its JSON body, an HTTP status with no body, or `'pending'` for a request that never ends. */
type Answer = number | 'pending' | object;

/** Stubs `fetch` for a story: each path answers as given, any other with 404. Assert on `fetch` itself. */
export function mockApi(routes: Record<string, Answer>) {
  return spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const answer = routes[String(input)] ?? 404;
    if (answer === 'pending') return new Promise<Response>(() => {});
    if (typeof answer === 'number') return new Response(null, { status: answer });
    return Response.json(answer);
  });
}
