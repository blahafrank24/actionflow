<script setup lang="ts">
import type { RuntimeStep } from 'actionflow';

defineProps<{ steps: readonly RuntimeStep[] }>();
</script>

<template>
  <details class="json">
    <summary>Sequence as JSON</summary>
    <pre>{{ JSON.stringify(steps, null, 2) }}</pre>
  </details>
</template>
