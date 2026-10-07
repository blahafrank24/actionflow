export class UnresolvedRefError extends Error {
  constructor(readonly ref: string) {
    super(`Unresolved ref: $${ref}`);
    this.name = 'UnresolvedRefError';
  }
}

type Ctx = Readonly<Record<string, unknown>>;

// lookup({ a: { b: 1 } }, 'a.b') = 1; throws when a name or key along the path is absent.
export function lookup(ctx: Ctx, path: string): unknown {
  const [name = '', ...keys] = path.split('.');
  if (!Object.hasOwn(ctx, name)) throw new UnresolvedRefError(path);
  let current = ctx[name];
  for (const key of keys) {
    if (typeof current !== 'object' || current === null || !Object.hasOwn(current, key)) {
      throw new UnresolvedRefError(path);
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

const TEMPLATE = /\{\$([^}]+)\}/g;

function resolveString(value: string, ctx: Ctx): unknown {
  if (value.startsWith('$$')) return value.slice(1);
  if (value.startsWith('$')) return lookup(ctx, value.slice(1));
  return value.replace(TEMPLATE, (_match, path: string) => {
    const resolved = lookup(ctx, path);
    if (
      typeof resolved === 'string' ||
      typeof resolved === 'number' ||
      typeof resolved === 'boolean'
    ) {
      return String(resolved);
    }
    throw new UnresolvedRefError(path);
  });
}

export function resolveValue(value: unknown, ctx: Ctx): unknown {
  if (typeof value === 'string') return resolveString(value, ctx);
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, ctx));
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveValue(v, ctx)]));
  }
  return value;
}

export interface RefUse {
  // Where the ref sits inside the walked value, e.g. 'body.items.0'; '' for the value itself.
  at: string;
  // The ref without its `$`, e.g. 'draft.id'.
  path: string;
}

export function collectRefs(value: unknown, at = ''): RefUse[] {
  const child = (key: string | number) => (at ? `${at}.${key}` : String(key));
  if (typeof value === 'string') {
    if (value.startsWith('$$')) return [];
    if (value.startsWith('$')) return [{ at, path: value.slice(1) }];
    return [...value.matchAll(TEMPLATE)].map((m) => ({ at, path: m[1] ?? '' }));
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => collectRefs(item, child(i)));
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => collectRefs(v, child(k)));
  }
  return [];
}
