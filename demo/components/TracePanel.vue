<script setup lang="ts">
import { computed } from 'vue';
import type { SequenceStatus } from '../actions/useSequence';
import type { StepState } from '../actions/stepStates';
import { formatError, formatValue } from './format';

const props = defineProps<{ states: readonly StepState[]; status: SequenceStatus }>();

const runLabels: Record<SequenceStatus, string> = {
  idle: 'Ready',
  running: 'Running…',
  ok: 'Succeeded',
  failed: 'Failed',
  aborted: 'Aborted',
};

const finished = computed(() => props.status !== 'idle' && props.status !== 'running');
const slowest = computed(() => Math.max(1, ...props.states.map((s) => s.durationMs ?? 0)));

function label(state: StepState): string {
  if (state.status === 'pending') return finished.value ? 'not run' : 'pending';
  return state.status;
}

function bar(state: StepState): string {
  return `${Math.max(4, ((state.durationMs ?? 0) / slowest.value) * 100)}%`;
}

function hasDetails(state: StepState): boolean {
  return state.status === 'done' || state.status === 'error' || state.params !== undefined;
}
</script>

<template>
  <section class="trace" aria-labelledby="trace-title">
    <header>
      <h2 id="trace-title">Trace</h2>
      <span class="badge" :data-status="status" role="status">{{ runLabels[status] }}</span>
    </header>
    <ol class="steps">
      <li
        v-for="state in states"
        :key="state.index"
        class="step"
        :data-status="state.status"
        :data-finished="finished"
        :data-undo="state.undo ? (state.undo.error === undefined ? 'undone' : 'failed') : undefined"
      >
        <div class="step-head">
          <span class="index">{{ state.index + 1 }}</span>
          <code class="name">{{ state.action }}</code>
          <span class="badge" :data-kind="state.status">{{ label(state) }}</span>
          <span v-if="state.undo" class="badge" data-kind="undo">
            {{ state.undo.error === undefined ? 'undone' : 'undo failed' }}
          </span>
        </div>
        <div v-if="state.durationMs !== undefined" class="bar">
          <span :style="{ width: bar(state) }"></span>
          <small>{{ Math.round(state.durationMs) }} ms</small>
        </div>
        <details v-if="hasDetails(state)" :open="state.status === 'error'">
          <summary>Details</summary>
          <dl>
            <template v-if="state.params !== undefined">
              <dt>Params</dt>
              <dd>
                <pre>{{ formatValue(state.params) }}</pre>
              </dd>
            </template>
            <template v-if="state.status === 'done'">
              <dt>Result</dt>
              <dd>
                <pre>{{ formatValue(state.result) }}</pre>
              </dd>
            </template>
            <template v-if="state.status === 'error'">
              <dt>Error</dt>
              <dd>
                <pre>{{ formatError(state.error) }}</pre>
              </dd>
            </template>
            <template v-if="state.undo?.error !== undefined">
              <dt>Undo error</dt>
              <dd>
                <pre>{{ formatError(state.undo.error) }}</pre>
              </dd>
            </template>
          </dl>
        </details>
      </li>
    </ol>
  </section>
</template>
