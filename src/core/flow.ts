import type { StepLike, Registry, Validate } from './types';

export function createFlow<R extends Registry>(registry: R) {
  return {
    registry,
    defineSequence<const S extends readonly StepLike<R>[]>(steps: S & Validate<R, S>): S {
      return steps;
    },
  };
}
