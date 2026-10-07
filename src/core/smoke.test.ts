import { expect, it } from 'vitest';
import { version } from './index';

it('exposes the core entry', () => {
  expect(version).toBe('0.0.0');
});
