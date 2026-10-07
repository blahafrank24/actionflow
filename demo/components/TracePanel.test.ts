import { afterEach, describe, expect, it } from 'vitest';
import { createApp, h } from 'vue';
import type { StepState } from '../actions/stepStates';
import type { SequenceStatus } from '../actions/useSequence';
import TracePanel from './TracePanel.vue';

const mounted: HTMLElement[] = [];

function render(states: StepState[], status: SequenceStatus) {
  const el = document.createElement('div');
  document.body.append(el);
  mounted.push(el);
  createApp({ render: () => h(TracePanel, { states, status }) }).mount(el);
  return el;
}

afterEach(() => {
  mounted.splice(0).forEach((el) => el.remove());
});

const step = (index: number, partial: Partial<StepState> = {}): StepState => ({
  index,
  action: `action.${index}`,
  status: 'pending',
  ...partial,
});

const items = (el: HTMLElement) => [...el.querySelectorAll<HTMLElement>('li.step')];

describe('TracePanel', () => {
  it('shows every step with its action name and the run status', () => {
    const el = render([step(0), step(1)], 'idle');
    expect(items(el).map((li) => li.querySelector('.name')?.textContent)).toEqual([
      'action.0',
      'action.1',
    ]);
    expect(el.querySelector('[role=status]')?.textContent?.trim()).toBe('Ready');
    expect(items(el).map((li) => li.dataset.status)).toEqual(['pending', 'pending']);
  });

  it('labels each run status', () => {
    const labels = (['idle', 'running', 'ok', 'failed', 'aborted'] as const).map((status) =>
      render([], status).querySelector('[role=status]')?.textContent?.trim(),
    );
    expect(labels).toEqual(['Ready', 'Running…', 'Succeeded', 'Failed', 'Aborted']);
  });

  it('shows done steps with duration, params and result', () => {
    const el = render(
      [step(0, { status: 'done', durationMs: 123.4, params: { n: 1 }, result: { ok: true } })],
      'ok',
    );
    const [li] = items(el);
    expect(li?.dataset.status).toBe('done');
    expect(li?.querySelector('.bar small')?.textContent).toBe('123 ms');
    const blocks = [...(li?.querySelectorAll('pre') ?? [])].map((pre) => pre.textContent);
    expect(blocks).toEqual(['{\n  "n": 1\n}', '{\n  "ok": true\n}']);
  });

  it('says so when a done step has no result', () => {
    const el = render([step(0, { status: 'done', durationMs: 1, params: undefined })], 'ok');
    expect(el.querySelector('pre')?.textContent).toBe('no result');
  });

  it('marks a running step without a duration', () => {
    const el = render([step(0, { status: 'running', params: 1 })], 'running');
    const [li] = items(el);
    expect(li?.dataset.status).toBe('running');
    expect(li?.querySelector('.bar')).toBeNull();
  });

  it('marks a skipped step with no details', () => {
    const el = render([step(0, { status: 'skipped' })], 'ok');
    const [li] = items(el);
    expect(li?.dataset.status).toBe('skipped');
    expect(li?.querySelector('details')).toBeNull();
  });

  it('opens the details of an errored step and shows the error', () => {
    const el = render(
      [step(0, { status: 'error', durationMs: 5, error: new Error('boom') })],
      'failed',
    );
    const details = el.querySelector('details');
    expect(details?.hasAttribute('open')).toBe(true);
    expect(details?.querySelector('pre')?.textContent).toBe('boom');
  });

  it('shows steps that never ran as not run once the run has finished', () => {
    const states = [step(0, { status: 'error', durationMs: 1, error: new Error('x') }), step(1)];
    const finished = render(states, 'failed');
    expect(items(finished)[1]?.querySelector('.badge')?.textContent?.trim()).toBe('not run');
    const live = render([step(0)], 'idle');
    expect(items(live)[0]?.querySelector('.badge')?.textContent?.trim()).toBe('pending');
  });

  it('marks a rolled back step, keeping its done state', () => {
    const el = render(
      [step(0, { status: 'done', durationMs: 1, params: 1, result: 2, undo: {} })],
      'failed',
    );
    const [li] = items(el);
    expect(li?.dataset.status).toBe('done');
    expect(li?.dataset.undo).toBe('undone');
    expect(li?.textContent).toContain('undone');
  });

  it('shows an undo that failed with its error', () => {
    const el = render(
      [
        step(0, {
          status: 'done',
          durationMs: 1,
          params: 1,
          result: 2,
          undo: { error: new Error('undo broke') },
        }),
      ],
      'failed',
    );
    const [li] = items(el);
    expect(li?.dataset.undo).toBe('failed');
    expect(li?.textContent).toContain('undo failed');
    expect(li?.textContent).toContain('undo broke');
  });

  it('scales duration bars to the slowest step', () => {
    const el = render(
      [
        step(0, { status: 'done', durationMs: 100, params: 1, result: 1 }),
        step(1, { status: 'done', durationMs: 50, params: 1, result: 1 }),
      ],
      'ok',
    );
    const widths = [...el.querySelectorAll<HTMLElement>('.bar span')].map((s) => s.style.width);
    expect(widths).toEqual(['100%', '50%']);
  });
});
