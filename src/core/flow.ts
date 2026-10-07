import { run } from './run';
import type { Registry, RunOptions, RunResult, RuntimeStep, StepLike, Validate } from './types';

export function createFlow<R extends Registry>(registry: R) {
  return {
    registry,
    defineSequence<const S extends readonly StepLike<R>[]>(steps: S & Validate<R, S>): S {
      return steps;
    },
    run(steps: readonly RuntimeStep[], options?: RunOptions): Promise<RunResult> {
      return run(registry, steps, options);
    },
  };
}
