import type { RuntimeStep, TraceEvent } from '@yung_papa/actionflow';

export type StepStatus = 'pending' | 'running' | 'done' | 'skipped' | 'error';

export interface StepState {
  index: number;
  action: string;
  status: StepStatus;
  params?: unknown;
  result?: unknown;
  error?: unknown;
  durationMs?: number;
  // Present once the step was rolled back; `error` is set when the undo itself failed.
  undo?: { error?: unknown };
}

export function stepStates(
  steps: readonly RuntimeStep[],
  events: readonly TraceEvent[],
): StepState[] {
  const states: StepState[] = steps.map((step, index) => ({
    index,
    action: step.action,
    status: 'pending',
  }));
  for (const event of events) {
    const state = states[event.index];
    if (!state) continue;
    switch (event.type) {
      case 'step:start':
        state.status = 'running';
        state.params = event.params;
        break;
      case 'step:skip':
        state.status = 'skipped';
        break;
      case 'step:done':
        state.status = 'done';
        state.params = event.params;
        state.result = event.result;
        state.durationMs = event.durationMs;
        break;
      case 'step:error':
        state.status = 'error';
        state.error = event.error;
        state.durationMs = event.durationMs;
        break;
      case 'step:undo':
        state.undo = 'error' in event ? { error: event.error } : {};
        break;
      default:
        event satisfies never;
    }
  }
  return states;
}
