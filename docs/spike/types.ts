// ---- action definitions ----
export interface ActionDef<P, R> {
  readonly run: (params: P, ctx: { signal: AbortSignal }) => R | Promise<R>;
}
export type AnyAction = ActionDef<any, any>;
export type Registry = Record<string, AnyAction>;

export function action<P, R>(run: (params: P, ctx: { signal: AbortSignal }) => R | Promise<R>): ActionDef<P, R> {
  return { run };
}

type ParamsOf<A> = A extends ActionDef<infer P, any> ? P : never;
type ResultOf<A> = A extends ActionDef<any, infer R> ? Awaited<R> : never;

// ---- refs ----
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

// What a param may be written as: literal value, or a ref to a compatible ctx value, or nested.
type Ref = `$${string}`;
type Loose<T> = T | Ref | (T extends object ? { [K in keyof T]: Loose<T[K]> } : never);

// Validate a written param value V against expected type T under context Ctx.
type CheckValue<V, T, Ctx> = V extends `$${infer S}`
  ? [RefValue<Ctx, S>] extends [never]
    ? `Unknown ref: $${S}`
    : RefValue<Ctx, S> extends T
      ? V
      : `Ref $${S} has the wrong type`
  : V extends object
    ? T extends object
      ? { [K in keyof V]: K extends keyof T ? CheckValue<V[K], T[K], Ctx> : never }
      : V
    : V;

// ---- steps ----
type StepFor<R extends Registry, N extends keyof R & string> = {
  action: N;
  params: Loose<ParamsOf<R[N]>>;
  as?: string;
};
export type AnyStep<R extends Registry> = { [N in keyof R & string]: StepFor<R, N> }[keyof R & string];

type AddOut<Ctx, S> = S extends { action: infer N; as: infer A extends string }
  ? Ctx & { [K in A]: N }
  : Ctx;

type Validate<R extends Registry, S extends readonly unknown[], Ctx = {}> = S extends readonly [
  infer H,
  ...infer T,
]
  ? H extends { action: infer N extends keyof R & string; params: infer P }
    ? [
        Omit<H, 'params'> & { params: CheckValue<P, ParamsOf<R[N]>, ResolveCtx<R, Ctx>> },
        ...Validate<R, T, AddOut<Ctx, H>>,
      ]
    : [H, ...Validate<R, T, Ctx>]
  : [];

// Ctx stores action names; resolve lazily to result types (keeps recursion shallow).
type ResolveCtx<R extends Registry, Ctx> = { [K in keyof Ctx]: Ctx[K] extends keyof R ? ResultOf<R[Ctx[K]]> : never };

export function createFlow<R extends Registry>(registry: R) {
  return {
    defineSequence<const S extends readonly AnyStep<R>[]>(steps: S & Validate<R, S>): S {
      return steps;
    },
    registry,
  };
}
