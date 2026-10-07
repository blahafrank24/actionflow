<script setup lang="ts">
import { inject, ref, watchEffect } from 'vue';
import { useRoute } from 'vue-router';
import { appKey } from '../appContext';
import type { Invoice } from '../api/fakeBackend';

const app = inject(appKey);
if (!app) throw new Error('App context is not provided');
const route = useRoute();

const invoice = ref<Invoice>();
const state = ref<'loading' | 'found' | 'missing'>('loading');

watchEffect(async () => {
  const id = String(route.params.id);
  state.value = 'loading';
  const { data } = await app.demo.client.GET('/invoices/{id}', { params: { path: { id } } });
  invoice.value = data;
  state.value = data ? 'found' : 'missing';
});
</script>

<template>
  <section aria-labelledby="detail-title">
    <h2 id="detail-title">Invoice {{ route.params.id }}</h2>
    <p v-if="state === 'loading'" class="muted">Loading…</p>
    <p v-else-if="state === 'missing'" class="muted">
      No such invoice. It may have been rolled back.
    </p>
    <dl v-else-if="invoice" class="facts">
      <dt>Customer</dt>
      <dd>{{ invoice.customer }}</dd>
      <dt>Amount</dt>
      <dd>{{ invoice.amount }}</dd>
      <dt>Sent</dt>
      <dd>{{ invoice.sent ? 'yes' : 'no' }}</dd>
    </dl>
    <p><RouterLink to="/">Back to the list</RouterLink></p>
  </section>
</template>
