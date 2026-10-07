import { lookup, resolveValue } from './resolve';
import type {
  ActionContext,
  Registry,
  RunOptions,
  RunResult,
  RunStatus,
  RuntimeStep,
  StepError,
  TraceEvent,
} from './types';

interface LooseAction {
  run: (params: unknown, ctx: ActionContext) => unknown;
  undo?: (params: unknown, result: unknown, ctx: ActionContext) => void | Promise<void>;
}

interface Completed {
  index: number;
  action: string;
  params: unknown;
  result: unknown;
}

export async function run(
  registry: Registry,
  steps: readonly RuntimeStep[],
  options: RunOptions = {},
): Promise<RunResult> {
  for (const step of steps) {
    if (!Object.hasOwn(registry, step.action)) throw new Error(`Unknown action: ${step.action}`);
  }

  const signal = options.signal ?? new AbortController().signal;
  const ctx: Record<string, unknown> = { ...options.input };
  const trace: TraceEvent[] = [];
  const emit = (event: TraceEvent) => {
    trace.push(event);
    options.onEvent?.(event);
  };
  const completed: Completed[] = [];
  let status: RunStatus = 'ok';
  let failure: StepError | undefined;

  for (const [index, step] of steps.entries()) {
    if (signal.aborted) {
      status = 'aborted';
      break;
    }
    const started = performance.now();
    try {
      if (step.when !== undefined && !lookup(ctx, step.when.slice(1))) {
        emit({ type: 'step:skip', index, action: step.action });
        continue;
      }
      const params = resolveValue(step.params, ctx);
      emit({ type: 'step:start', index, action: step.action, params });
      const def = registry[step.action] as unknown as LooseAction;
      const result = await def.run(params, { signal });
      if (step.as !== undefined) ctx[step.as] = result;
      completed.push({ index, action: step.action, params, result });
      emit({
        type: 'step:done',
        index,
        action: step.action,
        params,
        result,
        durationMs: performance.now() - started,
      });
    } catch (error) {
      emit({
        type: 'step:error',
        index,
        action: step.action,
        error,
        durationMs: performance.now() - started,
      });
      if (!signal.aborted && step.onError === 'continue') continue;
      status = signal.aborted ? 'aborted' : 'failed';
      failure = { index, action: step.action, error };
      break;
    }
  }

  if (status !== 'ok' && options.rollback) {
    // A fresh signal: compensation must still run after the caller aborted.
    const undoCtx: ActionContext = { signal: new AbortController().signal };
    for (const { index, action, params, result } of completed.reverse()) {
      const def = registry[action] as unknown as LooseAction;
      if (!def.undo) continue;
      try {
        await def.undo(params, result, undoCtx);
        emit({ type: 'step:undo', index, action });
      } catch (error) {
        emit({ type: 'step:undo', index, action, error });
      }
    }
  }

  return failure ? { status, ctx, trace, error: failure } : { status, ctx, trace };
}
