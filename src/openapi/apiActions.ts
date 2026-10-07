import type { Client } from 'openapi-fetch';
import { action } from '../core';
import type { ActionDef } from '../core';

type Method = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';
type OkStatus = 200 | 201 | 202 | 203 | 204 | 206 | 207 | '2XX';

// OperationKey<{ '/a': { get: {...}; post?: never } }> = 'GET /a'
export type OperationKey<Paths> = {
  [P in keyof Paths & string]: {
    [M in Method]: M extends keyof Paths[P]
      ? [NonNullable<Paths[P][M]>] extends [never]
        ? never
        : `${Uppercase<M>} ${P}`
      : never;
  }[Method];
}[keyof Paths & string];

type Op<Paths, K extends string> = K extends `${infer M} ${infer P}`
  ? P extends keyof Paths
    ? Lowercase<M> extends keyof Paths[P]
      ? NonNullable<Paths[P][Lowercase<M>]>
      : never
    : never
  : never;

type Part<O, K extends 'path' | 'query'> = O extends { parameters: infer Ps }
  ? K extends keyof Ps
    ? Ps[K]
    : never
  : never;

type Json<B> = B extends { content: { 'application/json': infer J } } ? J : never;

// A required `requestBody` key gives a required body; an optional key gives `J | undefined`.
type JsonBody<O> = O extends { requestBody: infer B }
  ? Json<B>
  : O extends { requestBody?: infer B }
    ? [NonNullable<B>] extends [never]
      ? never
      : Json<NonNullable<B>> | undefined
    : never;

type Slot<K extends string, V> = [NonNullable<V>] extends [never]
  ? unknown
  : undefined extends V
    ? { [P in K]?: NonNullable<V> }
    : { [P in K]: V };

type Flat<T> = { [K in keyof T]: T[K] };

// Required slots make `params` required; when every slot is optional, `params` may be omitted.
type ApiParams<O> =
  Flat<
    Slot<'path', Part<O, 'path'>> & Slot<'query', Part<O, 'query'>> & Slot<'body', JsonBody<O>>
  > extends infer P
    ? Partial<P> extends P
      ? P | undefined
      : P
    : never;

type SuccessBody<O> = O extends { responses: infer R }
  ? {
      [S in keyof R & OkStatus]: R[S] extends { content: { 'application/json': infer J } }
        ? J
        : undefined;
    }[keyof R & OkStatus]
  : never;

export type ApiActions<Paths, Keys extends string> = {
  [K in Keys as `api:${K}`]: ActionDef<ApiParams<Op<Paths, K>>, SuccessBody<Op<Paths, K>>>;
};

export class HttpError extends Error {
  constructor(
    readonly operation: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`${operation} failed with ${status}`);
    this.name = 'HttpError';
  }
}

interface LooseClient {
  request(
    method: string,
    path: string,
    init: Record<string, unknown>,
  ): Promise<{ data?: unknown; error?: unknown; response: Response }>;
}

interface RuntimeParams {
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
}

const OPERATION = /^([A-Z]+) (\/\S*)$/;
const METHODS = new Set(['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH', 'TRACE']);

function parseOperation(operation: string): { method: string; path: string } {
  const match = OPERATION.exec(operation);
  const [, method = '', path = ''] = match ?? [];
  if (!METHODS.has(method)) {
    throw new Error(`Invalid operation "${operation}", expected e.g. "GET /invoices/{id}"`);
  }
  return { method, path };
}

export function apiActions<Paths extends object, const K extends readonly OperationKey<Paths>[]>(
  client: Client<Paths>,
  operations: K,
): ApiActions<Paths, K[number]> {
  const http = client as unknown as LooseClient;
  const entries = operations.map((operation) => {
    const { method, path } = parseOperation(operation);
    const def = action(async (params: RuntimeParams | undefined, ctx) => {
      const init: Record<string, unknown> = { signal: ctx.signal };
      if (params?.path || params?.query) init.params = { path: params.path, query: params.query };
      if (params?.body !== undefined) init.body = params.body;
      const { data, error, response } = await http.request(method.toLowerCase(), path, init);
      if (!response.ok) throw new HttpError(operation, response.status, error);
      return data;
    });
    return [`api:${operation}`, def] as const;
  });
  return Object.fromEntries(entries) as unknown as ApiActions<Paths, K[number]>;
}
