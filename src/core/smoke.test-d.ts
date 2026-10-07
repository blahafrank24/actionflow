import { expectTypeOf, it } from 'vitest';
import { version } from './index';

it('type tests run and can fail', () => {
  expectTypeOf(version).toBeString();
  // @ts-expect-error a string is not a number
  expectTypeOf(version).toBeNumber();
});
