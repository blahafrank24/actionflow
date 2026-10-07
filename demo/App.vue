<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import { useSequence } from './actions/useSequence';
import { appKey } from './appContext';
import InvoiceForm from './components/InvoiceForm.vue';
import SequenceJson from './components/SequenceJson.vue';
import TracePanel from './components/TracePanel.vue';
import type { VariantKey } from './createDemo';

const app = inject(appKey);
if (!app) throw new Error('App context is not provided');
const { demo, rows } = app;

const variantKey = ref<VariantKey>('raw');
const variantKeys = Object.keys(demo.variants) as VariantKey[];
const variant = computed(() => demo.variants[variantKey.value]);

const sequence = useSequence(
  demo.flow,
  () => variant.value.steps,
  () => ({ rollback: variant.value.rollback }),
);
const running = computed(() => sequence.status.value === 'running');

watch(variantKey, () => sequence.reset());

async function run() {
  demo.backend.failSend = variantKey.value === 'failing';
  await sequence.run();
}

async function reset() {
  rows.value = [];
  demo.backend.reset();
  sequence.reset();
  await app?.router.push('/');
}
</script>

<template>
  <div class="page">
    <header class="top">
      <h1>actionflow</h1>
      <p class="muted">
        A sequence of typed steps, run against a registry of actions. Pick a variant, run it, and
        watch the trace.
      </p>
    </header>

    <div class="layout">
      <main>
        <section aria-labelledby="run-title">
          <h2 id="run-title">Run a sequence</h2>
          <InvoiceForm :disabled="running" />

          <fieldset class="variants" :disabled="running">
            <legend>Variant</legend>
            <label v-for="key in variantKeys" :key="key">
              <input v-model="variantKey" type="radio" name="variant" :value="key" />
              {{ demo.variants[key].label }}
            </label>
            <p class="muted">{{ variant.description }}</p>
          </fieldset>

          <div class="buttons">
            <button type="button" class="primary" :disabled="running" @click="run">Run</button>
            <button type="button" :disabled="!running" @click="sequence.abort()">Abort</button>
            <button type="button" :disabled="running" @click="reset">Reset</button>
          </div>

          <SequenceJson :steps="variant.steps" />
        </section>

        <RouterView />
      </main>

      <aside>
        <TracePanel :states="sequence.states.value" :status="sequence.status.value" />
      </aside>
    </div>
  </div>
</template>
