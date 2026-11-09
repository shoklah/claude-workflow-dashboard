/**
 * Runs `job` one at a time: a request while it runs marks one follow-up, however many requests come. A failing job is
 * logged, so a background error never crashes the server and the queue keeps working.
 */
export function createQueue(job: () => Promise<void>): { request(): void; busy(): boolean; idle(): Promise<void> } {
  let running: Promise<void> | null = null;
  let again = false;
  return {
    request() {
      if (running) {
        again = true;
        return;
      }
      running = (async () => {
        do {
          again = false;
          try {
            await job();
          } catch (error) {
            console.error('import job failed:', error);
          }
        } while (again);
      })().finally(() => {
        running = null;
      });
    },
    busy: () => running !== null,
    idle: () => running ?? Promise.resolve(),
  };
}
