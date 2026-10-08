import { collectRefs } from './resolve.js';
import type {
  Registry,
  RuntimeStep,
  ValidateOptions,
  ValidationIssue,
  ValidationResult,
} from './types.js';

const STEP_KEYS = new Set(['action', 'params', 'as', 'when', 'onError']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function validateSequence(
  registry: Registry,
  json: unknown,
  options: ValidateOptions = {},
): ValidationResult {
  if (!Array.isArray(json)) {
    return { ok: false, issues: [{ path: '', message: 'A sequence must be an array of steps' }] };
  }

  const issues: ValidationIssue[] = [];
  const defined = new Set(options.input);
  // Names produced by any step, to tell "used before defined" from "never defined".
  const everDefined = new Set<string>();
  for (const step of json) {
    if (isRecord(step) && typeof step.as === 'string') everDefined.add(step.as);
  }

  json.forEach((step: unknown, index) => {
    const issue = (path: string, message: string) => issues.push({ index, path, message });
    if (!isRecord(step)) return issue('', 'A step must be an object');

    for (const key of Object.keys(step)) {
      if (!STEP_KEYS.has(key)) issue(key, `Unknown key "${key}"`);
    }

    if (typeof step.action !== 'string') issue('action', 'action must be a string');
    else if (!Object.hasOwn(registry, step.action)) {
      issue('action', `Unknown action: ${step.action}`);
    }

    if (step.onError !== undefined && step.onError !== 'abort' && step.onError !== 'continue') {
      issue('onError', "onError must be 'abort' or 'continue'");
    }

    const checkRef = (path: string, ref: string) => {
      const name = ref.split('.')[0] ?? '';
      if (defined.has(name)) return;
      issue(
        path,
        everDefined.has(name) ? `Ref $${ref} is used before it is defined` : `Unknown ref: $${ref}`,
      );
    };

    if (step.when !== undefined) {
      if (
        typeof step.when !== 'string' ||
        !step.when.startsWith('$') ||
        step.when.startsWith('$$')
      ) {
        issue('when', 'when must be a $ref');
      } else {
        checkRef('when', step.when.slice(1));
      }
    }
    for (const { at, path } of collectRefs(step.params)) {
      checkRef(at ? `params.${at}` : 'params', path);
    }

    if (step.as !== undefined) {
      if (typeof step.as !== 'string') issue('as', 'as must be a string');
      else if (defined.has(step.as)) issue('as', `Duplicate name: "${step.as}"`);
      else defined.add(step.as);
    }
  });

  return issues.length > 0 ? { ok: false, issues } : { ok: true, sequence: json as RuntimeStep[] };
}
