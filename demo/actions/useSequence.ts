import type { RunOptions, RunResult, RunStatus, RuntimeStep, TraceEvent } from 'actionflow';
import { computed, ref, shallowRef, toValue } from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { stepStates } from './stepStates';

export type SequenceStatus = 'idle' | 'running' | RunStatus;

interface Runner {
  run(steps: readonly RuntimeStep[], options?: RunOptions): Promise<RunResult>;
}

export function useSequence(
  flow: Runner,
  steps: MaybeRefOrGetter<readonly RuntimeStep[]>,
  options?: MaybeRefOrGetter<Pick<RunOptions, 'rollback' | 'input'>>,
) {
  const status = ref<SequenceStatus>('idle');
  const trace = shallowRef<TraceEvent[]>([]);
  const result = shallowRef<RunResult>();
  const states = computed(() => stepStates(toValue(steps), trace.value));
  let controller: AbortController | undefined;

  async function run() {
    if (status.value === 'running') return;
    controller = new AbortController();
    trace.value = [];
    result.value = undefined;
    status.value = 'running';
    const outcome = await flow.run(toValue(steps), {
      ...toValue(options),
      signal: controller.signal,
      onEvent: (event) => {
        trace.value = [...trace.value, event];
      },
    });
    result.value = outcome;
    status.value = outcome.status;
    return outcome;
  }

  function reset() {
    if (status.value === 'running') return;
    trace.value = [];
    result.value = undefined;
    status.value = 'idle';
  }

  function abort() {
    controller?.abort();
  }

  return { status, trace, states, result, run, abort, reset };
}
