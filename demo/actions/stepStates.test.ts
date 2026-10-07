import type { RuntimeStep, TraceEvent } from 'actionflow';
import { describe, expect, it } from 'vitest';
import { stepStates } from './stepStates';

const steps: RuntimeStep[] = [{ action: 'a' }, { action: 'b' }, { action: 'c' }];

describe('stepStates', () => {
  it('starts every step as pending', () => {
    expect(stepStates(steps, []).map((s) => s.status)).toEqual(['pending', 'pending', 'pending']);
  });

  it('shows a running step with its resolved params', () => {
    const events: TraceEvent[] = [{ type: 'step:start', index: 0, action: 'a', params: { n: 1 } }];
    expect(stepStates(steps, events)[0]).toEqual({
      index: 0,
      action: 'a',
      status: 'running',
      params: { n: 1 },
    });
  });

  it('records result and duration when a step is done', () => {
    const events: TraceEvent[] = [
      { type: 'step:start', index: 0, action: 'a', params: 1 },
      { type: 'step:done', index: 0, action: 'a', params: 1, result: 'r', durationMs: 12 },
    ];
    expect(stepStates(steps, events)[0]).toMatchObject({
      status: 'done',
      params: 1,
      result: 'r',
      durationMs: 12,
    });
  });

  it('marks a skipped step', () => {
    const events: TraceEvent[] = [{ type: 'step:skip', index: 1, action: 'b' }];
    expect(stepStates(steps, events).map((s) => s.status)).toEqual([
      'pending',
      'skipped',
      'pending',
    ]);
  });

  it('keeps the params of a step that errored after starting', () => {
    const error = new Error('boom');
    const events: TraceEvent[] = [
      { type: 'step:start', index: 2, action: 'c', params: { x: 1 } },
      { type: 'step:error', index: 2, action: 'c', error, durationMs: 3 },
    ];
    expect(stepStates(steps, events)[2]).toMatchObject({
      status: 'error',
      params: { x: 1 },
      error,
      durationMs: 3,
    });
  });

  it('shows an error without params when resolution failed before the start', () => {
    const events: TraceEvent[] = [
      { type: 'step:error', index: 0, action: 'a', error: new Error('x'), durationMs: 0 },
    ];
    expect(stepStates(steps, events)[0]).not.toHaveProperty('params');
  });

  it('adds undo to a step that was rolled back, keeping its done state', () => {
    const events: TraceEvent[] = [
      { type: 'step:done', index: 0, action: 'a', params: 1, result: 'r', durationMs: 1 },
      { type: 'step:undo', index: 0, action: 'a' },
    ];
    const [first] = stepStates(steps, events);
    expect(first).toMatchObject({ status: 'done', result: 'r', undo: {} });
    expect(first?.undo).not.toHaveProperty('error');
  });

  it('carries an undo error', () => {
    const error = new Error('undo failed');
    const events: TraceEvent[] = [{ type: 'step:undo', index: 1, action: 'b', error }];
    expect(stepStates(steps, events)[1]?.undo).toEqual({ error });
  });

  it('ignores events for steps it does not know', () => {
    const events: TraceEvent[] = [{ type: 'step:skip', index: 9, action: 'z' }];
    expect(stepStates(steps, events)).toHaveLength(3);
  });
});
