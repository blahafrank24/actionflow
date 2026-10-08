import { run } from './run.js';
import { validateSequence } from './validate.js';
import type {
  Registry,
  RunOptions,
  RunResult,
  RuntimeStep,
  StepLike,
  Validate,
  ValidateOptions,
  ValidationResult,
} from './types.js';

export function createFlow<R extends Registry>(registry: R) {
  return {
    registry,
    defineSequence<const S extends readonly StepLike<R>[]>(steps: S & Validate<R, S>): S {
      return steps;
    },
    run(steps: readonly RuntimeStep[], options?: RunOptions): Promise<RunResult> {
      return run(registry, steps, options);
    },
    validate(json: unknown, options?: ValidateOptions): ValidationResult {
      return validateSequence(registry, json, options);
    },
  };
}
