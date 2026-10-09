import { HttpError } from '@yung_papa/actionflow/openapi';
import { describe, expect, it } from 'vitest';
import { formatError, formatValue } from './format';

describe('formatValue', () => {
  it('pretty-prints JSON', () => {
    expect(formatValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(formatValue('text')).toBe('"text"');
  });

  it('says so when there is no result', () => {
    expect(formatValue(undefined)).toBe('no result');
  });
});

describe('formatError', () => {
  it('shows the message of an Error', () => {
    expect(formatError(new Error('boom'))).toBe('boom');
  });

  it('adds the body of an HttpError', () => {
    const error = new HttpError('POST /invoices', 422, { message: 'Customer is required' });
    expect(formatError(error)).toBe(
      'POST /invoices failed with 422\n{\n  "message": "Customer is required"\n}',
    );
  });

  it('leaves out an empty body', () => {
    expect(formatError(new HttpError('GET /invoices', 500, ''))).toBe(
      'GET /invoices failed with 500',
    );
  });

  it('stringifies anything else', () => {
    expect(formatError('nope')).toBe('nope');
  });
});
