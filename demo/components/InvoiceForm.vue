<script setup lang="ts">
import { inject } from 'vue';
import { appKey } from '../appContext';

defineProps<{ disabled: boolean }>();

const app = inject(appKey);
if (!app) throw new Error('App context is not provided');
const { form } = app;
</script>

<template>
  <form class="form" @submit.prevent>
    <label>
      Customer
      <input v-model="form.invoice.customer" name="customer" :disabled="disabled" />
    </label>
    <label>
      Amount
      <input
        v-model.number="form.invoice.amount"
        name="amount"
        type="number"
        min="0"
        :disabled="disabled"
      />
    </label>
    <label class="check">
      <input v-model="form.notify" name="notify" type="checkbox" :disabled="disabled" />
      Notify the customer
    </label>
  </form>
</template>
