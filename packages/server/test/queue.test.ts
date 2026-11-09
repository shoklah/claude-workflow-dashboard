import { describe, expect, test, vi } from 'vitest';
import { createQueue } from '../src/queue.ts';

/** A job that runs until its test releases it, counting its starts and how many run at once. */
function heldJob() {
  const state = { starts: 0, running: 0, most: 0, release: () => {} };
  const job = () => {
    state.starts++;
    state.running++;
    state.most = Math.max(state.most, state.running);
    return new Promise<void>((resolve) => {
      state.release = () => {
        state.running--;
        resolve();
      };
    });
  };
  return { state, job };
}

describe('createQueue', () => {
  test('runs one job at a time', async () => {
    const { state, job } = heldJob();
    const queue = createQueue(job);
    expect(queue.busy()).toBe(false);
    queue.request();
    queue.request();
    expect(queue.busy()).toBe(true);
    expect(state.running).toBe(1);
    state.release();
    await vi.waitFor(() => expect(state.starts).toBe(2));
    state.release();
    await queue.idle();
    expect(state.most).toBe(1);
    expect(queue.busy()).toBe(false);
  });

  test('requests during a job make exactly one follow-up', async () => {
    const { state, job } = heldJob();
    const queue = createQueue(job);
    queue.request();
    queue.request();
    queue.request();
    queue.request();
    state.release();
    await vi.waitFor(() => expect(state.starts).toBe(2));
    state.release();
    await queue.idle();
    expect(state.starts).toBe(2);
  });

  test("a failing job doesn't stop the queue", async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    let starts = 0;
    const queue = createQueue(async () => {
      starts++;
      throw new Error('boom');
    });
    queue.request();
    await queue.idle();
    expect(queue.busy()).toBe(false);
    queue.request();
    await queue.idle();
    expect(starts).toBe(2);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
