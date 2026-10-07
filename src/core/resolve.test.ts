import { describe, expect, it } from 'vitest';
import { collectRefs, resolveValue, UnresolvedRefError } from './resolve';

const ctx = { draft: { customer: 'Acme', amount: 5, tags: ['a'] }, id: 7, nothing: undefined };

describe('resolveValue', () => {
  it('passes literals through', () => {
    expect(resolveValue({ a: 1, b: [true, null], c: 'plain' }, ctx)).toEqual({
      a: 1,
      b: [true, null],
      c: 'plain',
    });
  });

  it('resolves a whole-string ref with its type intact', () => {
    expect(resolveValue('$draft', ctx)).toBe(ctx.draft);
    expect(resolveValue('$draft.tags', ctx)).toBe(ctx.draft.tags);
    expect(resolveValue('$id', ctx)).toBe(7);
  });

  it('resolves refs nested in objects and arrays', () => {
    expect(resolveValue({ body: { who: '$draft.customer' }, list: ['$id'] }, ctx)).toEqual({
      body: { who: 'Acme' },
      list: [7],
    });
  });

  it('resolves array indexes in a path', () => {
    expect(resolveValue('$draft.tags.0', ctx)).toBe('a');
  });

  it('allows a present key whose value is undefined', () => {
    expect(resolveValue('$nothing', ctx)).toBeUndefined();
  });

  it('renders templates as strings', () => {
    expect(resolveValue('/invoices/{$id}/by/{$draft.customer}', ctx)).toBe('/invoices/7/by/Acme');
    expect(resolveValue('{$draft.amount}', ctx)).toBe('5');
  });

  it('unescapes a leading $$ and skips templates in it', () => {
    expect(resolveValue('$$draft', ctx)).toBe('$draft');
    expect(resolveValue('$${$id}', ctx)).toBe('${$id}');
  });

  it('throws on an unknown name', () => {
    expect(() => resolveValue('$drafty', ctx)).toThrow(new UnresolvedRefError('drafty'));
  });

  it('throws on a missing path', () => {
    expect(() => resolveValue('$draft.nope', ctx)).toThrow('Unresolved ref: $draft.nope');
    expect(() => resolveValue('$id.deeper', ctx)).toThrow('Unresolved ref: $id.deeper');
    expect(() => resolveValue('$nothing.deeper', ctx)).toThrow('Unresolved ref: $nothing.deeper');
  });

  it('throws when a template placeholder is missing or not a scalar', () => {
    expect(() => resolveValue('/x/{$nope}', ctx)).toThrow('Unresolved ref: $nope');
    expect(() => resolveValue('/x/{$draft}', ctx)).toThrow('Unresolved ref: $draft');
  });

  it('does not treat inherited properties as refs', () => {
    expect(() => resolveValue('$toString', ctx)).toThrow(UnresolvedRefError);
    expect(() => resolveValue('$draft.toString', ctx)).toThrow(UnresolvedRefError);
  });
});

describe('collectRefs', () => {
  it('finds refs and template placeholders with their location', () => {
    expect(
      collectRefs({ body: '$draft', to: '/a/{$x.id}/{$y}', list: ['ok', { deep: '$z.0' }], n: 1 }),
    ).toEqual([
      { at: 'body', path: 'draft' },
      { at: 'to', path: 'x.id' },
      { at: 'to', path: 'y' },
      { at: 'list.1.deep', path: 'z.0' },
    ]);
  });

  it('reports a top-level ref at an empty location', () => {
    expect(collectRefs('$a.b')).toEqual([{ at: '', path: 'a.b' }]);
  });

  it('skips $$ escapes and plain values', () => {
    expect(collectRefs(['$$a', 'costs $5', 'plain', 3, null, undefined, true])).toEqual([]);
  });
});
