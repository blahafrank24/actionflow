import { describe, expect, it } from 'vitest';
import { action, createFlow } from './index';

const flow = createFlow({
  'form.read': action((p: { form: string }) => ({ id: p.form })),
  'api.create': action((p: { body: { id: string } }) => p.body),
  'router.push': action((p: { to: string }) => void p),
});

const good = [
  { action: 'form.read', params: { form: 'invoice' }, as: 'draft' },
  { action: 'api.create', params: { body: '$draft' }, as: 'created' },
  { action: 'router.push', params: { to: '/invoices/{$created.id}' }, when: '$created' },
];

const issuesOf = (json: unknown, options?: { input?: string[] }) => {
  const result = flow.validate(json, options);
  if (result.ok) throw new Error('expected validation to fail');
  return result.issues;
};

describe('flow.validate', () => {
  it('accepts a valid sequence and returns it', () => {
    const result = flow.validate(good);
    expect(result).toEqual({ ok: true, sequence: good });
  });

  it('accepts an empty sequence', () => {
    expect(flow.validate([])).toEqual({ ok: true, sequence: [] });
  });

  it('round-trips through JSON and runs', async () => {
    const result = flow.validate(JSON.parse(JSON.stringify(good)));
    if (!result.ok) throw new Error('expected ok');
    expect((await flow.run(result.sequence)).status).toBe('ok');
  });

  it('rejects a non-array', () => {
    expect(issuesOf({ action: 'form.read' })).toEqual([
      { path: '', message: 'A sequence must be an array of steps' },
    ]);
    expect(issuesOf(null)).toHaveLength(1);
  });

  it('rejects a step that is not an object', () => {
    expect(issuesOf([good[0], 'form.read', null, [1]])).toEqual([
      { index: 1, path: '', message: 'A step must be an object' },
      { index: 2, path: '', message: 'A step must be an object' },
      { index: 3, path: '', message: 'A step must be an object' },
    ]);
  });

  it('reports an unknown action on its step', () => {
    expect(issuesOf([good[0], { action: 'form.reed' }])).toEqual([
      { index: 1, path: 'action', message: 'Unknown action: form.reed' },
    ]);
  });

  it('does not treat inherited names as actions', () => {
    expect(issuesOf([{ action: 'toString' }])).toEqual([
      { index: 0, path: 'action', message: 'Unknown action: toString' },
    ]);
  });

  it('rejects a missing or non-string action', () => {
    expect(issuesOf([{}, { action: 5 }])).toEqual([
      { index: 0, path: 'action', message: 'action must be a string' },
      { index: 1, path: 'action', message: 'action must be a string' },
    ]);
  });

  it('rejects unknown step keys', () => {
    expect(issuesOf([{ action: 'router.push', params: { to: '/' }, onerror: 'continue' }])).toEqual(
      [{ index: 0, path: 'onerror', message: 'Unknown key "onerror"' }],
    );
  });

  it('rejects a bad onError, as and when', () => {
    expect(
      issuesOf([
        { action: 'router.push', params: { to: '/' }, onError: 'retry' },
        { action: 'router.push', params: { to: '/' }, as: 3 },
        { action: 'router.push', params: { to: '/' }, when: 'created' },
        { action: 'router.push', params: { to: '/' }, when: '$$created' },
      ]),
    ).toEqual([
      { index: 0, path: 'onError', message: "onError must be 'abort' or 'continue'" },
      { index: 1, path: 'as', message: 'as must be a string' },
      { index: 2, path: 'when', message: 'when must be a $ref' },
      { index: 3, path: 'when', message: 'when must be a $ref' },
    ]);
  });

  it('reports an unknown ref with its path in params', () => {
    expect(
      issuesOf([
        good[0],
        { action: 'api.create', params: { body: '$drafty' } },
        { action: 'router.push', params: { to: '/{$nope.id}' }, when: '$gone' },
      ]),
    ).toEqual([
      { index: 1, path: 'params.body', message: 'Unknown ref: $drafty' },
      { index: 2, path: 'when', message: 'Unknown ref: $gone' },
      { index: 2, path: 'params.to', message: 'Unknown ref: $nope.id' },
    ]);
  });

  it('locates refs nested in arrays and objects', () => {
    expect(issuesOf([{ action: 'router.push', params: { to: { list: ['ok', '$x'] } } }])).toEqual([
      { index: 0, path: 'params.to.list.1', message: 'Unknown ref: $x' },
    ]);
  });

  it('reports use before define, including a step reading its own as', () => {
    expect(
      issuesOf([
        { action: 'api.create', params: { body: '$draft' }, as: 'created' },
        { action: 'form.read', params: { form: '$draft.id' }, as: 'draft' },
      ]),
    ).toEqual([
      { index: 0, path: 'params.body', message: 'Ref $draft is used before it is defined' },
      { index: 1, path: 'params.form', message: 'Ref $draft.id is used before it is defined' },
    ]);
  });

  it('ignores $$ escapes', () => {
    expect(flow.validate([{ action: 'router.push', params: { to: '$$nope' } }]).ok).toBe(true);
  });

  it('reports duplicate as names on the second step', () => {
    expect(
      issuesOf([
        { action: 'form.read', params: { form: 'a' }, as: 'x' },
        { action: 'form.read', params: { form: 'b' }, as: 'x' },
      ]),
    ).toEqual([{ index: 1, path: 'as', message: 'Duplicate name: "x"' }]);
  });

  it('accepts refs to input names, and rejects as shadowing one', () => {
    const seq = [{ action: 'router.push', params: { to: '/{$page}' } }];
    expect(flow.validate(seq, { input: ['page'] }).ok).toBe(true);
    expect(issuesOf(seq)).toEqual([{ index: 0, path: 'params.to', message: 'Unknown ref: $page' }]);
    expect(
      issuesOf([{ action: 'form.read', params: { form: 'a' }, as: 'page' }], { input: ['page'] }),
    ).toEqual([{ index: 0, path: 'as', message: 'Duplicate name: "page"' }]);
  });

  it('collects every issue in one pass', () => {
    const issues = issuesOf([
      { action: 'nope', as: 'a' },
      { action: 'router.push', params: { to: '$zzz' }, onError: 'x' },
      { action: 'form.read', params: { form: '$a' }, extra: 1 },
    ]);
    expect(issues.map((i) => `${i.index}:${i.path}`)).toEqual([
      '0:action',
      '1:onError',
      '1:params.to',
      '2:extra',
    ]);
  });
});
