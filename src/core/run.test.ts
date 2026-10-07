import { describe, expect, it, vi } from 'vitest';
import { action, createFlow } from './index';
import type { TraceEvent } from './index';

function setup() {
  const log: string[] = [];
  const flow = createFlow({
    'form.read': action((p: { form: string }) => ({ customer: p.form, amount: 5 })),
    'api.create': action(
      async (p: { body: { customer: string } }) => {
        log.push(`create ${p.body.customer}`);
        return { id: 'inv-1' };
      },
      { undo: (_p, result) => void log.push(`undo create ${result.id}`) },
    ),
    'table.append': action(
      (p: { row: { id: string } }) => {
        log.push(`append ${p.row.id}`);
        return p.row;
      },
      { undo: (p) => void log.push(`undo append ${p.row.id}`) },
    ),
    'router.push': action((p: { to: string }) => void log.push(`push ${p.to}`)),
    'ui.fail': action((): void => {
      throw new Error('boom');
    }),
    'ui.wait': action(
      (_p: undefined, ctx) =>
        new Promise<void>((_resolve, reject) =>
          ctx.signal.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    ),
  });
  return { flow, log };
}

const types = (trace: TraceEvent[]) => trace.map((e) => `${e.type}:${e.index}`);

describe('run', () => {
  it('runs steps in order and threads results through ctx', async () => {
    const { flow, log } = setup();
    const seq = flow.defineSequence([
      { action: 'form.read', params: { form: 'Acme' }, as: 'draft' },
      { action: 'api.create', params: { body: '$draft' }, as: 'created' },
      { action: 'table.append', params: { row: '$created' } },
      { action: 'router.push', params: { to: '/invoices/{$created.id}' } },
    ]);
    const result = await flow.run(seq);
    expect(result.status).toBe('ok');
    expect(result).not.toHaveProperty('error');
    expect(log).toEqual(['create Acme', 'append inv-1', 'push /invoices/inv-1']);
    expect(result.ctx).toEqual({
      draft: { customer: 'Acme', amount: 5 },
      created: { id: 'inv-1' },
    });
  });

  it('seeds ctx from input', async () => {
    const { flow, log } = setup();
    const result = await flow.run([{ action: 'router.push', params: { to: '/{$page}' } }], {
      input: { page: 'home' },
    });
    expect(result.status).toBe('ok');
    expect(log).toEqual(['push /home']);
  });

  it('records resolved params, results and durations in the trace', async () => {
    const { flow } = setup();
    const onEvent = vi.fn();
    const result = await flow.run(
      [
        { action: 'form.read', params: { form: 'Acme' }, as: 'draft' },
        { action: 'api.create', params: { body: '$draft' } },
      ],
      { onEvent },
    );
    expect(types(result.trace)).toEqual([
      'step:start:0',
      'step:done:0',
      'step:start:1',
      'step:done:1',
    ]);
    expect(result.trace[0]).toEqual({
      type: 'step:start',
      index: 0,
      action: 'form.read',
      params: { form: 'Acme' },
    });
    expect(result.trace[2]).toMatchObject({ params: { body: { customer: 'Acme', amount: 5 } } });
    expect(result.trace[3]).toMatchObject({
      type: 'step:done',
      result: { id: 'inv-1' },
      durationMs: expect.any(Number),
    });
    expect(onEvent.mock.calls.map(([e]) => e)).toEqual(result.trace);
  });

  it('skips a step whose when ref is falsy', async () => {
    const { flow, log } = setup();
    const result = await flow.run(
      [
        { action: 'form.read', params: { form: '' }, as: 'draft' },
        { action: 'router.push', params: { to: '/a' }, when: '$draft.customer' },
        { action: 'router.push', params: { to: '/b' }, when: '$flag' },
      ],
      { input: { flag: true } },
    );
    expect(result.status).toBe('ok');
    expect(log).toEqual(['push /b']);
    expect(types(result.trace)).toContain('step:skip:1');
  });

  it('fails and stops on a step error', async () => {
    const { flow, log } = setup();
    const result = await flow.run([
      { action: 'ui.fail' },
      { action: 'router.push', params: { to: '/never' } },
    ]);
    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ index: 0, action: 'ui.fail', error: new Error('boom') });
    expect(log).toEqual([]);
    expect(types(result.trace)).toEqual(['step:start:0', 'step:error:0']);
  });

  it('continues past a failed step with onError: continue', async () => {
    const { flow, log } = setup();
    const result = await flow.run([
      { action: 'ui.fail', onError: 'continue', as: 'x' },
      { action: 'router.push', params: { to: '/after' } },
    ]);
    expect(result.status).toBe('ok');
    expect(log).toEqual(['push /after']);
    expect(result.ctx).not.toHaveProperty('x');
    expect(types(result.trace)).toEqual([
      'step:start:0',
      'step:error:0',
      'step:start:1',
      'step:done:1',
    ]);
  });

  it('fails a step whose ref cannot be resolved, without calling the action', async () => {
    const { flow, log } = setup();
    const result = await flow.run([
      { action: 'ui.fail', onError: 'continue', as: 'x' },
      { action: 'router.push', params: { to: '/{$x}' } },
    ]);
    expect(result.status).toBe('failed');
    expect(result.error).toMatchObject({ index: 1, error: { message: 'Unresolved ref: $x' } });
    expect(log).toEqual([]);
  });

  it('treats an unresolved when ref as a step failure', async () => {
    const { flow } = setup();
    const result = await flow.run([{ action: 'ui.fail', when: '$nope' }]);
    expect(result.status).toBe('failed');
    expect(result.error?.error).toMatchObject({ message: 'Unresolved ref: $nope' });
  });

  it('honours onError: continue for resolution failures', async () => {
    const { flow, log } = setup();
    const result = await flow.run([
      { action: 'router.push', params: { to: '/{$nope}' }, onError: 'continue' },
      { action: 'router.push', params: { to: '/ok' } },
    ]);
    expect(result.status).toBe('ok');
    expect(log).toEqual(['push /ok']);
  });

  it('throws for an unknown action before running anything', async () => {
    const { flow, log } = setup();
    await expect(
      flow.run([{ action: 'router.push', params: { to: '/a' } }, { action: 'nope' }]),
    ).rejects.toThrow('Unknown action: nope');
    expect(log).toEqual([]);
  });

  it('does not treat inherited names as registered actions', async () => {
    const { flow } = setup();
    await expect(flow.run([{ action: 'toString' }])).rejects.toThrow('Unknown action: toString');
  });

  it('returns aborted without running steps when the signal is already aborted', async () => {
    const { flow, log } = setup();
    const result = await flow.run([{ action: 'router.push', params: { to: '/a' } }], {
      signal: AbortSignal.abort(),
    });
    expect(result.status).toBe('aborted');
    expect(result.trace).toEqual([]);
    expect(log).toEqual([]);
  });

  it('aborts mid-step and reports aborted, not failed', async () => {
    const { flow, log } = setup();
    const controller = new AbortController();
    const pending = flow.run(
      [
        { action: 'ui.wait', onError: 'continue' },
        { action: 'router.push', params: { to: '/a' } },
      ],
      { signal: controller.signal },
    );
    controller.abort();
    const result = await pending;
    expect(result.status).toBe('aborted');
    expect(result.error).toMatchObject({ index: 0, action: 'ui.wait' });
    expect(log).toEqual([]);
  });

  it('stops before the next step when aborted between steps', async () => {
    const { flow, log } = setup();
    const controller = new AbortController();
    const result = await flow.run(
      [
        { action: 'router.push', params: { to: '/a' } },
        { action: 'router.push', params: { to: '/b' } },
      ],
      {
        signal: controller.signal,
        onEvent: (e) => e.type === 'step:done' && controller.abort(),
      },
    );
    expect(result.status).toBe('aborted');
    expect(log).toEqual(['push /a']);
    expect(result).not.toHaveProperty('error');
  });
});

describe('rollback', () => {
  const failing = [
    { action: 'form.read', params: { form: 'Acme' }, as: 'draft' },
    { action: 'api.create', params: { body: '$draft' }, as: 'created' },
    { action: 'table.append', params: { row: '$created' } },
    { action: 'ui.fail' },
  ] as const;

  it('does nothing unless rollback is set', async () => {
    const { flow, log } = setup();
    const result = await flow.run(failing);
    expect(result.status).toBe('failed');
    expect(log).toEqual(['create Acme', 'append inv-1']);
    expect(types(result.trace).some((t) => t.startsWith('step:undo'))).toBe(false);
  });

  it('undoes completed steps in reverse order', async () => {
    const { flow, log } = setup();
    const result = await flow.run(failing, { rollback: true });
    expect(result.status).toBe('failed');
    expect(log).toEqual(['create Acme', 'append inv-1', 'undo append inv-1', 'undo create inv-1']);
    expect(result.trace.filter((e) => e.type === 'step:undo').map((e) => e.index)).toEqual([2, 1]);
  });

  it('does not undo skipped steps', async () => {
    const { flow, log } = setup();
    const rolledBack = await flow.run(
      [
        { action: 'api.create', params: { body: { customer: 'A' } } },
        { action: 'table.append', params: { row: { id: 'x' } }, when: '$flag' },
        { action: 'ui.fail' },
      ],
      { rollback: true, input: { flag: false } },
    );
    expect(rolledBack.status).toBe('failed');
    expect(log).toEqual(['create A', 'undo create inv-1']);
  });

  it('does not undo a step that failed under continue', async () => {
    const log: string[] = [];
    const flow = createFlow({
      flaky: action(
        (): void => {
          throw new Error('flaky');
        },
        { undo: () => void log.push('undo flaky') },
      ),
      f: action((): void => {
        throw new Error('boom');
      }),
    });
    await flow.run([{ action: 'flaky', onError: 'continue' }, { action: 'f' }], {
      rollback: true,
    });
    expect(log).toEqual([]);
  });

  it('keeps undoing when an undo throws and records the error', async () => {
    const log: string[] = [];
    const flow = createFlow({
      a: action(() => 1, { undo: () => void log.push('undo a') }),
      b: action(() => 2, {
        undo: () => {
          throw new Error('undo b failed');
        },
      }),
      f: action((): void => {
        throw new Error('boom');
      }),
    });
    const result = await flow.run([{ action: 'a' }, { action: 'b' }, { action: 'f' }], {
      rollback: true,
    });
    expect(log).toEqual(['undo a']);
    expect(result.trace.filter((e) => e.type === 'step:undo')).toEqual([
      { type: 'step:undo', index: 1, action: 'b', error: new Error('undo b failed') },
      { type: 'step:undo', index: 0, action: 'a' },
    ]);
    expect(result.status).toBe('failed');
  });

  it('also rolls back an aborted run, with a signal that is not aborted', async () => {
    const seen: boolean[] = [];
    const flow = createFlow({
      a: action(() => 1, { undo: (_p, _r, ctx) => void seen.push(ctx.signal.aborted) }),
    });
    const controller = new AbortController();
    const result = await flow.run([{ action: 'a' }, { action: 'a' }], {
      rollback: true,
      signal: controller.signal,
      onEvent: (e) => e.type === 'step:done' && controller.abort(),
    });
    expect(result.status).toBe('aborted');
    expect(seen).toEqual([false]);
  });

  it('passes the resolved params and result to undo', async () => {
    const calls: unknown[] = [];
    const flow = createFlow({
      make: action((p: { n: number }) => p.n * 2, {
        undo: (p, result) => void calls.push([p, result]),
      }),
      f: action((): void => {
        throw new Error('boom');
      }),
    });
    await flow.run([{ action: 'make', params: { n: '$n' } }, { action: 'f' }], {
      rollback: true,
      input: { n: 4 },
    });
    expect(calls).toEqual([[{ n: 4 }, 8]]);
  });
});
