import type { ActionContext, ActionDef } from './types';

export interface ActionOptions<P, R> {
  undo?: (params: P, result: R, ctx: ActionContext) => void | Promise<void>;
}

export function action<P, R>(
  run: (params: P, ctx: ActionContext) => R | Promise<R>,
  options: ActionOptions<P, Awaited<R>> = {},
): ActionDef<P, Awaited<R>> {
  return options.undo
    ? { run: run as ActionDef<P, Awaited<R>>['run'], undo: options.undo }
    : { run: run as ActionDef<P, Awaited<R>>['run'] };
}
