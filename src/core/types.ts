export interface ActionContext {
  signal: AbortSignal;
}

export interface ActionDef<P, R> {
  readonly run: (params: P, ctx: ActionContext) => R | Promise<R>;
  readonly undo?: (params: P, result: R, ctx: ActionContext) => void | Promise<void>;
}

export interface AnyAction {
  readonly run: (params: never, ctx: ActionContext) => unknown;
  readonly undo?: (params: never, result: never, ctx: ActionContext) => void | Promise<void>;
}
export type Registry = Record<string, AnyAction>;

export type ParamsOf<A> = A extends { run: (params: infer P, ctx: ActionContext) => unknown }
  ? P
  : never;
export type ResultOf<A> = A extends { run: (...args: never[]) => infer R } ? Awaited<R> : never;

export type Ref = `$${string}`;

export type OnError = 'abort' | 'continue';

type NeedsParams<A> = [ParamsOf<A>] extends [never]
  ? false
  : undefined extends ParamsOf<A>
    ? false
    : true;

// `string & {}` keeps editor completion for action names while letting Validate report unknown ones on the step.
export type StepLike<R extends Registry> = { action: (keyof R & string) | (string & {}) };

// PathValue<{ a: { b: 1 } }, 'a.b'> = 1; never when the path does not exist.
type PathValue<T, P extends string> = P extends `${infer H}.${infer Rest}`
  ? H extends keyof T
    ? PathValue<T[H], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

type RefValue<Ctx, S extends string> = S extends `${infer N}.${infer Rest}`
  ? N extends keyof Ctx
    ? PathValue<Ctx[N], Rest>
    : never
  : S extends keyof Ctx
    ? Ctx[S]
    : never;

// Intersected with the written value, so the message shows up in the editor instead of collapsing to `never`.
type Fail<V, Msg extends string> = V & { readonly error: Msg };

type Scalar = string | number | boolean;

// "/a/{$x.id}/{$y}" -> checks "x.id" then "y"; yields the first error message or V.
type CheckTemplate<
  V extends string,
  Rest extends string,
  Ctx,
> = Rest extends `${string}{$${infer S}}${infer After}`
  ? [RefValue<Ctx, S>] extends [never]
    ? Fail<V, `Unknown ref: $${S}`>
    : RefValue<Ctx, S> extends Scalar
      ? CheckTemplate<V, After, Ctx>
      : Fail<V, `Template ref $${S} must be a string, number or boolean`>
  : V;

type CheckString<V extends string, T, Ctx> = V extends `$$${string}`
  ? V
  : V extends `$${infer S}`
    ? [RefValue<Ctx, S>] extends [never]
      ? Fail<V, `Unknown ref: $${S}`>
      : RefValue<Ctx, S> extends T
        ? V
        : Fail<V, `Ref $${S} has the wrong type`>
    : V extends `${string}{$${string}}${string}`
      ? string extends T
        ? CheckTemplate<V, V, Ctx>
        : Fail<V, 'A template produces a string, but this param is not a string'>
      : V extends T
        ? V
        : V & { readonly expected: T };

type RequiredKeys<T> = {
  [K in keyof T]-?: Partial<Pick<T, K>> extends Pick<T, K> ? never : K;
}[keyof T];

type CheckValue<V, T, Ctx> = V extends string
  ? CheckString<V, T, Ctx>
  : V extends object
    ? T extends readonly (infer E)[]
      ? { [K in keyof V]: CheckValue<V[K], E, Ctx> }
      : T extends object
        ? { [K in keyof V]: K extends keyof T ? CheckValue<V[K], T[K], Ctx> : never } & {
            [K in RequiredKeys<T>]: unknown;
          }
        : V & { readonly expected: T }
    : V extends T
      ? V
      : V & { readonly expected: T };

type CheckWhen<V, Ctx> = V extends `$${infer S}`
  ? [RefValue<Ctx, S>] extends [never]
    ? Fail<V, `Unknown ref: $${S}`>
    : V
  : V;

// Ctx maps each `as` name to the action that produced it; results are resolved lazily to keep recursion shallow.
type ResolveCtx<R extends Registry, Ctx> = {
  [K in keyof Ctx]: Ctx[K] extends keyof R ? ResultOf<R[Ctx[K]]> : never;
};

type AddOut<Ctx, S> = S extends { action: infer N; as: infer A extends string }
  ? Ctx & { [K in A]: N }
  : Ctx;

type CheckStep<R extends Registry, H, N extends keyof R & string, Ctx> = {
  [K in keyof H]: K extends 'params'
    ? CheckValue<H[K], ParamsOf<R[N]>, ResolveCtx<R, Ctx>>
    : K extends 'when'
      ? CheckWhen<H[K], ResolveCtx<R, Ctx>>
      : K extends 'onError'
        ? H[K] extends OnError
          ? H[K]
          : Fail<H[K], "onError must be 'abort' or 'continue'">
        : K extends 'as'
          ? H[K] extends string
            ? H[K]
            : Fail<H[K], 'as must be a string'>
          : K extends 'action'
            ? H[K]
            : never;
} & (NeedsParams<R[N]> extends true ? { params: unknown } : unknown);

type UnknownAction<H> = {
  [K in keyof H]: K extends 'action' ? Fail<H[K], `Unknown action: ${H[K] & string}`> : H[K];
};

export type Validate<
  R extends Registry,
  S extends readonly unknown[],
  Ctx = unknown,
> = S extends readonly [infer H, ...infer T]
  ? [
      H extends { action: infer N extends keyof R & string }
        ? CheckStep<R, H, N, Ctx>
        : UnknownAction<H>,
      ...Validate<R, T, AddOut<Ctx, H>>,
    ]
  : [];
