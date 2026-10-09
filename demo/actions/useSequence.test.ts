import { action, createFlow } from '@yung_papa/actionflow';
import { describe, expect, it } from 'vitest';
import { nextTick, ref } from 'vue';
import { useSequence } from './useSequence';

function setup() {
  const gate: { open: () => void } = { open: () => undefined };
  const flow = createFlow({
    ok: action(() => 1, { undo: () => undefined }),
    fail: action((): void => {
      throw new Error('boom');
    }),
    wait: action(
      (_p: undefined, ctx) =>
        new Promise<void>((resolve, reject) => {
          gate.open = resolve;
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    ),
  });
  return { flow, gate };
}

describe('useSequence', () => {
  it('starts idle with pending steps', () => {
    const { flow } = setup();
    const seq = useSequence(flow, [{ action: 'ok' }, { action: 'ok' }]);
    expect(seq.status.value).toBe('idle');
    expect(seq.trace.value).toEqual([]);
    expect(seq.states.value.map((s) => s.status)).toEqual(['pending', 'pending']);
  });

  it('runs to ok and exposes the result and states', async () => {
    const { flow } = setup();
    const seq = useSequence(flow, [{ action: 'ok', as: 'x' }]);
    const outcome = await seq.run();
    expect(outcome?.status).toBe('ok');
    expect(seq.status.value).toBe('ok');
    expect(seq.result.value?.ctx).toEqual({ x: 1 });
    expect(seq.states.value[0]).toMatchObject({ status: 'done', result: 1 });
  });

  it('streams trace events while running', async () => {
    const { flow, gate } = setup();
    const seq = useSequence(flow, [{ action: 'ok' }, { action: 'wait' }]);
    const running = seq.run();
    await nextTick();
    expect(seq.status.value).toBe('running');
    expect(seq.states.value.map((s) => s.status)).toEqual(['done', 'running']);
    gate.open();
    await running;
    expect(seq.states.value.map((s) => s.status)).toEqual(['done', 'done']);
  });

  it('reports failed with the error step', async () => {
    const { flow } = setup();
    const seq = useSequence(flow, [{ action: 'ok' }, { action: 'fail' }]);
    await seq.run();
    expect(seq.status.value).toBe('failed');
    expect(seq.result.value?.error).toMatchObject({ index: 1, action: 'fail' });
    expect(seq.states.value[1]?.status).toBe('error');
  });

  it('aborts a running sequence', async () => {
    const { flow } = setup();
    const seq = useSequence(flow, [{ action: 'wait' }]);
    const running = seq.run();
    await nextTick();
    seq.abort();
    await running;
    expect(seq.status.value).toBe('aborted');
  });

  it('ignores run while already running', async () => {
    const { flow, gate } = setup();
    const seq = useSequence(flow, [{ action: 'wait' }]);
    const first = seq.run();
    expect(await seq.run()).toBeUndefined();
    gate.open();
    await first;
    expect(seq.status.value).toBe('ok');
  });

  it('resets the trace on a new run', async () => {
    const { flow } = setup();
    const seq = useSequence(flow, [{ action: 'ok' }]);
    await seq.run();
    const first = seq.trace.value.length;
    await seq.run();
    expect(seq.trace.value).toHaveLength(first);
  });

  it('resets to idle with an empty trace, but not while running', async () => {
    const { flow, gate } = setup();
    const seq = useSequence(flow, [{ action: 'wait' }]);
    const running = seq.run();
    seq.reset();
    expect(seq.status.value).toBe('running');
    gate.open();
    await running;
    expect(seq.trace.value.length).toBeGreaterThan(0);
    seq.reset();
    expect(seq.status.value).toBe('idle');
    expect(seq.trace.value).toEqual([]);
    expect(seq.result.value).toBeUndefined();
    expect(seq.states.value.map((s) => s.status)).toEqual(['pending']);
  });

  it('follows reactive steps and options, and applies rollback', async () => {
    const { flow } = setup();
    const steps = ref<{ action: string }[]>([{ action: 'ok' }, { action: 'fail' }]);
    const rollback = ref(true);
    const seq = useSequence(flow, steps, () => ({ rollback: rollback.value }));
    await seq.run();
    expect(seq.states.value[0]?.undo).toBeDefined();

    rollback.value = false;
    steps.value = [{ action: 'ok' }];
    expect(seq.states.value).toHaveLength(1);
    await seq.run();
    expect(seq.status.value).toBe('ok');
  });
});
