<script setup lang="ts">
import { inject } from 'vue';
import { appKey } from '../appContext';

const app = inject(appKey);
if (!app) throw new Error('App context is not provided');
const { rows } = app;
</script>

<template>
  <section aria-labelledby="invoices-title">
    <h2 id="invoices-title">Invoices</h2>
    <p v-if="rows.length === 0" class="muted">No invoices yet. Run a sequence to create one.</p>
    <table v-else>
      <thead>
        <tr>
          <th>Id</th>
          <th>Customer</th>
          <th class="num">Amount</th>
          <th>Sent</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td>
            <RouterLink :to="`/invoices/${row.id}`">{{ row.id }}</RouterLink>
          </td>
          <td>{{ row.customer }}</td>
          <td class="num">{{ row.amount }}</td>
          <td>{{ row.sent ? 'yes' : 'no' }}</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
